def lock_sequence(cur, year: int):
    cur.execute(
        "select last_number from public.quote_number_sequence where year = %s for update",
        (year,),
    )
    return cur.fetchone()


def insert_sequence(cur, year: int):
    cur.execute(
        "insert into public.quote_number_sequence (year, last_number) values (%s, 0)",
        (year,),
    )


def update_sequence(cur, year: int, last_number: int):
    cur.execute(
        "update public.quote_number_sequence set last_number = %s where year = %s",
        (last_number, year),
    )


def insert_quote(
    cur,
    quote_number: str,
    status: str,
    valid_until,
    customer_name,
    notes,
    currency,
    margin,
    materials_cost_total,
    operational_cost_total,
    total_cost,
    total_price,
    total_profit,
    fixed_cost_period_id,
):
    cur.execute(
        """
        insert into public.quotes
        (quote_number, status, valid_until, customer_name, notes, currency, margin,
         materials_cost_total, operational_cost_total, total_cost, total_price, total_profit, fixed_cost_period_id)
        values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        returning id
        """,
        (
            quote_number,
            status,
            valid_until,
            customer_name,
            notes,
            currency,
            margin,
            materials_cost_total,
            operational_cost_total,
            total_cost,
            total_price,
            total_profit,
            fixed_cost_period_id,
        ),
    )
    return cur.fetchone()[0]


import json


def insert_quote_item(
    cur,
    quote_id,
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
        insert into public.quote_items
        (quote_id, product_id, recipe_id, qty, materials_cost, suggested_price, sale_price,
         profit, var_width, var_height, var_payload)
        values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        returning id
        """,
        (
            quote_id,
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


def insert_status_history(cur, quote_id, status: str, notes: str | None, changed_by: str | None):
    cur.execute(
        """
        insert into public.quote_status_history (quote_id, status, notes, changed_by)
        values (%s, %s, %s, %s)
        """,
        (quote_id, status, notes, changed_by),
    )


def list_quotes(cur, limit: int, offset: int, status: str | None):
    where_sql = ""
    params = [limit, offset]
    if status:
        where_sql = "where status = %s"
        params = [status, limit, offset]
    cur.execute(
        f"""
        select id, quote_number, status, valid_until, customer_name,
               currency, total_price, total_cost, total_profit, created_at
        from public.quotes
        {where_sql}
        order by created_at desc
        limit %s offset %s
        """,
        tuple(params),
    )
    return cur.fetchall()


def get_quote(cur, quote_id: str):
    cur.execute(
        """
        select id, quote_number, status, valid_until, customer_name, notes,
               currency, margin, materials_cost_total, operational_cost_total,
               total_cost, total_price, total_profit, fixed_cost_period_id, converted_sale_id, created_at
        from public.quotes
        where id = %s
        """,
        (quote_id,),
    )
    return cur.fetchone()


def list_quote_items(cur, quote_id: str):
    cur.execute(
        """
        select id, product_id, recipe_id, qty, materials_cost, suggested_price,
               sale_price, profit, var_width, var_height, var_payload, created_at
        from public.quote_items
        where quote_id = %s
        order by created_at asc
        """,
        (quote_id,),
    )
    return cur.fetchall()


def update_quote_status(cur, quote_id: str, status: str):
    cur.execute(
        """
        update public.quotes
        set status = %s
        where id = %s
        """,
        (status, quote_id),
    )


def mark_quote_converted(cur, quote_id: str, sale_id: str):
    cur.execute(
        """
        update public.quotes
        set status = 'converted',
            converted_sale_id = %s
        where id = %s
        """,
        (sale_id, quote_id),
    )
