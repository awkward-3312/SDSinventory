from fastapi import HTTPException
from ..db import get_conn
from ..repositories import products as products_repo


def create_product(name: str, product_type: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            row = products_repo.insert_product(cur, name.strip(), product_type)
        conn.commit()
    return {
        "id": str(row[0]),
        "name": row[1],
        "active": row[2],
        "created_at": row[3],
        "product_type": row[4],
    }


def list_products(include_inactive: bool = False):
    with get_conn() as conn:
        with conn.cursor() as cur:
            rows = products_repo.list_products(cur, include_inactive=include_inactive)
    return [
        {"id": str(r[0]), "name": r[1], "active": r[2], "created_at": r[3], "product_type": r[4]}
        for r in rows
    ]


def update_product(product_id: str, name: str, product_type: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            row = products_repo.update_product(cur, product_id, name.strip(), product_type)
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="product_id no existe")
    return {
        "id": str(row[0]),
        "name": row[1],
        "active": row[2],
        "created_at": row[3],
        "product_type": row[4],
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
    }
