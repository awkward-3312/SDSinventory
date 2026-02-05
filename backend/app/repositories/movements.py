def list_movements(cur, supply_id: str):
    cur.execute(
        """
        select id, movement_type, qty_base, unit_cost_snapshot,
               ref_type, ref_id, created_at
        from public.inventory_movements
        where supply_id = %s
        order by created_at desc;
        """,
        (supply_id,),
    )
    return cur.fetchall()


def summary_movements(cur, supply_id: str):
    cur.execute(
        """
        select
          coalesce(sum(case when movement_type='IN' then qty_base else 0 end),0) as total_in,
          coalesce(sum(case when movement_type='OUT' then qty_base else 0 end),0) as total_out
        from public.inventory_movements
        where supply_id=%s
        """,
        (supply_id,),
    )
    return cur.fetchone()
