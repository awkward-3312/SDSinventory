def insert_recipe_variable(cur, recipe_id: str, code: str, label: str, min_value, max_value, default_value):
    cur.execute(
        """
        insert into public.recipe_variables
        (recipe_id, code, label, min_value, max_value, default_value)
        values (%s, %s, %s, %s, %s, %s)
        returning id, recipe_id, code, label, min_value, max_value, default_value, created_at
        """,
        (recipe_id, code, label, min_value, max_value, default_value),
    )
    return cur.fetchone()


def list_recipe_variables(cur, recipe_id: str):
    cur.execute(
        """
        select id, recipe_id, code, label, min_value, max_value, default_value, created_at
        from public.recipe_variables
        where recipe_id = %s
        order by created_at asc
        """,
        (recipe_id,),
    )
    return cur.fetchall()


def update_recipe_variable(cur, var_id: str, recipe_id: str, code: str, label: str, min_value, max_value, default_value):
    cur.execute(
        """
        update public.recipe_variables
        set recipe_id = %s,
            code = %s,
            label = %s,
            min_value = %s,
            max_value = %s,
            default_value = %s
        where id = %s
        returning id, recipe_id, code, label, min_value, max_value, default_value, created_at
        """,
        (recipe_id, code, label, min_value, max_value, default_value, var_id),
    )
    return cur.fetchone()


def delete_recipe_variable(cur, var_id: str):
    cur.execute("delete from public.recipe_variables where id = %s", (var_id,))
    return cur.rowcount > 0
