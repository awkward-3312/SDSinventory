from fastapi import HTTPException
from ..db import get_conn
from ..repositories import production as production_repo
from .quantity import apply_waste


def _round2(x: float) -> float:
    return round(float(x), 2)


def create_production(product_id: str, recipe_id: str, qty: float = 1):
    with get_conn() as conn:
        with conn.cursor() as cur:
            items = production_repo.list_recipe_items_for_production(cur, recipe_id)

            if not items:
                raise HTTPException(status_code=400, detail="La receta no tiene items")

            total_cost = 0.0
            consumptions = []
            consumptions_out = []

            for supply_id, qty_base, waste_pct, avg_cost, stock_on_hand, qty_formula, unit_code, unit_name in items:
                if qty_formula:
                    raise HTTPException(status_code=400, detail="Recetas con fórmula no son válidas para producción")
                line_qty = float(qty_base) * float(qty)
                qty_with_waste = apply_waste(line_qty, float(waste_pct), unit_code, unit_name)

                cost_u = float(avg_cost)
                total_cost += qty_with_waste * cost_u

                available = float(stock_on_hand)
                if available < qty_with_waste:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"stock insuficiente supply_id={supply_id} needed={qty_with_waste} available={available}"
                        ),
                    )

                consumptions.append((supply_id, qty_with_waste, cost_u))
                consumptions_out.append(
                    {"supply_id": str(supply_id), "qty_base": qty_with_waste, "unit_cost": cost_u}
                )

            prod_id = production_repo.insert_production_order(cur, product_id, recipe_id, qty, total_cost)

            for supply_id, qty_out, cost_u in consumptions:
                row = production_repo.lock_supply_stock(cur, supply_id)
                if not row:
                    raise HTTPException(status_code=400, detail=f"supply_id no existe: {supply_id}")

                current_stock = float(row[0])
                if current_stock < qty_out:
                    raise HTTPException(
                        status_code=400,
                        detail=(
                            f"stock insuficiente supply_id={supply_id} needed={qty_out} available={current_stock}"
                        ),
                    )

                new_stock = current_stock - qty_out

                production_repo.insert_inventory_movement(cur, supply_id, qty_out, cost_u, prod_id)
                production_repo.update_supply_stock(cur, supply_id, new_stock)

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
