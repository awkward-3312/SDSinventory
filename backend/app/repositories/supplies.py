def insert_supply(cur, name: str, unit_base_id: int, stock_min: float):
    cur.execute(
        """
        insert into public.supplies (name, unit_base_id, stock_min)
        values (%s, %s, %s)
        returning id, name, unit_base_id, stock_on_hand, stock_min, avg_unit_cost, created_at, active
        """,
        (name, unit_base_id, stock_min),
    )
    return cur.fetchone()


def list_supplies(cur, include_inactive: bool = False):
    where_sql = "" if include_inactive else "where s.active = true"
    cur.execute(
        f"""
        select s.id, s.name, u.code as unit_code,
               s.stock_on_hand, s.stock_min, s.avg_unit_cost, s.active
        from public.supplies s
        join public.units u on u.id = s.unit_base_id
        {where_sql}
        order by s.created_at desc;
        """
    )
    return cur.fetchall()


def update_supply(cur, supply_id: str, name: str, unit_base_id: int, stock_min: float):
    cur.execute(
        """
        update public.supplies
        set name=%s,
            unit_base_id=%s,
            stock_min=%s
        where id=%s
        returning id, name, unit_base_id, stock_on_hand, stock_min, avg_unit_cost, created_at, active
        """,
        (name, unit_base_id, stock_min, supply_id),
    )
    return cur.fetchone()


def set_supply_active(cur, supply_id: str, active: bool):
    cur.execute(
        """
        update public.supplies
        set active=%s
        where id=%s
        returning id, active
        """,
        (active, supply_id),
    )
    return cur.fetchone()
