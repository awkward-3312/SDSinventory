from fastapi import HTTPException
from ..db import get_conn
from ..repositories import recipe_variables as recipe_variables_repo


def add_variable(recipe_id: str, code: str, label: str, min_value, max_value, default_value):
    if not code.strip():
        raise HTTPException(status_code=400, detail="code es requerido")
    if not label.strip():
        raise HTTPException(status_code=400, detail="label es requerido")
    if min_value is not None and max_value is not None and float(min_value) > float(max_value):
        raise HTTPException(status_code=400, detail="min_value no puede ser > max_value")

    with get_conn() as conn:
        with conn.cursor() as cur:
            row = recipe_variables_repo.insert_recipe_variable(
                cur,
                recipe_id,
                code.strip(),
                label.strip(),
                min_value,
                max_value,
                default_value,
            )
        conn.commit()
    return {
        "id": str(row[0]),
        "recipe_id": str(row[1]),
        "code": row[2],
        "label": row[3],
        "min_value": float(row[4]) if row[4] is not None else None,
        "max_value": float(row[5]) if row[5] is not None else None,
        "default_value": float(row[6]) if row[6] is not None else None,
        "created_at": row[7],
    }


def list_variables(recipe_id: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            rows = recipe_variables_repo.list_recipe_variables(cur, recipe_id)
    return [
        {
            "id": str(r[0]),
            "recipe_id": str(r[1]),
            "code": r[2],
            "label": r[3],
            "min_value": float(r[4]) if r[4] is not None else None,
            "max_value": float(r[5]) if r[5] is not None else None,
            "default_value": float(r[6]) if r[6] is not None else None,
            "created_at": r[7],
        }
        for r in rows
    ]


def update_variable(var_id: str, recipe_id: str, code: str, label: str, min_value, max_value, default_value):
    if not code.strip():
        raise HTTPException(status_code=400, detail="code es requerido")
    if not label.strip():
        raise HTTPException(status_code=400, detail="label es requerido")
    if min_value is not None and max_value is not None and float(min_value) > float(max_value):
        raise HTTPException(status_code=400, detail="min_value no puede ser > max_value")

    with get_conn() as conn:
        with conn.cursor() as cur:
            row = recipe_variables_repo.update_recipe_variable(
                cur,
                var_id,
                recipe_id,
                code.strip(),
                label.strip(),
                min_value,
                max_value,
                default_value,
            )
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="variable_id no existe")
    return {
        "id": str(row[0]),
        "recipe_id": str(row[1]),
        "code": row[2],
        "label": row[3],
        "min_value": float(row[4]) if row[4] is not None else None,
        "max_value": float(row[5]) if row[5] is not None else None,
        "default_value": float(row[6]) if row[6] is not None else None,
        "created_at": row[7],
    }


def delete_variable(var_id: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            ok = recipe_variables_repo.delete_recipe_variable(cur, var_id)
        conn.commit()
    if not ok:
        raise HTTPException(status_code=404, detail="variable_id no existe")
    return {"ok": True, "id": var_id}
