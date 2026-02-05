def list_low_stock(cur):
    cur.execute(
        """
        select s.id, s.name, u.code as unit_code,
               s.stock_on_hand, s.stock_min, s.avg_unit_cost, s.active
        from public.supplies s
        join public.units u on u.id = s.unit_base_id
        where s.stock_on_hand <= s.stock_min
          and s.active = true
        order by (s.stock_on_hand - s.stock_min) asc, s.name asc;
        """
    )
    return cur.fetchall()
