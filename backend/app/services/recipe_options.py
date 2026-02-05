from fastapi import HTTPException
from ..db import get_conn
from ..repositories import recipe_options as recipe_options_repo
from ..repositories import recipe_option_values as option_values_repo


def create_option(recipe_id: str, code: str, label: str):
    if not code.strip():
        raise HTTPException(status_code=400, detail="code es requerido")
    if not label.strip():
        raise HTTPException(status_code=400, detail="label es requerido")
    with get_conn() as conn:
        with conn.cursor() as cur:
            row = recipe_options_repo.insert_recipe_option(cur, recipe_id, code.strip(), label.strip())
        conn.commit()
    return {
        "id": str(row[0]),
        "recipe_id": str(row[1]),
        "code": row[2],
        "label": row[3],
        "created_at": row[4],
    }


def list_options(recipe_id: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            rows = recipe_options_repo.list_recipe_options(cur, recipe_id)
    return [
        {
            "id": str(r[0]),
            "recipe_id": str(r[1]),
            "code": r[2],
            "label": r[3],
            "created_at": r[4],
        }
        for r in rows
    ]


def update_option(option_id: str, recipe_id: str, code: str, label: str):
    if not code.strip():
        raise HTTPException(status_code=400, detail="code es requerido")
    if not label.strip():
        raise HTTPException(status_code=400, detail="label es requerido")
    with get_conn() as conn:
        with conn.cursor() as cur:
            row = recipe_options_repo.update_recipe_option(cur, option_id, recipe_id, code.strip(), label.strip())
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="option_id no existe")
    return {
        "id": str(row[0]),
        "recipe_id": str(row[1]),
        "code": row[2],
        "label": row[3],
        "created_at": row[4],
    }


def delete_option(option_id: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            ok = recipe_options_repo.delete_recipe_option(cur, option_id)
        conn.commit()
    if not ok:
        raise HTTPException(status_code=404, detail="option_id no existe")
    return {"ok": True, "id": option_id}


def add_option_value(option_id: str, value_key: str, label: str, numeric_value: float):
    if not value_key.strip():
        raise HTTPException(status_code=400, detail="value_key es requerido")
    if not label.strip():
        raise HTTPException(status_code=400, detail="label es requerido")
    with get_conn() as conn:
        with conn.cursor() as cur:
            row = option_values_repo.insert_option_value(
                cur, option_id, value_key.strip(), label.strip(), numeric_value
            )
        conn.commit()
    return {
        "id": str(row[0]),
        "option_id": str(row[1]),
        "value_key": row[2],
        "label": row[3],
        "numeric_value": float(row[4]),
        "created_at": row[5],
    }


def list_option_values(option_id: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            rows = option_values_repo.list_option_values(cur, option_id)
    return [
        {
            "id": str(r[0]),
            "option_id": str(r[1]),
            "value_key": r[2],
            "label": r[3],
            "numeric_value": float(r[4]),
            "created_at": r[5],
        }
        for r in rows
    ]


def update_option_value(value_id: str, option_id: str, value_key: str, label: str, numeric_value: float):
    if not value_key.strip():
        raise HTTPException(status_code=400, detail="value_key es requerido")
    if not label.strip():
        raise HTTPException(status_code=400, detail="label es requerido")
    with get_conn() as conn:
        with conn.cursor() as cur:
            row = option_values_repo.update_option_value(
                cur, value_id, option_id, value_key.strip(), label.strip(), numeric_value
            )
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="value_id no existe")
    return {
        "id": str(row[0]),
        "option_id": str(row[1]),
        "value_key": row[2],
        "label": row[3],
        "numeric_value": float(row[4]),
        "created_at": row[5],
    }


def delete_option_value(value_id: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            ok = option_values_repo.delete_option_value(cur, value_id)
        conn.commit()
    if not ok:
        raise HTTPException(status_code=404, detail="value_id no existe")
    return {"ok": True, "id": value_id}


def options_with_values(recipe_id: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            rows = recipe_options_repo.list_options_with_values(cur, recipe_id)

    out: dict[str, dict] = {}
    for option_id, option_code, option_label, value_id, value_key, value_label, numeric_value in rows:
        opt_id = str(option_id)
        if opt_id not in out:
            out[opt_id] = {
                "id": opt_id,
                "code": option_code,
                "label": option_label,
                "values": [],
            }
        if value_id is not None:
            out[opt_id]["values"].append(
                {
                    "id": str(value_id),
                    "value_key": value_key,
                    "label": value_label,
                    "numeric_value": float(numeric_value),
                }
            )
    return list(out.values())
