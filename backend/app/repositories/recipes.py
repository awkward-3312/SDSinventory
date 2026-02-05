def insert_recipe(cur, product_id: str, name: str):
    cur.execute(
        """
        insert into public.recipes (product_id, name, margin_target)
        values (%s, %s, (select margin_target from public.products where id=%s))
        returning id, product_id, name, created_at, margin_target
        """,
        (product_id, name, product_id),
    )
    return cur.fetchone()


def list_recipes(cur, product_id: str):
    cur.execute(
        """
        select id, product_id, name, created_at, margin_target
        from public.recipes
        where product_id = %s
        order by created_at desc;
        """,
        (product_id,),
    )
    return cur.fetchall()


def get_recipe(cur, recipe_id: str):
    cur.execute(
        """
        select r.id, r.product_id, r.name, r.created_at, p.product_type, r.margin_target, p.margin_target
        from public.recipes r
        join public.products p on p.id = r.product_id
        where r.id = %s
        """,
        (recipe_id,),
    )
    return cur.fetchone()


def list_recipe_items_for_cost(cur, recipe_id: str):
    cur.execute(
        """
        select ri.supply_id, s.name, ri.qty_base, ri.waste_pct, s.avg_unit_cost, ri.qty_formula, u.code, u.name
        from public.recipe_items ri
        join public.supplies s on s.id = ri.supply_id
        join public.units u on u.id = s.unit_base_id
        where ri.recipe_id = %s
        """,
        (recipe_id,),
    )
    return cur.fetchall()


def update_recipe(cur, recipe_id: str, name: str):
    cur.execute(
        """
        update public.recipes
        set name=%s
        where id=%s
        returning id, product_id, name, created_at, margin_target
        """,
        (name, recipe_id),
    )
    return cur.fetchone()


def update_recipe_margin(cur, recipe_id: str, margin_target: float):
    cur.execute(
        """
        update public.recipes
        set margin_target=%s
        where id=%s
        returning id, product_id, margin_target
        """,
        (margin_target, recipe_id),
    )
    return cur.fetchone()


def delete_recipe(cur, recipe_id: str) -> bool:
    cur.execute("delete from public.recipes where id=%s", (recipe_id,))
    return cur.rowcount > 0


def recipe_has_sales(cur, recipe_id: str) -> bool:
    cur.execute(
        "select 1 from public.sale_items where recipe_id=%s limit 1",
        (recipe_id,),
    )
    return cur.fetchone() is not None
