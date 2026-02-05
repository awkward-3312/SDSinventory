from fastapi import HTTPException
from ..db import get_conn
from ..repositories import products as products_repo


def create_product(
    name: str,
    product_type: str,
    category: str | None,
    unit_sale: str | None,
    margin_target: float | None = None,
):
    margin_val = float(margin_target) if margin_target is not None else 0.4
    if margin_val < 0 or margin_val >= 1:
        raise HTTPException(status_code=400, detail="margin_target debe estar entre 0 y < 1 (ej 0.4)")
    with get_conn() as conn:
        with conn.cursor() as cur:
            row = products_repo.insert_product(cur, name.strip(), product_type, category, unit_sale, margin_val)
        conn.commit()
    return {
        "id": str(row[0]),
        "name": row[1],
        "active": row[2],
        "created_at": row[3],
        "product_type": row[4],
        "category": row[5],
        "unit_sale": row[6],
        "margin_target": float(row[7]),
    }


def list_products(include_inactive: bool = False):
    with get_conn() as conn:
        with conn.cursor() as cur:
            rows = products_repo.list_products(cur, include_inactive=include_inactive)
    return [
        {
            "id": str(r[0]),
            "name": r[1],
            "active": r[2],
            "created_at": r[3],
            "product_type": r[4],
            "category": r[5],
            "unit_sale": r[6],
            "margin_target": float(r[7]) if r[7] is not None else 0.4,
        }
        for r in rows
    ]


def update_product(
    product_id: str,
    name: str,
    product_type: str,
    category: str | None,
    unit_sale: str | None,
    margin_target: float | None = None,
):
    if margin_target is not None:
        if margin_target < 0 or margin_target >= 1:
            raise HTTPException(status_code=400, detail="margin_target debe estar entre 0 y < 1 (ej 0.4)")
    with get_conn() as conn:
        with conn.cursor() as cur:
            row = products_repo.update_product(
                cur,
                product_id,
                name.strip(),
                product_type,
                category,
                unit_sale,
                margin_target,
            )
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="product_id no existe")
    return {
        "id": str(row[0]),
        "name": row[1],
        "active": row[2],
        "created_at": row[3],
        "product_type": row[4],
        "category": row[5],
        "unit_sale": row[6],
        "margin_target": float(row[7]) if row[7] is not None else 0.4,
    }


def set_product_active(product_id: str, active: bool):
    with get_conn() as conn:
        with conn.cursor() as cur:
            row = products_repo.set_product_active(cur, product_id, active)
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="product_id no existe")
    return {"id": str(row[0]), "active": bool(row[1])}


def get_product(product_id: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            row = products_repo.get_product(cur, product_id)
    if not row:
        raise HTTPException(status_code=404, detail="product_id no existe")
    return {
        "id": str(row[0]),
        "name": row[1],
        "active": row[2],
        "created_at": row[3],
        "product_type": row[4],
        "category": row[5],
        "unit_sale": row[6],
        "margin_target": float(row[7]) if row[7] is not None else 0.4,
    }


def update_product_margin(product_id: str, margin_target: float):
    if margin_target < 0 or margin_target >= 1:
        raise HTTPException(status_code=400, detail="margin_target debe estar entre 0 y < 1 (ej 0.4)")
    with get_conn() as conn:
        with conn.cursor() as cur:
            row = products_repo.update_product_margin(cur, product_id, float(margin_target))
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="product_id no existe")
    return {"id": str(row[0]), "margin_target": float(row[1])}
