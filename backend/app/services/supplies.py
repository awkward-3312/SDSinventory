from fastapi import HTTPException
from ..db import get_conn
from ..repositories import supplies as supplies_repo


def create_supply(name: str, unit_base_id: int, stock_min: float):
    with get_conn() as conn:
        with conn.cursor() as cur:
            row = supplies_repo.insert_supply(cur, name.strip(), unit_base_id, stock_min)
        conn.commit()
    return {
        "id": str(row[0]),
        "name": row[1],
        "unit_base_id": row[2],
        "stock_on_hand": float(row[3]),
        "stock_min": float(row[4]),
        "avg_unit_cost": float(row[5]),
        "created_at": row[6],
        "active": bool(row[7]),
    }


def list_supplies(include_inactive: bool = False):
    with get_conn() as conn:
        with conn.cursor() as cur:
            rows = supplies_repo.list_supplies(cur, include_inactive=include_inactive)
    return [
        {
            "id": str(r[0]),
            "name": r[1],
            "unit_base": r[2],
            "stock_on_hand": float(r[3]),
            "stock_min": float(r[4]),
            "avg_unit_cost": float(r[5]),
            "active": bool(r[6]),
        }
        for r in rows
    ]


def update_supply(supply_id: str, name: str, unit_base_id: int, stock_min: float):
    with get_conn() as conn:
        with conn.cursor() as cur:
            row = supplies_repo.update_supply(cur, supply_id, name.strip(), unit_base_id, stock_min)
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="supply_id no existe")
    return {
        "id": str(row[0]),
        "name": row[1],
        "unit_base_id": row[2],
        "stock_on_hand": float(row[3]),
        "stock_min": float(row[4]),
        "avg_unit_cost": float(row[5]),
        "created_at": row[6],
        "active": bool(row[7]),
    }


def set_supply_active(supply_id: str, active: bool):
    with get_conn() as conn:
        with conn.cursor() as cur:
            row = supplies_repo.set_supply_active(cur, supply_id, active)
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="supply_id no existe")
    return {"id": str(row[0]), "active": bool(row[1])}
