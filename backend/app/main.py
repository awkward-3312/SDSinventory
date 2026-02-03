from fastapi import FastAPI

app = FastAPI(title="SDSinventory API")

@app.get("/health")
def health():
    return {"ok": True}

from fastapi import FastAPI
from .db import check_db

app = FastAPI(title="SDSinventory API")

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/db-health")
def db_health():
    result = check_db()
    return {"db": "ok", "result": result}

from fastapi import FastAPI
from .db import check_db
import os
from dotenv import load_dotenv
import psycopg

load_dotenv()

app = FastAPI(title="SDSinventory API")

@app.get("/health")
def health():
    return {"ok": True}

@app.get("/db-health")
def db_health():
    result = check_db()
    return {"db": "ok", "result": result}

@app.get("/units")
def list_units():
    db_url = os.getenv("DATABASE_URL")
    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute("select id, code, name from public.units order by id;")
            rows = cur.fetchall()
    return [{"id": r[0], "code": r[1], "name": r[2]} for r in rows]

from pydantic import BaseModel

class SupplyCreate(BaseModel):
    name: str
    unit_base_id: int
    stock_min: float = 0

@app.post("/supplies")
def create_supply(payload: SupplyCreate):
    db_url = os.getenv("DATABASE_URL")
    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into public.supplies (name, unit_base_id, stock_min)
                values (%s, %s, %s)
                returning id, name, unit_base_id, stock_on_hand, stock_min, avg_unit_cost, created_at
                """,
                (payload.name.strip(), payload.unit_base_id, payload.stock_min),
            )
            row = cur.fetchone()
            conn.commit()

    return {
        "id": row[0],
        "name": row[1],
        "unit_base_id": row[2],
        "stock_on_hand": float(row[3]),
        "stock_min": float(row[4]),
        "avg_unit_cost": float(row[5]),
        "created_at": row[6],
    }

@app.get("/supplies")
def list_supplies():
    db_url = os.getenv("DATABASE_URL")
    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute("""
                select s.id, s.name, u.code as unit_code,
                       s.stock_on_hand, s.stock_min, s.avg_unit_cost
                from public.supplies s
                join public.units u on u.id = s.unit_base_id
                order by s.created_at desc;
            """)
            rows = cur.fetchall()

    return [
        {
            "id": r[0],
            "name": r[1],
            "unit_base": r[2],
            "stock_on_hand": float(r[3]),
            "stock_min": float(r[4]),
            "avg_unit_cost": float(r[5]),
        }
        for r in rows
    ]

class PresentationCreate(BaseModel):
    supply_id: str
    name: str
    units_in_base: float

@app.post("/presentations")
def create_presentation(payload: PresentationCreate):
    db_url = os.getenv("DATABASE_URL")
    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into public.presentations (supply_id, name, units_in_base)
                values (%s, %s, %s)
                returning id, supply_id, name, units_in_base, created_at
                """,
                (payload.supply_id, payload.name.strip(), payload.units_in_base),
            )
            row = cur.fetchone()
            conn.commit()

    return {
        "id": row[0],
        "supply_id": row[1],
        "name": row[2],
        "units_in_base": float(row[3]),
        "created_at": row[4],
    }

class PurchaseCreate(BaseModel):
    supply_id: str
    presentation_id: str
    packs_qty: float
    total_cost: float
    supplier_name: str | None = None

@app.post("/purchases")
def create_purchase(payload: PurchaseCreate):
    db_url = os.getenv("DATABASE_URL")

    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            # 1) Obtener unidades_in_base de la presentación
            cur.execute(
                "select units_in_base from public.presentations where id=%s",
                (payload.presentation_id,),
            )
            pres = cur.fetchone()
            if not pres:
                return {"error": "presentation_id no existe"}

            units_per_pack = float(pres[0])
            units_in_base = payload.packs_qty * units_per_pack
            if units_in_base <= 0:
                return {"error": "units_in_base debe ser > 0"}

            unit_cost = payload.total_cost / units_in_base

            # 2) Bloquear insumo (evita errores si dos compras al mismo tiempo)
            cur.execute(
                """
                select stock_on_hand, avg_unit_cost
                from public.supplies
                where id=%s
                for update
                """,
                (payload.supply_id,),
            )
            row = cur.fetchone()
            if not row:
                return {"error": "supply_id no existe"}

            stock_on_hand = float(row[0])
            avg_unit_cost = float(row[1])

            # 3) Calcular nuevo promedio ponderado
            prev_value = stock_on_hand * avg_unit_cost
            buy_value = units_in_base * unit_cost
            new_stock = stock_on_hand + units_in_base
            new_avg = (prev_value + buy_value) / new_stock if new_stock > 0 else 0

            # 4) Crear purchase
            cur.execute(
                """
                insert into public.purchases (supplier_name)
                values (%s)
                returning id
                """,
                (payload.supplier_name,),
            )
            purchase_id = cur.fetchone()[0]

            # 5) Crear purchase_item
            cur.execute(
                """
                insert into public.purchase_items
                (purchase_id, supply_id, presentation_id, packs_qty, units_in_base, total_cost, unit_cost)
                values (%s,%s,%s,%s,%s,%s,%s)
                returning id
                """,
                (
                    purchase_id,
                    payload.supply_id,
                    payload.presentation_id,
                    payload.packs_qty,
                    units_in_base,
                    payload.total_cost,
                    unit_cost,
                ),
            )
            purchase_item_id = cur.fetchone()[0]

            # 6) Movimiento de inventario IN
            cur.execute(
                """
                insert into public.inventory_movements
                (supply_id, movement_type, qty_base, unit_cost_snapshot, ref_type, ref_id)
                values (%s,'IN',%s,%s,'purchase',%s)
                """,
                (payload.supply_id, units_in_base, unit_cost, purchase_item_id),
            )

            # 7) Actualizar supply (stock + costo promedio)
            cur.execute(
                """
                update public.supplies
                set stock_on_hand=%s, avg_unit_cost=%s
                where id=%s
                """,
                (new_stock, new_avg, payload.supply_id),
            )

        conn.commit()

    return {
        "purchase_id": purchase_id,
        "purchase_item_id": purchase_item_id,
        "units_in_base": units_in_base,
        "unit_cost": unit_cost,
        "new_stock": new_stock,
        "new_avg_unit_cost": new_avg,
    }

