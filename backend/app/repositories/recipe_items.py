def insert_recipe_item(
    cur,
    recipe_id: str,
    supply_id: str,
    qty_base: float,
    waste_pct: float,
    qty_formula: str | None,
):
    cur.execute(
        """
        insert into public.recipe_items (recipe_id, supply_id, qty_base, waste_pct, qty_formula)
        values (%s, %s, %s, %s, %s)
        returning id, recipe_id, supply_id, qty_base, waste_pct, qty_formula, created_at
        """,
        (recipe_id, supply_id, qty_base, waste_pct, qty_formula),
    )
    return cur.fetchone()


def list_recipe_items(cur, recipe_id: str):
    cur.execute(
        """
        select ri.id, ri.recipe_id, ri.supply_id, s.name, u.code,
               ri.qty_base, ri.waste_pct, s.avg_unit_cost, ri.qty_formula
        from public.recipe_items ri
        join public.supplies s on s.id = ri.supply_id
        join public.units u on u.id = s.unit_base_id
        where ri.recipe_id = %s
        order by ri.created_at asc;
        """,
        (recipe_id,),
    )
    return cur.fetchall()


def update_recipe_item(cur, item_id: str, recipe_id: str, supply_id: str, qty_base: float, waste_pct: float, qty_formula: str | None):
    cur.execute(
        """
        update public.recipe_items
        set recipe_id=%s,
            supply_id=%s,
            qty_base=%s,
            waste_pct=%s,
            qty_formula=%s
        where id=%s
        returning id, recipe_id, supply_id, qty_base, waste_pct, qty_formula, created_at
        """,
        (recipe_id, supply_id, qty_base, waste_pct, qty_formula, item_id),
    )
    return cur.fetchone()


def delete_recipe_item(cur, item_id: str) -> bool:
    cur.execute("delete from public.recipe_items where id=%s", (item_id,))
    return cur.rowcount > 0
