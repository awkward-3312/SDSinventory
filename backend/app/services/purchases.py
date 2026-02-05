from fastapi import HTTPException
from ..db import get_conn
from ..repositories import presentations as presentations_repo
from ..repositories import purchases as purchases_repo


def _round2(x: float) -> float:
    return round(float(x), 2)


def create_purchase(supply_id: str, presentation_id: str, packs_qty: float, total_cost: float, supplier_name: str | None):
    with get_conn() as conn:
        with conn.cursor() as cur:
            pres = presentations_repo.get_presentation_units(cur, presentation_id)
            if not pres:
                raise HTTPException(status_code=400, detail="presentation_id no existe")

            units_per_pack = float(pres[0])
            units_in_base = float(packs_qty) * units_per_pack
            if units_in_base <= 0:
                raise HTTPException(status_code=400, detail="units_in_base debe ser > 0")

            unit_cost = float(total_cost) / units_in_base

            row = purchases_repo.lock_supply(cur, supply_id)
            if not row:
                raise HTTPException(status_code=400, detail="supply_id no existe")

            stock_on_hand = float(row[0])
            avg_unit_cost = float(row[1])

            prev_value = stock_on_hand * avg_unit_cost
            buy_value = units_in_base * unit_cost
            new_stock = stock_on_hand + units_in_base
            new_avg = (prev_value + buy_value) / new_stock if new_stock > 0 else 0

            purchase_id = purchases_repo.insert_purchase(cur, supplier_name)

            purchase_item_id = purchases_repo.insert_purchase_item(
                cur,
                purchase_id,
                supply_id,
                presentation_id,
                packs_qty,
                units_in_base,
                total_cost,
                unit_cost,
            )

            purchases_repo.insert_inventory_movement(cur, supply_id, units_in_base, unit_cost, purchase_item_id)
            purchases_repo.update_supply_stock(cur, supply_id, new_stock, new_avg)

        conn.commit()

    return {
        "purchase_id": str(purchase_id),
        "purchase_item_id": str(purchase_item_id),
        "units_in_base": units_in_base,
        "unit_cost": _round2(unit_cost),
        "new_stock": new_stock,
        "new_avg_unit_cost": _round2(new_avg),
    }
