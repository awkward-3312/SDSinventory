from fastapi import HTTPException
from ..db import get_conn
from ..repositories import fixed_costs as fixed_costs_repo


def _round2(x: float) -> float:
    return round(float(x), 2)


def create_period(year: int, month: int, estimated_orders: float, currency: str, active: bool):
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="month debe estar entre 1 y 12")
    if year < 2000 or year > 2100:
        raise HTTPException(status_code=400, detail="year inválido")
    if estimated_orders < 0:
        raise HTTPException(status_code=400, detail="estimated_orders debe ser >= 0")

    with get_conn() as conn:
        with conn.cursor() as cur:
            if active:
                fixed_costs_repo.set_all_inactive(cur)
            row = fixed_costs_repo.insert_period(cur, year, month, estimated_orders, currency, active)
        conn.commit()

    return {
        "id": str(row[0]),
        "year": row[1],
        "month": row[2],
        "estimated_orders": float(row[3]),
        "currency": row[4],
        "active": bool(row[5]),
        "created_at": row[6],
    }


def list_periods():
    with get_conn() as conn:
        with conn.cursor() as cur:
            rows = fixed_costs_repo.list_periods(cur)
    return [
        {
            "id": str(r[0]),
            "year": r[1],
            "month": r[2],
            "estimated_orders": float(r[3]),
            "currency": r[4],
            "active": bool(r[5]),
            "created_at": r[6],
        }
        for r in rows
    ]


def get_period(period_id: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            row = fixed_costs_repo.get_period(cur, period_id)
    if not row:
        raise HTTPException(status_code=404, detail="period_id no existe")
    return {
        "id": str(row[0]),
        "year": row[1],
        "month": row[2],
        "estimated_orders": float(row[3]),
        "currency": row[4],
        "active": bool(row[5]),
        "created_at": row[6],
    }


def set_period_active(period_id: str, active: bool):
    with get_conn() as conn:
        with conn.cursor() as cur:
            if active:
                fixed_costs_repo.set_all_inactive(cur)
            row = fixed_costs_repo.set_active(cur, period_id, active)
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="period_id no existe")
    return {"id": str(row[0]), "active": bool(row[1])}


def add_cost_item(period_id: str, name: str, amount: float):
    if amount < 0:
        raise HTTPException(status_code=400, detail="amount debe ser >= 0")
    with get_conn() as conn:
        with conn.cursor() as cur:
            row = fixed_costs_repo.insert_cost_item(cur, period_id, name.strip(), amount)
        conn.commit()
    return {
        "id": str(row[0]),
        "period_id": str(row[1]),
        "name": row[2],
        "amount": float(row[3]),
        "created_at": row[4],
    }


def list_cost_items(period_id: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            rows = fixed_costs_repo.list_cost_items(cur, period_id)
    return [
        {
            "id": str(r[0]),
            "period_id": str(r[1]),
            "name": r[2],
            "amount": float(r[3]),
            "created_at": r[4],
        }
        for r in rows
    ]


def delete_cost_item(item_id: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            ok = fixed_costs_repo.delete_cost_item(cur, item_id)
        conn.commit()
    if not ok:
        raise HTTPException(status_code=404, detail="item_id no existe")
    return {"ok": True, "id": item_id}


def period_summary(period_id: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            period = fixed_costs_repo.get_period(cur, period_id)
            if not period:
                raise HTTPException(status_code=404, detail="period_id no existe")
            total = fixed_costs_repo.sum_cost_items(cur, period_id)

    estimated = float(period[3])
    cost_per_order = float(total) / estimated if estimated > 0 else 0.0

    return {
        "period_id": str(period[0]),
        "year": period[1],
        "month": period[2],
        "estimated_orders": float(period[3]),
        "currency": period[4],
        "active": bool(period[5]),
        "total_fixed_costs": _round2(total),
        "operational_cost_per_order": _round2(cost_per_order),
    }


def active_period_summary():
    with get_conn() as conn:
        with conn.cursor() as cur:
            period = fixed_costs_repo.get_active_period(cur)
            if not period:
                return {
                    "period_id": None,
                    "operational_cost_per_order": 0.0,
                    "total_fixed_costs": 0.0,
                    "estimated_orders": 0.0,
                    "currency": "HNL",
                    "active": False,
                }
            total = fixed_costs_repo.sum_cost_items(cur, period[0])

    estimated = float(period[3])
    cost_per_order = float(total) / estimated if estimated > 0 else 0.0

    return {
        "period_id": str(period[0]),
        "year": period[1],
        "month": period[2],
        "estimated_orders": float(period[3]),
        "currency": period[4],
        "active": bool(period[5]),
        "total_fixed_costs": _round2(total),
        "operational_cost_per_order": _round2(cost_per_order),
    }


def get_operational_cost_per_order():
    data = active_period_summary()
    return float(data.get("operational_cost_per_order") or 0.0), data.get("period_id")
