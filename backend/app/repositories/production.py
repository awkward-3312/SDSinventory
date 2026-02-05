def list_recipe_items_for_production(cur, recipe_id: str):
    cur.execute(
        """
        select ri.supply_id, ri.qty_base, ri.waste_pct, s.avg_unit_cost, s.stock_on_hand, ri.qty_formula, u.code, u.name
        from public.recipe_items ri
        join public.supplies s on s.id = ri.supply_id
        join public.units u on u.id = s.unit_base_id
        where ri.recipe_id = %s
        """,
        (recipe_id,),
    )
    return cur.fetchall()


def insert_production_order(cur, product_id: str, recipe_id: str, qty: float, materials_cost: float):
    cur.execute(
        """
        insert into public.production_orders (product_id, recipe_id, qty, materials_cost)
        values (%s, %s, %s, %s)
        returning id
        """,
        (product_id, recipe_id, qty, materials_cost),
    )
    return cur.fetchone()[0]


def lock_supply_stock(cur, supply_id: str):
    cur.execute(
        """
        select stock_on_hand
        from public.supplies
        where id=%s
        for update
        """,
        (supply_id,),
    )
    return cur.fetchone()


def insert_inventory_movement(cur, supply_id: str, qty_base: float, unit_cost: float, ref_id: str):
    cur.execute(
        """
        insert into public.inventory_movements
        (supply_id, movement_type, qty_base, unit_cost_snapshot, ref_type, ref_id)
        values (%s,'OUT',%s,%s,'production',%s)
        """,
        (supply_id, qty_base, unit_cost, ref_id),
    )


def update_supply_stock(cur, supply_id: str, new_stock: float):
    cur.execute(
        "update public.supplies set stock_on_hand=%s where id=%s",
        (new_stock, supply_id),
    )
