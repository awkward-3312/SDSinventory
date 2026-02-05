def insert_recipe_option(cur, recipe_id: str, code: str, label: str):
    cur.execute(
        """
        insert into public.recipe_options (recipe_id, code, label)
        values (%s, %s, %s)
        returning id, recipe_id, code, label, created_at
        """,
        (recipe_id, code, label),
    )
    return cur.fetchone()


def list_recipe_options(cur, recipe_id: str):
    cur.execute(
        """
        select id, recipe_id, code, label, created_at
        from public.recipe_options
        where recipe_id = %s
        order by created_at asc
        """,
        (recipe_id,),
    )
    return cur.fetchall()


def update_recipe_option(cur, option_id: str, recipe_id: str, code: str, label: str):
    cur.execute(
        """
        update public.recipe_options
        set recipe_id = %s,
            code = %s,
            label = %s
        where id = %s
        returning id, recipe_id, code, label, created_at
        """,
        (recipe_id, code, label, option_id),
    )
    return cur.fetchone()


def delete_recipe_option(cur, option_id: str):
    cur.execute("delete from public.recipe_options where id = %s", (option_id,))
    return cur.rowcount > 0


def list_options_with_values(cur, recipe_id: str):
    cur.execute(
        """
        select o.id, o.code, o.label, v.id, v.value_key, v.label, v.numeric_value
        from public.recipe_options o
        left join public.recipe_option_values v on v.option_id = o.id
        where o.recipe_id = %s
        order by o.created_at asc, v.created_at asc
        """,
        (recipe_id,),
    )
    return cur.fetchall()
