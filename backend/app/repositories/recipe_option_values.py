def insert_option_value(cur, option_id: str, value_key: str, label: str, numeric_value: float):
    cur.execute(
        """
        insert into public.recipe_option_values (option_id, value_key, label, numeric_value)
        values (%s, %s, %s, %s)
        returning id, option_id, value_key, label, numeric_value, created_at
        """,
        (option_id, value_key, label, numeric_value),
    )
    return cur.fetchone()


def list_option_values(cur, option_id: str):
    cur.execute(
        """
        select id, option_id, value_key, label, numeric_value, created_at
        from public.recipe_option_values
        where option_id = %s
        order by created_at asc
        """,
        (option_id,),
    )
    return cur.fetchall()


def update_option_value(cur, value_id: str, option_id: str, value_key: str, label: str, numeric_value: float):
    cur.execute(
        """
        update public.recipe_option_values
        set option_id = %s,
            value_key = %s,
            label = %s,
            numeric_value = %s
        where id = %s
        returning id, option_id, value_key, label, numeric_value, created_at
        """,
        (option_id, value_key, label, numeric_value, value_id),
    )
    return cur.fetchone()


def delete_option_value(cur, value_id: str):
    cur.execute("delete from public.recipe_option_values where id = %s", (value_id,))
    return cur.rowcount > 0
