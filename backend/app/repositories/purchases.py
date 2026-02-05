def lock_supply(cur, supply_id: str):
    cur.execute(
        """
        select stock_on_hand, avg_unit_cost
        from public.supplies
        where id=%s
        for update
        """,
        (supply_id,),
    )
    return cur.fetchone()


def insert_purchase(cur, supplier_name: str | None):
    cur.execute(
        """
        insert into public.purchases (supplier_name)
        values (%s)
        returning id
        """,
        (supplier_name,),
    )
    return cur.fetchone()[0]


def insert_purchase_item(
    cur,
    purchase_id: str,
    supply_id: str,
    presentation_id: str,
    packs_qty: float,
    units_in_base: float,
    total_cost: float,
    unit_cost: float,
):
    cur.execute(
        """
        insert into public.purchase_items
        (purchase_id, supply_id, presentation_id, packs_qty, units_in_base, total_cost, unit_cost)
        values (%s,%s,%s,%s,%s,%s,%s)
        returning id
        """,
        (
            purchase_id,
            supply_id,
            presentation_id,
            packs_qty,
            units_in_base,
            total_cost,
            unit_cost,
        ),
    )
    return cur.fetchone()[0]


def insert_inventory_movement(cur, supply_id: str, qty_base: float, unit_cost: float, ref_id: str):
    cur.execute(
        """
        insert into public.inventory_movements
        (supply_id, movement_type, qty_base, unit_cost_snapshot, ref_type, ref_id)
        values (%s,'IN',%s,%s,'purchase',%s)
        """,
        (supply_id, qty_base, unit_cost, ref_id),
    )


def update_supply_stock(cur, supply_id: str, new_stock: float, new_avg: float):
    cur.execute(
        """
        update public.supplies
        set stock_on_hand=%s, avg_unit_cost=%s
        where id=%s
        """,
        (new_stock, new_avg, supply_id),
    )
