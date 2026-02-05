def insert_product(cur, name: str, product_type: str):
    cur.execute(
        """
        insert into public.products (name, product_type)
        values (%s, %s)
        returning id, name, active, created_at, product_type
        """,
        (name, product_type),
    )
    return cur.fetchone()


def list_products(cur, include_inactive: bool = False):
    where_sql = "" if include_inactive else "where active = true"
    cur.execute(
        f"""
        select id, name, active, created_at, product_type
        from public.products
        {where_sql}
        order by created_at desc;
        """
    )
    return cur.fetchall()


def update_product(cur, product_id: str, name: str, product_type: str):
    cur.execute(
        """
        update public.products
        set name=%s,
            product_type=%s
        where id=%s
        returning id, name, active, created_at, product_type
        """,
        (name, product_type, product_id),
    )
    return cur.fetchone()


def get_product(cur, product_id: str):
    cur.execute(
        """
        select id, name, active, created_at, product_type
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
