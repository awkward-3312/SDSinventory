import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
import psycopg

from .db import check_db

load_dotenv()


def get_db_url() -> str:
    db_url = os.getenv("DATABASE_URL")
    if not db_url:
        raise HTTPException(status_code=500, detail="DATABASE_URL no configurado")
    return db_url


def _round2(x: float) -> float:
    return round(float(x), 2)


app = FastAPI(title="SDSinventory API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Health ----------
@app.get("/health")
def health():
    return {"ok": True}


@app.get("/db-health")
def db_health():
    result = check_db()
    return {"db": "ok", "result": result}


# ---------- Units ----------
@app.get("/units")
def list_units():
    db_url = get_db_url()
    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute("select id, code, name from public.units order by id;")
            rows = cur.fetchall()
    return [{"id": str(r[0]), "code": r[1], "name": r[2]} for r in rows]


# ---------- Supplies ----------
class SupplyCreate(BaseModel):
    name: str
    unit_base_id: int
    stock_min: float = 0


@app.post("/supplies")
def create_supply(payload: SupplyCreate):
    db_url = get_db_url()
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
        "id": str(row[0]),
        "name": row[1],
        "unit_base_id": row[2],
        "stock_on_hand": float(row[3]),
        "stock_min": float(row[4]),
        "avg_unit_cost": float(row[5]),
        "created_at": row[6],
    }


@app.get("/supplies")
def list_supplies():
    db_url = get_db_url()
    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select s.id, s.name, u.code as unit_code,
                       s.stock_on_hand, s.stock_min, s.avg_unit_cost
                from public.supplies s
                join public.units u on u.id = s.unit_base_id
                order by s.created_at desc;
                """
            )
            rows = cur.fetchall()

    return [
        {
            "id": str(r[0]),
            "name": r[1],
            "unit_base": r[2],
            "stock_on_hand": float(r[3]),
            "stock_min": float(r[4]),
            "avg_unit_cost": float(r[5]),
        }
        for r in rows
    ]


# ---------- Presentations ----------
class PresentationCreate(BaseModel):
    supply_id: str
    name: str
    units_in_base: float


@app.post("/presentations")
def create_presentation(payload: PresentationCreate):
    db_url = get_db_url()
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
        "id": str(row[0]),
        "supply_id": str(row[1]),
        "name": row[2],
        "units_in_base": float(row[3]),
        "created_at": row[4],
    }


@app.get("/presentations")
def list_presentations():
    db_url = get_db_url()
    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select p.id, p.supply_id, s.name as supply_name,
                       p.name, p.units_in_base, p.created_at
                from public.presentations p
                join public.supplies s on s.id = p.supply_id
                order by p.created_at desc;
                """
            )
            rows = cur.fetchall()

    return [
        {
            "id": str(r[0]),
            "supply_id": str(r[1]),
            "supply_name": r[2],
            "name": r[3],
            "units_in_base": float(r[4]),
            "created_at": r[5],
        }
        for r in rows
    ]


# ---------- Purchases ----------
class PurchaseCreate(BaseModel):
    supply_id: str
    presentation_id: str
    packs_qty: float
    total_cost: float
    supplier_name: str | None = None


@app.post("/purchases")
def create_purchase(payload: PurchaseCreate):
    db_url = get_db_url()

    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "select units_in_base from public.presentations where id=%s",
                (payload.presentation_id,),
            )
            pres = cur.fetchone()
            if not pres:
                raise HTTPException(status_code=400, detail="presentation_id no existe")

            units_per_pack = float(pres[0])
            units_in_base = float(payload.packs_qty) * units_per_pack
            if units_in_base <= 0:
                raise HTTPException(status_code=400, detail="units_in_base debe ser > 0")

            unit_cost = float(payload.total_cost) / units_in_base

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
                raise HTTPException(status_code=400, detail="supply_id no existe")

            stock_on_hand = float(row[0])
            avg_unit_cost = float(row[1])

            prev_value = stock_on_hand * avg_unit_cost
            buy_value = units_in_base * unit_cost
            new_stock = stock_on_hand + units_in_base
            new_avg = (prev_value + buy_value) / new_stock if new_stock > 0 else 0

            cur.execute(
                """
                insert into public.purchases (supplier_name)
                values (%s)
                returning id
                """,
                (payload.supplier_name,),
            )
            purchase_id = cur.fetchone()[0]

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

            cur.execute(
                """
                insert into public.inventory_movements
                (supply_id, movement_type, qty_base, unit_cost_snapshot, ref_type, ref_id)
                values (%s,'IN',%s,%s,'purchase',%s)
                """,
                (payload.supply_id, units_in_base, unit_cost, purchase_item_id),
            )

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
        "purchase_id": str(purchase_id),
        "purchase_item_id": str(purchase_item_id),
        "units_in_base": units_in_base,
        "unit_cost": _round2(unit_cost),
        "new_stock": new_stock,
        "new_avg_unit_cost": _round2(new_avg),
    }


# ---------- Movements (Kardex) ----------
@app.get("/movements")
def list_movements(supply_id: str):
    db_url = get_db_url()
    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select id, movement_type, qty_base, unit_cost_snapshot,
                       ref_type, ref_id, created_at
                from public.inventory_movements
                where supply_id = %s
                order by created_at desc;
                """,
                (supply_id,),
            )
            rows = cur.fetchall()

    return [
        {
            "id": str(r[0]),
            "movement_type": r[1],
            "qty_base": float(r[2]),
            "unit_cost_snapshot": float(r[3]),
            "ref_type": r[4],
            "ref_id": str(r[5]),
            "created_at": r[6],
        }
        for r in rows
    ]


# (Opcional) Summary para Kardex (por si lo necesitas)
@app.get("/movements/summary")
def movements_summary(supply_id: str):
    db_url = get_db_url()
    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select
                  coalesce(sum(case when movement_type='IN' then qty_base else 0 end),0) as total_in,
                  coalesce(sum(case when movement_type='OUT' then qty_base else 0 end),0) as total_out
                from public.inventory_movements
                where supply_id=%s
                """,
                (supply_id,),
            )
            row = cur.fetchone()

    total_in = float(row[0])
    total_out = float(row[1])
    return {
        "supply_id": supply_id,
        "total_in": _round2(total_in),
        "total_out": _round2(total_out),
        "balance": _round2(total_in - total_out),
    }


# ---------- Products ----------
class ProductCreate(BaseModel):
    name: str


@app.post("/products")
def create_product(payload: ProductCreate):
    db_url = get_db_url()
    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into public.products (name)
                values (%s)
                returning id, name, active, created_at
                """,
                (payload.name.strip(),),
            )
            row = cur.fetchone()
        conn.commit()

    return {"id": str(row[0]), "name": row[1], "active": row[2], "created_at": row[3]}


@app.get("/products")
def list_products():
    db_url = get_db_url()
    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select id, name, active, created_at
                from public.products
                order by created_at desc;
                """
            )
            rows = cur.fetchall()

    return [{"id": str(r[0]), "name": r[1], "active": r[2], "created_at": r[3]} for r in rows]


# ---------- Recipes ----------
class RecipeCreate(BaseModel):
    product_id: str
    name: str = "Base"


@app.post("/recipes")
def create_recipe(payload: RecipeCreate):
    db_url = get_db_url()
    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into public.recipes (product_id, name)
                values (%s, %s)
                returning id, product_id, name, created_at
                """,
                (payload.product_id, payload.name.strip()),
            )
            row = cur.fetchone()
        conn.commit()

    return {"id": str(row[0]), "product_id": str(row[1]), "name": row[2], "created_at": row[3]}


@app.get("/recipes")
def list_recipes(product_id: str):
    db_url = get_db_url()
    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select id, product_id, name, created_at
                from public.recipes
                where product_id = %s
                order by created_at desc;
                """,
                (product_id,),
            )
            rows = cur.fetchall()

    return [{"id": str(r[0]), "product_id": str(r[1]), "name": r[2], "created_at": r[3]} for r in rows]


# ---------- Recipe Items ----------
class RecipeItemCreate(BaseModel):
    recipe_id: str
    supply_id: str
    qty_base: float
    waste_pct: float = 0


@app.post("/recipe-items")
def add_recipe_item(payload: RecipeItemCreate):
    db_url = get_db_url()
    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                insert into public.recipe_items (recipe_id, supply_id, qty_base, waste_pct)
                values (%s, %s, %s, %s)
                returning id, recipe_id, supply_id, qty_base, waste_pct, created_at
                """,
                (payload.recipe_id, payload.supply_id, payload.qty_base, payload.waste_pct),
            )
            row = cur.fetchone()
        conn.commit()

    return {
        "id": str(row[0]),
        "recipe_id": str(row[1]),
        "supply_id": str(row[2]),
        "qty_base": float(row[3]),
        "waste_pct": float(row[4]),
        "created_at": row[5],
    }


@app.get("/recipe-items")
def list_recipe_items(recipe_id: str):
    db_url = get_db_url()
    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select ri.id, ri.recipe_id, ri.supply_id, s.name, u.code,
                       ri.qty_base, ri.waste_pct, s.avg_unit_cost
                from public.recipe_items ri
                join public.supplies s on s.id = ri.supply_id
                join public.units u on u.id = s.unit_base_id
                where ri.recipe_id = %s
                order by ri.created_at asc;
                """,
                (recipe_id,),
            )
            rows = cur.fetchall()

    return [
        {
            "id": str(r[0]),
            "recipe_id": str(r[1]),
            "supply_id": str(r[2]),
            "supply_name": r[3],
            "unit_base": r[4],
            "qty_base": float(r[5]),
            "waste_pct": float(r[6]),
            "avg_unit_cost": float(r[7]),
        }
        for r in rows
    ]


# ---------- Recipe Cost / Suggested Price ----------
@app.get("/recipes/{recipe_id}/cost")
def recipe_cost(recipe_id: str):
    db_url = get_db_url()
    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select ri.supply_id, s.name, ri.qty_base, ri.waste_pct, s.avg_unit_cost
                from public.recipe_items ri
                join public.supplies s on s.id = ri.supply_id
                where ri.recipe_id = %s
                """,
                (recipe_id,),
            )
            rows = cur.fetchall()

    items = []
    total = 0.0

    for supply_id, supply_name, qty_base, waste_pct, avg_unit_cost in rows:
        qty = float(qty_base)
        waste = float(waste_pct)
        cost_u = float(avg_unit_cost)

        qty_with_waste = qty * (1 + waste / 100.0)
        line_cost = qty_with_waste * cost_u
        total += line_cost

        items.append(
            {
                "supply_id": str(supply_id),
                "supply_name": supply_name,
                "qty_base": qty,
                "waste_pct": waste,
                "qty_with_waste": qty_with_waste,
                "avg_unit_cost": cost_u,
                "line_cost": _round2(line_cost),
            }
        )

    return {"recipe_id": recipe_id, "items": items, "materials_cost": _round2(total), "currency": "HNL"}


@app.get("/recipes/{recipe_id}/suggested-price")
def suggested_price(recipe_id: str, value: float = 0.4, mode: str = "margin"):
    data = recipe_cost(recipe_id)
    cost = float(data["materials_cost"])

    if value < 0:
        raise HTTPException(status_code=400, detail="value debe ser >= 0")

    mode = mode.lower().strip()
    if mode == "markup":
        price = cost * (1.0 + value)
    elif mode == "margin":
        if value >= 1:
            raise HTTPException(status_code=400, detail="margen debe ser < 1 (ej 0.4)")
        price = cost / (1.0 - value)
    else:
        raise HTTPException(status_code=400, detail="mode debe ser 'markup' o 'margin'")

    return {
        "recipe_id": recipe_id,
        "materials_cost": _round2(cost),
        "mode": mode,
        "value": float(value),
        "suggested_price": _round2(price),
        "currency": "HNL",
    }


# ---------- Production ----------
class ProductionCreate(BaseModel):
    product_id: str
    recipe_id: str
    qty: float = 1


@app.post("/production")
def create_production(payload: ProductionCreate):
    db_url = get_db_url()

    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select ri.supply_id, ri.qty_base, ri.waste_pct, s.avg_unit_cost, s.stock_on_hand
                from public.recipe_items ri
                join public.supplies s on s.id = ri.supply_id
                where ri.recipe_id = %s
                """,
                (payload.recipe_id,),
            )
            items = cur.fetchall()

            if not items:
                raise HTTPException(status_code=400, detail="La receta no tiene items")

            total_cost = 0.0
            consumptions = []
            consumptions_out = []

            for supply_id, qty_base, waste_pct, avg_cost, stock_on_hand in items:
                qty = float(qty_base) * float(payload.qty)
                waste = float(waste_pct)
                qty_with_waste = qty * (1 + waste / 100.0)

                cost_u = float(avg_cost)
                total_cost += qty_with_waste * cost_u

                available = float(stock_on_hand)
                if available < qty_with_waste:
                    raise HTTPException(
                        status_code=400,
                        detail=f"stock insuficiente supply_id={supply_id} needed={qty_with_waste} available={available}",
                    )

                consumptions.append((supply_id, qty_with_waste, cost_u))
                consumptions_out.append(
                    {"supply_id": str(supply_id), "qty_base": qty_with_waste, "unit_cost": cost_u}
                )

            cur.execute(
                """
                insert into public.production_orders (product_id, recipe_id, qty, materials_cost)
                values (%s, %s, %s, %s)
                returning id
                """,
                (payload.product_id, payload.recipe_id, payload.qty, total_cost),
            )
            prod_id = cur.fetchone()[0]

            for supply_id, qty_out, cost_u in consumptions:
                cur.execute(
                    """
                    select stock_on_hand
                    from public.supplies
                    where id=%s
                    for update
                    """,
                    (supply_id,),
                )
                current_stock = float(cur.fetchone()[0])
                new_stock = current_stock - qty_out

                cur.execute(
                    """
                    insert into public.inventory_movements
                    (supply_id, movement_type, qty_base, unit_cost_snapshot, ref_type, ref_id)
                    values (%s,'OUT',%s,%s,'production',%s)
                    """,
                    (supply_id, qty_out, cost_u, prod_id),
                )

                cur.execute(
                    "update public.supplies set stock_on_hand=%s where id=%s",
                    (new_stock, supply_id),
                )

        conn.commit()

    return {
        "production_id": str(prod_id),
        "materials_cost": _round2(total_cost),
        "currency": "HNL",
        "consumptions": [
            {
                "supply_id": c["supply_id"],
                "qty_base": _round2(c["qty_base"]),
                "unit_cost": _round2(c["unit_cost"]),
            }
            for c in consumptions_out
        ],
    }


# ---------- Alerts ----------
@app.get("/alerts/low-stock")
def low_stock_alerts():
    db_url = get_db_url()
    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select s.id, s.name, u.code as unit_code,
                       s.stock_on_hand, s.stock_min, s.avg_unit_cost
                from public.supplies s
                join public.units u on u.id = s.unit_base_id
                where s.stock_on_hand <= s.stock_min
                order by (s.stock_on_hand - s.stock_min) asc, s.name asc;
                """
            )
            rows = cur.fetchall()

    return [
        {
            "supply_id": str(r[0]),
            "name": r[1],
            "unit_base": r[2],
            "stock_on_hand": round(float(r[3]), 6),
            "stock_min": round(float(r[4]), 6),
            "avg_unit_cost": round(float(r[5]), 6),
        }
        for r in rows
    ]


# ---------- Sales ----------
class SaleLine(BaseModel):
    product_id: str
    recipe_id: str
    qty: float = 1
    sale_price: float | None = None


class SaleCreate(BaseModel):
    customer_name: str | None = None
    notes: str | None = None
    currency: str = "HNL"
    margin: float = 0.4
    lines: list[SaleLine]


@app.post("/sales")
def create_sale(payload: SaleCreate):
    if not payload.lines:
        raise HTTPException(status_code=400, detail="La venta debe tener al menos 1 línea")

    if payload.margin < 0 or payload.margin >= 1:
        raise HTTPException(status_code=400, detail="margin debe estar entre 0 y < 1 (ej 0.4)")

    db_url = get_db_url()

    try:
        with psycopg.connect(db_url) as conn:
            with conn.transaction():
                with conn.cursor() as cur:
                    total_sale = 0.0
                    total_cost = 0.0
                    prepared_lines: list[dict] = []
                    stock_needs: dict[str, float] = {}

                    for line in payload.lines:
                        if float(line.qty) <= 0:
                            raise HTTPException(status_code=400, detail="qty debe ser > 0")

                        cur.execute(
                            "select 1 from public.recipes where id=%s and product_id=%s",
                            (line.recipe_id, line.product_id),
                        )
                        if not cur.fetchone():
                            raise HTTPException(
                                status_code=400,
                                detail=f"recipe_id no pertenece al product_id (recipe_id={line.recipe_id})",
                            )

                        cur.execute(
                            """
                            select ri.supply_id, ri.qty_base, ri.waste_pct,
                                   s.avg_unit_cost, s.stock_on_hand
                            from public.recipe_items ri
                            join public.supplies s on s.id = ri.supply_id
                            where ri.recipe_id = %s
                            """,
                            (line.recipe_id,),
                        )
                        items = cur.fetchall()

                        if not items:
                            raise HTTPException(status_code=400, detail="La receta no tiene items")

                        line_materials_cost = 0.0
                        consumptions_for_line: list[dict] = []

                        for supply_id, qty_base, waste_pct, avg_cost, _stock_on_hand in items:
                            qty = float(qty_base) * float(line.qty)
                            waste = float(waste_pct)
                            qty_with_waste = qty * (1 + waste / 100.0)

                            cost_u = float(avg_cost)
                            line_cost = qty_with_waste * cost_u
                            line_materials_cost += line_cost

                            stock_needs[str(supply_id)] = stock_needs.get(str(supply_id), 0.0) + qty_with_waste
                            consumptions_for_line.append(
                                {"supply_id": str(supply_id), "qty_base": qty_with_waste, "unit_cost": cost_u}
                            )

                        suggested = line_materials_cost / (1.0 - float(payload.margin))
                        sale_price = float(line.sale_price) if line.sale_price is not None else float(suggested)
                        if sale_price < 0:
                            raise HTTPException(status_code=400, detail="sale_price debe ser >= 0")

                        profit = sale_price - line_materials_cost

                        prepared_lines.append(
                            {
                                "product_id": line.product_id,
                                "recipe_id": line.recipe_id,
                                "qty": float(line.qty),
                                "materials_cost": float(line_materials_cost),
                                "suggested_price": float(suggested),
                                "sale_price": float(sale_price),
                                "profit": float(profit),
                                "consumptions": consumptions_for_line,
                            }
                        )

                        total_sale += sale_price
                        total_cost += line_materials_cost

                    total_profit = total_sale - total_cost

                    for supply_id, needed in stock_needs.items():
                        cur.execute(
                            """
                            select stock_on_hand
                            from public.supplies
                            where id=%s
                            for update
                            """,
                            (supply_id,),
                        )
                        row = cur.fetchone()
                        if not row:
                            raise HTTPException(status_code=400, detail=f"supply_id no existe: {supply_id}")
                        available = float(row[0])
                        if available < needed:
                            raise HTTPException(
                                status_code=400,
                                detail=f"stock insuficiente supply_id={supply_id} needed={needed} available={available}",
                            )

                    cur.execute(
                        """
                        insert into public.sales (customer_name, notes, currency, margin, total_sale, total_cost, total_profit)
                        values (%s, %s, %s, %s, %s, %s, %s)
                        returning id
                        """,
                        (
                            payload.customer_name,
                            payload.notes,
                            payload.currency,
                            payload.margin,
                            total_sale,
                            total_cost,
                            total_profit,
                        ),
                    )
                    sale_id = cur.fetchone()[0]

                    sale_items_out: list[dict] = []
                    movements_out: list[dict] = []

                    for pl in prepared_lines:
                        cur.execute(
                            """
                            insert into public.sale_items
                            (sale_id, product_id, recipe_id, qty, materials_cost, suggested_price, sale_price, profit)
                            values (%s,%s,%s,%s,%s,%s,%s,%s)
                            returning id
                            """,
                            (
                                sale_id,
                                pl["product_id"],
                                pl["recipe_id"],
                                pl["qty"],
                                pl["materials_cost"],
                                pl["suggested_price"],
                                pl["sale_price"],
                                pl["profit"],
                            ),
                        )
                        sale_item_id = cur.fetchone()[0]

                        for c in pl["consumptions"]:
                            supply_id = c["supply_id"]
                            qty_out = float(c["qty_base"])
                            cost_u = float(c["unit_cost"])

                            cur.execute("select stock_on_hand from public.supplies where id=%s", (supply_id,))
                            current_stock = float(cur.fetchone()[0])
                            new_stock = current_stock - qty_out

                            cur.execute(
                                """
                                insert into public.inventory_movements
                                (supply_id, movement_type, qty_base, unit_cost_snapshot, ref_type, ref_id)
                                values (%s,'OUT',%s,%s,'sale',%s)
                                """,
                                (supply_id, qty_out, cost_u, sale_item_id),
                            )

                            cur.execute(
                                "update public.supplies set stock_on_hand=%s where id=%s",
                                (new_stock, supply_id),
                            )

                            movements_out.append(
                                {
                                    "supply_id": str(supply_id),
                                    "qty_base": _round2(qty_out),
                                    "unit_cost": _round2(cost_u),
                                    "ref_type": "sale",
                                    "ref_id": str(sale_item_id),
                                }
                            )

                        sale_items_out.append(
                            {
                                "sale_item_id": str(sale_item_id),
                                "product_id": pl["product_id"],
                                "recipe_id": pl["recipe_id"],
                                "qty": float(pl["qty"]),
                                "materials_cost": _round2(pl["materials_cost"]),
                                "suggested_price": _round2(pl["suggested_price"]),
                                "sale_price": _round2(pl["sale_price"]),
                                "profit": _round2(pl["profit"]),
                            }
                        )

        return {
            "sale_id": str(sale_id),
            "currency": payload.currency,
            "total_sale": _round2(total_sale),
            "total_cost": _round2(total_cost),
            "total_profit": _round2(total_profit),
            "margin": float(payload.margin),
            "items": sale_items_out,
            "movements": movements_out,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


# ---------- Sales (History) ----------
@app.get("/sales")
def list_sales(limit: int = 50, offset: int = 0):
    db_url = get_db_url()

    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select
                    s.id,
                    s.created_at,
                    s.customer_name,
                    s.notes,
                    s.currency,
                    s.total_sale,
                    s.total_cost,
                    s.total_profit,
                    s.margin,
                    s.voided,
                    s.voided_at,
                    s.void_reason,
                    s.voided_by
                from public.sales s
                order by s.created_at desc
                limit %s offset %s
                """,
                (limit, offset),
            )
            rows = cur.fetchall()

    return [
        {
            "id": str(r[0]),
            "created_at": r[1],
            "customer_name": r[2],
            "notes": r[3],
            "currency": r[4],
            "total_sale": float(r[5]),
            "total_cost": float(r[6]),
            "total_profit": float(r[7]),
            "margin": float(r[8]) if r[8] is not None else 0.0,
            "voided": bool(r[9]),
            "voided_at": r[10],
            "void_reason": r[11],
            "voided_by": r[12],
        }
        for r in rows
    ]


# ✅ IMPORTANTE: summary ANTES del /sales/{sale_id}
@app.get("/sales/summary")
def sales_summary(include_voided: bool = False):
    db_url = get_db_url()

    where = "" if include_voided else "where voided = false"

    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                f"""
                select
                  coalesce(sum(total_sale),0) as total_sale,
                  coalesce(sum(total_cost),0) as total_cost,
                  coalesce(sum(total_profit),0) as total_profit,
                  count(*) as count_sales
                from public.sales
                {where}
                """
            )
            row = cur.fetchone()

    total_sale = float(row[0])
    total_cost = float(row[1])
    total_profit = float(row[2])
    margin = (total_profit / total_sale) if total_sale > 0 else 0.0

    return {
        "include_voided": include_voided,
        "count_sales": int(row[3]),
        "total_sale": round(total_sale, 2),
        "total_cost": round(total_cost, 2),
        "total_profit": round(total_profit, 2),
        "margin": round(margin, 4),
        "currency": "HNL",
    }


# ---------- Sales (Detail) ----------
@app.get("/sales/{sale_id}")
def get_sale_detail(sale_id: str):
    db_url = get_db_url()

    with psycopg.connect(db_url) as conn:
        with conn.cursor() as cur:
            cur.execute(
                """
                select
                    s.id,
                    s.created_at,
                    s.customer_name,
                    s.notes,
                    s.currency,
                    s.total_sale,
                    s.total_cost,
                    s.total_profit,
                    s.margin,
                    s.voided,
                    s.voided_at,
                    s.void_reason,
                    s.voided_by
                from public.sales s
                where s.id = %s
                """,
                (sale_id,),
            )
            head = cur.fetchone()

            if not head:
                raise HTTPException(status_code=404, detail="sale_id no existe")

            cur.execute(
                """
                select
                    si.id,
                    si.product_id,
                    p.name as product_name,
                    si.recipe_id,
                    r.name as recipe_name,
                    si.qty,
                    si.materials_cost,
                    si.suggested_price,
                    si.sale_price,
                    si.profit,
                    si.created_at
                from public.sale_items si
                left join public.products p on p.id = si.product_id
                left join public.recipes r on r.id = si.recipe_id
                where si.sale_id = %s
                order by si.created_at asc
                """,
                (sale_id,),
            )
            item_rows = cur.fetchall()

            cur.execute(
                """
                select
                    im.id,
                    im.supply_id,
                    s.name as supply_name,
                    u.code as unit_base,
                    im.movement_type,
                    im.qty_base,
                    im.unit_cost_snapshot,
                    im.ref_type,
                    im.ref_id,
                    im.created_at
                from public.inventory_movements im
                join public.supplies s on s.id = im.supply_id
                join public.units u on u.id = s.unit_base_id
                where im.ref_type in ('sale', 'sale_void')
                  and im.ref_id in (
                    select id from public.sale_items where sale_id = %s
                  )
                order by im.created_at asc
                """,
                (sale_id,),
            )
            mov_rows = cur.fetchall()

    items = [
        {
            "sale_item_id": str(r[0]),
            "product_id": str(r[1]),
            "product_name": r[2],
            "recipe_id": str(r[3]),
            "recipe_name": r[4],
            "qty": float(r[5]),
            "materials_cost": float(r[6]),
            "suggested_price": float(r[7]),
            "sale_price": float(r[8]),
            "profit": float(r[9]),
            "created_at": r[10],
        }
        for r in item_rows
    ]

    movements = [
        {
            "movement_id": str(r[0]),
            "supply_id": str(r[1]),
            "supply_name": r[2],
            "unit_base": r[3],
            "movement_type": r[4],
            "qty_base": float(r[5]),
            "unit_cost_snapshot": float(r[6]),
            "ref_type": r[7],
            "ref_id": str(r[8]),
            "created_at": r[9],
            "kardex_url": f"/kardex?supply_id={r[1]}",
        }
        for r in mov_rows
    ]

    return {
        "sale_id": str(head[0]),
        "created_at": head[1],
        "customer_name": head[2],
        "notes": head[3],
        "currency": head[4],
        "total_sale": float(head[5]),
        "total_cost": float(head[6]),
        "total_profit": float(head[7]),
        "margin": float(head[8]) if head[8] is not None else None,
        "voided": bool(head[9]),
        "voided_at": head[10],
        "void_reason": head[11],
        "voided_by": head[12],
        "items": items,
        "movements": movements,
    }


# ---------- Void Sale ----------
class VoidSaleBody(BaseModel):
    reason: str | None = None


@app.post("/sales/{sale_id}/void")
def void_sale(sale_id: str, payload: VoidSaleBody):
    db_url = get_db_url()

    with psycopg.connect(db_url) as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                cur.execute(
                    """
                    select id, voided_at
                    from public.sales
                    where id = %s
                    for update
                    """,
                    (sale_id,),
                )
                sale = cur.fetchone()
                if not sale:
                    raise HTTPException(status_code=404, detail="sale_id no existe")
                if sale[1] is not None:
                    return {"error": "La venta ya está anulada", "sale_id": sale_id}

                cur.execute(
                    """
                    select im.supply_id, im.qty_base, im.unit_cost_snapshot, im.ref_id
                    from public.inventory_movements im
                    where im.ref_type = 'sale'
                      and im.movement_type = 'OUT'
                      and im.ref_id in (
                        select id from public.sale_items where sale_id = %s
                      )
                    """,
                    (sale_id,),
                )
                outs = cur.fetchall()

                if not outs:
                    return {"error": "No hay movimientos OUT para revertir", "sale_id": sale_id}

                reversed_movements = []
                for supply_id, qty_base, unit_cost_snapshot, ref_id in outs:
                    qty_in = float(qty_base)
                    cost_u = float(unit_cost_snapshot)

                    cur.execute(
                        """
                        select stock_on_hand
                        from public.supplies
                        where id=%s
                        for update
                        """,
                        (supply_id,),
                    )
                    row = cur.fetchone()
                    if not row:
                        raise HTTPException(status_code=400, detail=f"supply_id no existe: {supply_id}")

                    new_stock = float(row[0]) + qty_in

                    cur.execute(
                        """
                        insert into public.inventory_movements
                        (supply_id, movement_type, qty_base, unit_cost_snapshot, ref_type, ref_id)
                        values (%s,'IN',%s,%s,'sale_void',%s)
                        returning id
                        """,
                        (supply_id, qty_in, cost_u, ref_id),
                    )
                    mov_id = cur.fetchone()[0]

                    cur.execute(
                        """
                        update public.supplies
                        set stock_on_hand=%s
                        where id=%s
                        """,
                        (new_stock, supply_id),
                    )

                    reversed_movements.append(
                        {
                            "movement_id": str(mov_id),
                            "supply_id": str(supply_id),
                            "qty_base": qty_in,
                            "unit_cost_snapshot": cost_u,
                            "ref_type": "sale_void",
                            "ref_id": str(ref_id),
                        }
                    )

                cur.execute(
                    """
                    update public.sales
                    set voided = true,
                        voided_at = now(),
                        void_reason = %s
                    where id = %s
                    """,
                    (payload.reason, sale_id),
                )

    return {"ok": True, "sale_id": sale_id, "reversed_movements": reversed_movements}