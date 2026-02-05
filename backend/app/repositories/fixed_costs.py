def insert_period(cur, year: int, month: int, estimated_orders: float, currency: str, active: bool):
    cur.execute(
        """
        insert into public.fixed_cost_periods (year, month, estimated_orders, currency, active)
        values (%s, %s, %s, %s, %s)
        returning id, year, month, estimated_orders, currency, active, created_at
        """,
        (year, month, estimated_orders, currency, active),
    )
    return cur.fetchone()


def list_periods(cur):
    cur.execute(
        """
        select id, year, month, estimated_orders, currency, active, created_at
        from public.fixed_cost_periods
        order by year desc, month desc, created_at desc;
        """
    )
    return cur.fetchall()


def get_period(cur, period_id: str):
    cur.execute(
        """
        select id, year, month, estimated_orders, currency, active, created_at
        from public.fixed_cost_periods
        where id = %s
        """,
        (period_id,),
    )
    return cur.fetchone()


def set_active(cur, period_id: str, active: bool):
    cur.execute(
        """
        update public.fixed_cost_periods
        set active = %s
        where id = %s
        returning id, active
        """,
        (active, period_id),
    )
    return cur.fetchone()


def set_all_inactive(cur):
    cur.execute("update public.fixed_cost_periods set active = false")


def get_active_period(cur):
    cur.execute(
        """
        select id, year, month, estimated_orders, currency, active, created_at
        from public.fixed_cost_periods
        where active = true
        order by year desc, month desc, created_at desc
        limit 1
        """
    )
    return cur.fetchone()


def insert_cost_item(cur, period_id: str, name: str, amount: float):
    cur.execute(
        """
        insert into public.fixed_cost_items (period_id, name, amount)
        values (%s, %s, %s)
        returning id, period_id, name, amount, created_at
        """,
        (period_id, name, amount),
    )
    return cur.fetchone()


def list_cost_items(cur, period_id: str):
    cur.execute(
        """
        select id, period_id, name, amount, created_at
        from public.fixed_cost_items
        where period_id = %s
        order by created_at desc
        """,
        (period_id,),
    )
    return cur.fetchall()


def delete_cost_item(cur, item_id: str):
    cur.execute("delete from public.fixed_cost_items where id = %s", (item_id,))
    return cur.rowcount > 0


def sum_cost_items(cur, period_id: str):
    cur.execute(
        """
        select coalesce(sum(amount), 0)
        from public.fixed_cost_items
        where period_id = %s
        """,
        (period_id,),
    )
    return cur.fetchone()[0]
