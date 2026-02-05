def insert_product(cur, name: str, product_type: str, category: str | None, unit_sale: str | None, margin_target: float):
    cur.execute(
        """
        insert into public.products (name, product_type, category, unit_sale, margin_target)
        values (%s, %s, %s, %s, %s)
        returning id, name, active, created_at, product_type, category, unit_sale, margin_target
        """,
        (name, product_type, category, unit_sale, margin_target),
    )
    return cur.fetchone()


def list_products(cur, include_inactive: bool = False):
    where_sql = "" if include_inactive else "where active = true"
    cur.execute(
        f"""
        select id, name, active, created_at, product_type, category, unit_sale, margin_target
        from public.products
        {where_sql}
        order by created_at desc;
        """
    )
    return cur.fetchall()


def update_product(
    cur,
    product_id: str,
    name: str,
    product_type: str,
    category: str | None,
    unit_sale: str | None,
    margin_target: float | None,
):
    cur.execute(
        """
        update public.products
        set name=%s,
            product_type=%s,
            category=%s,
            unit_sale=%s,
            margin_target=coalesce(%s, margin_target)
        where id=%s
        returning id, name, active, created_at, product_type, category, unit_sale, margin_target
        """,
        (name, product_type, category, unit_sale, margin_target, product_id),
    )
    return cur.fetchone()


def get_product(cur, product_id: str):
    cur.execute(
        """
        select id, name, active, created_at, product_type, category, unit_sale, margin_target
        from public.products
        where id=%s
        """,
        (product_id,),
    )
    return cur.fetchone()


def set_product_active(cur, product_id: str, active: bool):
    cur.execute(
        """
        update public.products
        set active=%s
        where id=%s
        returning id, active
        """,
        (active, product_id),
    )
    return cur.fetchone()


def update_product_margin(cur, product_id: str, margin_target: float):
    cur.execute(
        """
        update public.products
        set margin_target=%s
        where id=%s
        returning id, margin_target
        """,
        (margin_target, product_id),
    )
    return cur.fetchone()
