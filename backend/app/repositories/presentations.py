def insert_presentation(cur, supply_id: str, name: str, units_in_base: float):
    cur.execute(
        """
        insert into public.presentations (supply_id, name, units_in_base)
        values (%s, %s, %s)
        returning id, supply_id, name, units_in_base, created_at
        """,
        (supply_id, name, units_in_base),
    )
    return cur.fetchone()


def list_presentations(cur):
    cur.execute(
        """
        select p.id, p.supply_id, s.name as supply_name,
               p.name, p.units_in_base, p.created_at
        from public.presentations p
        join public.supplies s on s.id = p.supply_id
        order by p.created_at desc;
        """
    )
    return cur.fetchall()


def get_presentation_units(cur, presentation_id: str):
    cur.execute("select units_in_base from public.presentations where id=%s", (presentation_id,))
    return cur.fetchone()
