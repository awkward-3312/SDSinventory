from fastapi import HTTPException
from ..db import get_conn
from ..repositories import recipe_items as recipe_items_repo
from ..repositories import recipes as recipes_repo
from .formulas import validate_formula


def add_recipe_item(recipe_id: str, supply_id: str, qty_base: float, waste_pct: float, qty_formula: str | None):
    with get_conn() as conn:
        with conn.cursor() as cur:
            recipe = recipes_repo.get_recipe(cur, recipe_id)
            if not recipe:
                raise HTTPException(status_code=404, detail="recipe_id no existe")
            product_type = recipe[4]

            if float(waste_pct) < 0:
                raise HTTPException(status_code=400, detail="waste_pct debe ser >= 0")
            if float(waste_pct) >= 100:
                raise HTTPException(status_code=400, detail="waste_pct debe ser < 100")

            if qty_formula:
                names = validate_formula(qty_formula)
                if product_type == "fixed":
                    raise HTTPException(status_code=400, detail="Receta fija no puede usar fórmula")
                # variable recipe must reference dimensions
                if product_type == "variable" and not names:
                    raise HTTPException(status_code=400, detail="Fórmula debe usar ancho/alto")
            else:
                if product_type == "variable":
                    raise HTTPException(status_code=400, detail="Receta variable requiere fórmula")
                if float(qty_base) <= 0:
                    raise HTTPException(status_code=400, detail="qty_base debe ser > 0")

            row = recipe_items_repo.insert_recipe_item(cur, recipe_id, supply_id, qty_base, waste_pct, qty_formula)
        conn.commit()
    return {
        "id": str(row[0]),
        "recipe_id": str(row[1]),
        "supply_id": str(row[2]),
        "qty_base": float(row[3]),
        "waste_pct": float(row[4]),
        "qty_formula": row[5],
        "created_at": row[6],
    }


def list_recipe_items(recipe_id: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            rows = recipe_items_repo.list_recipe_items(cur, recipe_id)
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
            "qty_formula": r[8],
        }
        for r in rows
    ]


def update_recipe_item(item_id: str, recipe_id: str, supply_id: str, qty_base: float, waste_pct: float, qty_formula: str | None):
    with get_conn() as conn:
        with conn.cursor() as cur:
            recipe = recipes_repo.get_recipe(cur, recipe_id)
            if not recipe:
                raise HTTPException(status_code=404, detail="recipe_id no existe")
            product_type = recipe[4]

            if float(waste_pct) < 0:
                raise HTTPException(status_code=400, detail="waste_pct debe ser >= 0")
            if float(waste_pct) >= 100:
                raise HTTPException(status_code=400, detail="waste_pct debe ser < 100")

            if qty_formula:
                names = validate_formula(qty_formula)
                if product_type == "fixed":
                    raise HTTPException(status_code=400, detail="Receta fija no puede usar fórmula")
                if product_type == "variable" and not names:
                    raise HTTPException(status_code=400, detail="Fórmula debe usar ancho/alto")
            else:
                if product_type == "variable":
                    raise HTTPException(status_code=400, detail="Receta variable requiere fórmula")
                if float(qty_base) <= 0:
                    raise HTTPException(status_code=400, detail="qty_base debe ser > 0")

            row = recipe_items_repo.update_recipe_item(
                cur, item_id, recipe_id, supply_id, qty_base, waste_pct, qty_formula
            )
        conn.commit()

    if not row:
        raise HTTPException(status_code=404, detail="recipe_item_id no existe")
    return {
        "id": str(row[0]),
        "recipe_id": str(row[1]),
        "supply_id": str(row[2]),
        "qty_base": float(row[3]),
        "waste_pct": float(row[4]),
        "qty_formula": row[5],
        "created_at": row[6],
    }


def delete_recipe_item(item_id: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            ok = recipe_items_repo.delete_recipe_item(cur, item_id)
        conn.commit()
    if not ok:
        raise HTTPException(status_code=404, detail="recipe_item_id no existe")
    return {"ok": True, "id": item_id}
