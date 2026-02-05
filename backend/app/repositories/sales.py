def ensure_recipe_belongs(cur, recipe_id: str, product_id: str):
    cur.execute(
        "select 1 from public.recipes where id=%s and product_id=%s",
        (recipe_id, product_id),
    )
    return cur.fetchone()


def list_recipe_items_for_sale(cur, recipe_id: str):
    cur.execute(
        """
        select ri.supply_id, ri.qty_base, ri.waste_pct,
               s.avg_unit_cost, s.stock_on_hand, ri.qty_formula, u.code, u.name
        from public.recipe_items ri
        join public.supplies s on s.id = ri.supply_id
        join public.units u on u.id = s.unit_base_id
        where ri.recipe_id = %s
        """,
        (recipe_id,),
    )
    return cur.fetchall()


def lock_supply_for_update(cur, supply_id: str):
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


def insert_sale(
    cur,
    customer_name,
    notes,
    currency,
    margin,
    total_sale,
    total_cost,
    total_profit,
    total_materials,
    operational_cost,
    fixed_cost_period_id,
):
    cur.execute(
        """
        insert into public.sales
        (customer_name, notes, currency, margin, total_sale, total_cost, total_profit,
         materials_cost_total, operational_cost_total, fixed_cost_period_id)
        values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        returning id
        """,
        (
            customer_name,
            notes,
            currency,
            margin,
            total_sale,
            total_cost,
            total_profit,
            total_materials,
            operational_cost,
            fixed_cost_period_id,
        ),
    )
    return cur.fetchone()[0]


import json


def insert_sale_item(
    cur,
    sale_id,
    product_id,
    recipe_id,
    qty,
    materials_cost,
    suggested_price,
    sale_price,
    profit,
    var_width,
    var_height,
    var_payload,
):
    cur.execute(
        """
        insert into public.sale_items
        (sale_id, product_id, recipe_id, qty, materials_cost, suggested_price, sale_price, profit, var_width, var_height, var_payload)
        values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        returning id
        """,
        (
            sale_id,
            product_id,
            recipe_id,
            qty,
            materials_cost,
            suggested_price,
            sale_price,
            profit,
            var_width,
            var_height,
            json.dumps(var_payload) if var_payload is not None else None,
        ),
    )
    return cur.fetchone()[0]


def insert_sale_movement_out(cur, supply_id, qty_out, cost_u, sale_item_id):
    cur.execute(
        """
        insert into public.inventory_movements
        (supply_id, movement_type, qty_base, unit_cost_snapshot, ref_type, ref_id)
        values (%s,'OUT',%s,%s,'sale',%s)
        """,
        (supply_id, qty_out, cost_u, sale_item_id),
    )


def update_supply_stock(cur, supply_id, new_stock):
    cur.execute(
        "update public.supplies set stock_on_hand=%s where id=%s",
        (new_stock, supply_id),
    )


def list_sales(cur, limit: int, offset: int):
    cur.execute(
        """
        select
            s.id,
            s.created_at,
            s.customer_name,
            s.notes,
            s.currency,
            s.total_sale,
            s.total_cost,
            s.total_profit,
            s.materials_cost_total,
            s.operational_cost_total,
            s.margin,
            s.voided,
            s.voided_at,
            s.void_reason,
            s.voided_by
        from public.sales s
        order by s.created_at desc
        limit %s offset %s
        """,
        (limit, offset),
    )
    return cur.fetchall()


def sales_summary(cur, where_sql: str):
    cur.execute(
        f"""
        select
          coalesce(sum(total_sale),0) as total_sale,
          coalesce(sum(total_cost),0) as total_cost,
          coalesce(sum(total_profit),0) as total_profit,
          count(*) as count_sales
        from public.sales
        {where_sql}
        """
    )
    return cur.fetchone()


def get_sale_head(cur, sale_id: str):
    cur.execute(
        """
        select
            s.id,
            s.created_at,
            s.customer_name,
            s.notes,
            s.currency,
            s.total_sale,
            s.total_cost,
            s.total_profit,
            s.materials_cost_total,
            s.operational_cost_total,
            s.margin,
            s.voided,
            s.voided_at,
            s.void_reason,
            s.voided_by
        from public.sales s
        where s.id = %s
        """,
        (sale_id,),
    )
    return cur.fetchone()


def get_sale_items(cur, sale_id: str):
    cur.execute(
        """
        select
            si.id,
            si.product_id,
            p.name as product_name,
            si.recipe_id,
            r.name as recipe_name,
            si.qty,
            si.materials_cost,
            si.suggested_price,
            si.sale_price,
            si.profit,
            si.created_at,
            si.var_width,
            si.var_height
        from public.sale_items si
        left join public.products p on p.id = si.product_id
        left join public.recipes r on r.id = si.recipe_id
        where si.sale_id = %s
        order by si.created_at asc
        """,
        (sale_id,),
    )
    return cur.fetchall()


def get_sale_movements(cur, sale_id: str):
    cur.execute(
        """
        select
            im.id,
            im.supply_id,
            s.name as supply_name,
            u.code as unit_base,
            im.movement_type,
            im.qty_base,
            im.unit_cost_snapshot,
            im.ref_type,
            im.ref_id,
            im.created_at
        from public.inventory_movements im
        join public.supplies s on s.id = im.supply_id
        join public.units u on u.id = s.unit_base_id
        where im.ref_type in ('sale', 'sale_void')
          and im.ref_id in (
            select id from public.sale_items where sale_id = %s
          )
        order by im.created_at asc
        """,
        (sale_id,),
    )
    return cur.fetchall()


def lock_sale(cur, sale_id: str):
    cur.execute(
        """
        select id, voided_at
        from public.sales
        where id = %s
        for update
        """,
        (sale_id,),
    )
    return cur.fetchone()


def list_sale_out_movements(cur, sale_id: str):
    cur.execute(
        """
        select im.supply_id, im.qty_base, im.unit_cost_snapshot, im.ref_id
        from public.inventory_movements im
        where im.ref_type = 'sale'
          and im.movement_type = 'OUT'
          and im.ref_id in (
            select id from public.sale_items where sale_id = %s
          )
        """,
        (sale_id,),
    )
    return cur.fetchall()


def insert_sale_void_movement(cur, supply_id, qty_in, cost_u, ref_id):
    cur.execute(
        """
        insert into public.inventory_movements
        (supply_id, movement_type, qty_base, unit_cost_snapshot, ref_type, ref_id)
        values (%s,'IN',%s,%s,'sale_void',%s)
        returning id
        """,
        (supply_id, qty_in, cost_u, ref_id),
    )
    return cur.fetchone()[0]


def mark_sale_voided(cur, sale_id: str, reason: str | None):
    cur.execute(
        """
        update public.sales
        set voided = true,
            voided_at = now(),
            void_reason = %s
        where id = %s
        """,
        (reason, sale_id),
    )
