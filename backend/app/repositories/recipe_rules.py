def insert_recipe_rule(
    cur,
    recipe_id: str,
    scope: str,
    target_supply_id: str | None,
    condition_var: str,
    operator: str,
    condition_value: str,
    effect_type: str,
    effect_value: float,
):
    cur.execute(
        """
        insert into public.recipe_rules
        (recipe_id, scope, target_supply_id, condition_var, operator, condition_value, effect_type, effect_value)
        values (%s,%s,%s,%s,%s,%s,%s,%s)
        returning id, recipe_id, scope, target_supply_id, condition_var, operator,
                  condition_value, effect_type, effect_value, created_at
        """,
        (
            recipe_id,
            scope,
            target_supply_id,
            condition_var,
            operator,
            condition_value,
            effect_type,
            effect_value,
        ),
    )
    return cur.fetchone()


def list_recipe_rules(cur, recipe_id: str):
    cur.execute(
        """
        select id, recipe_id, scope, target_supply_id, condition_var, operator,
               condition_value, effect_type, effect_value, created_at
        from public.recipe_rules
        where recipe_id = %s
        order by created_at asc
        """,
        (recipe_id,),
    )
    return cur.fetchall()


def update_recipe_rule(
    cur,
    rule_id: str,
    recipe_id: str,
    scope: str,
    target_supply_id: str | None,
    condition_var: str,
    operator: str,
    condition_value: str,
    effect_type: str,
    effect_value: float,
):
    cur.execute(
        """
        update public.recipe_rules
        set recipe_id = %s,
            scope = %s,
            target_supply_id = %s,
            condition_var = %s,
            operator = %s,
            condition_value = %s,
            effect_type = %s,
            effect_value = %s
        where id = %s
        returning id, recipe_id, scope, target_supply_id, condition_var, operator,
                  condition_value, effect_type, effect_value, created_at
        """,
        (
            recipe_id,
            scope,
            target_supply_id,
            condition_var,
            operator,
            condition_value,
            effect_type,
            effect_value,
            rule_id,
        ),
    )
    return cur.fetchone()


def delete_recipe_rule(cur, rule_id: str):
    cur.execute("delete from public.recipe_rules where id = %s", (rule_id,))
    return cur.rowcount > 0
