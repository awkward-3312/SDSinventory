from fastapi import HTTPException
from ..db import get_conn
from ..repositories import recipes as recipes_repo
from .formulas import eval_formula
from .quantity import apply_waste


def _round2(x: float) -> float:
    return round(float(x), 2)


def create_recipe(product_id: str, name: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            row = recipes_repo.insert_recipe(cur, product_id, name.strip())
        conn.commit()
    return {"id": str(row[0]), "product_id": str(row[1]), "name": row[2], "created_at": row[3]}


def list_recipes(product_id: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            rows = recipes_repo.list_recipes(cur, product_id)
    return [{"id": str(r[0]), "product_id": str(r[1]), "name": r[2], "created_at": r[3]} for r in rows]


def get_recipe(recipe_id: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            row = recipes_repo.get_recipe(cur, recipe_id)
    if not row:
        raise HTTPException(status_code=404, detail="recipe_id no existe")
    return {
        "id": str(row[0]),
        "product_id": str(row[1]),
        "name": row[2],
        "created_at": row[3],
        "product_type": row[4],
    }


def update_recipe(recipe_id: str, name: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            row = recipes_repo.update_recipe(cur, recipe_id, name.strip())
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="recipe_id no existe")
    return {"id": str(row[0]), "product_id": str(row[1]), "name": row[2], "created_at": row[3]}


def delete_recipe(recipe_id: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            if recipes_repo.recipe_has_sales(cur, recipe_id):
                raise HTTPException(
                    status_code=400,
                    detail="No se puede eliminar la receta porque tiene ventas asociadas",
                )
            ok = recipes_repo.delete_recipe(cur, recipe_id)
        conn.commit()
    if not ok:
        raise HTTPException(status_code=404, detail="recipe_id no existe")
    return {"ok": True, "id": recipe_id}


def recipe_cost(recipe_id: str, width: float | None = None, height: float | None = None):
    with get_conn() as conn:
        with conn.cursor() as cur:
            rows = recipes_repo.list_recipe_items_for_cost(cur, recipe_id)

    items = []
    total = 0.0
    has_formula = False
    if width is not None and width <= 0:
        raise HTTPException(status_code=400, detail="width debe ser > 0")
    if height is not None and height <= 0:
        raise HTTPException(status_code=400, detail="height debe ser > 0")
    variables = {"width": width, "height": height, "w": width, "h": height, "ancho": width, "alto": height}

    for supply_id, supply_name, qty_base, waste_pct, avg_unit_cost, qty_formula, unit_code, unit_name in rows:
        if qty_formula:
            has_formula = True
            if width is None or height is None:
                # fallback a 1x1 si no se envían medidas (no rompe UI existente)
                variables = {
                    "width": 1.0,
                    "height": 1.0,
                    "w": 1.0,
                    "h": 1.0,
                    "ancho": 1.0,
                    "alto": 1.0,
                }
            qty = float(eval_formula(qty_formula, variables))  # qty por unidad
        else:
            qty = float(qty_base)
        cost_u = float(avg_unit_cost)

        qty_with_waste = apply_waste(qty, float(waste_pct), unit_code, unit_name)
        line_cost = qty_with_waste * cost_u
        total += line_cost

        items.append(
            {
                "supply_id": str(supply_id),
                "supply_name": supply_name,
                "qty_base": qty,
                "waste_pct": float(waste_pct),
                "qty_with_waste": qty_with_waste,
                "avg_unit_cost": cost_u,
                "line_cost": _round2(line_cost),
                "qty_formula": qty_formula,
                "unit_code": unit_code,
            }
        )

    return {
        "recipe_id": recipe_id,
        "items": items,
        "materials_cost": _round2(total),
        "currency": "HNL",
        "is_variable": has_formula,
    }


def suggested_price(recipe_id: str, value: float = 0.4, mode: str = "margin", width: float | None = None, height: float | None = None):
    data = recipe_cost(recipe_id, width=width, height=height)
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
