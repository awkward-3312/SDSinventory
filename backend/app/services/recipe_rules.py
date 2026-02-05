from fastapi import HTTPException
from ..db import get_conn
from ..repositories import recipe_rules as recipe_rules_repo


ALLOWED_SCOPES = {"global", "supply"}
ALLOWED_OPERATORS = {"==", "!=", ">", "<", ">=", "<="}
ALLOWED_EFFECTS = {"multiplier", "add_qty"}


def _validate_rule(scope: str, target_supply_id: str | None, operator: str, effect_type: str, effect_value: float):
    if scope not in ALLOWED_SCOPES:
        raise HTTPException(status_code=400, detail="scope inválido (global|supply)")
    if scope == "supply" and not target_supply_id:
        raise HTTPException(status_code=400, detail="target_supply_id es requerido para scope=supply")
    if operator not in ALLOWED_OPERATORS:
        raise HTTPException(status_code=400, detail="operator inválido")
    if effect_type not in ALLOWED_EFFECTS:
        raise HTTPException(status_code=400, detail="effect_type inválido")
    if effect_type == "multiplier" and float(effect_value) <= 0:
        raise HTTPException(status_code=400, detail="effect_value debe ser > 0")


def add_rule(
    recipe_id: str,
    scope: str,
    target_supply_id: str | None,
    condition_var: str,
    operator: str,
    condition_value: str,
    effect_type: str,
    effect_value: float,
):
    if not condition_var.strip():
        raise HTTPException(status_code=400, detail="condition_var es requerido")
    if not condition_value.strip():
        raise HTTPException(status_code=400, detail="condition_value es requerido")
    _validate_rule(scope, target_supply_id, operator, effect_type, effect_value)

    with get_conn() as conn:
        with conn.cursor() as cur:
            row = recipe_rules_repo.insert_recipe_rule(
                cur,
                recipe_id,
                scope,
                target_supply_id,
                condition_var.strip(),
                operator.strip(),
                condition_value.strip(),
                effect_type.strip(),
                effect_value,
            )
        conn.commit()
    return {
        "id": str(row[0]),
        "recipe_id": str(row[1]),
        "scope": row[2],
        "target_supply_id": row[3],
        "condition_var": row[4],
        "operator": row[5],
        "condition_value": row[6],
        "effect_type": row[7],
        "effect_value": float(row[8]),
        "created_at": row[9],
    }


def list_rules(recipe_id: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            rows = recipe_rules_repo.list_recipe_rules(cur, recipe_id)
    return [
        {
            "id": str(r[0]),
            "recipe_id": str(r[1]),
            "scope": r[2],
            "target_supply_id": r[3],
            "condition_var": r[4],
            "operator": r[5],
            "condition_value": r[6],
            "effect_type": r[7],
            "effect_value": float(r[8]),
            "created_at": r[9],
        }
        for r in rows
    ]


def update_rule(
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
    if not condition_var.strip():
        raise HTTPException(status_code=400, detail="condition_var es requerido")
    if not condition_value.strip():
        raise HTTPException(status_code=400, detail="condition_value es requerido")
    _validate_rule(scope, target_supply_id, operator, effect_type, effect_value)

    with get_conn() as conn:
        with conn.cursor() as cur:
            row = recipe_rules_repo.update_recipe_rule(
                cur,
                rule_id,
                recipe_id,
                scope,
                target_supply_id,
                condition_var.strip(),
                operator.strip(),
                condition_value.strip(),
                effect_type.strip(),
                effect_value,
            )
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="rule_id no existe")
    return {
        "id": str(row[0]),
        "recipe_id": str(row[1]),
        "scope": row[2],
        "target_supply_id": row[3],
        "condition_var": row[4],
        "operator": row[5],
        "condition_value": row[6],
        "effect_type": row[7],
        "effect_value": float(row[8]),
        "created_at": row[9],
    }


def delete_rule(rule_id: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            ok = recipe_rules_repo.delete_recipe_rule(cur, rule_id)
        conn.commit()
    if not ok:
        raise HTTPException(status_code=404, detail="rule_id no existe")
    return {"ok": True, "id": rule_id}
