from fastapi import APIRouter
from pydantic import BaseModel
from ..services import recipe_rules as recipe_rules_service

router = APIRouter()


class RuleCreate(BaseModel):
    recipe_id: str
    scope: str
    target_supply_id: str | None = None
    condition_var: str
    operator: str
    condition_value: str
    effect_type: str
    effect_value: float


@router.post("/recipe-rules")
def add_rule(payload: RuleCreate):
    return recipe_rules_service.add_rule(
        payload.recipe_id,
        payload.scope,
        payload.target_supply_id,
        payload.condition_var,
        payload.operator,
        payload.condition_value,
        payload.effect_type,
        payload.effect_value,
    )


@router.get("/recipe-rules")
def list_rules(recipe_id: str):
    return recipe_rules_service.list_rules(recipe_id)


class RuleUpdate(BaseModel):
    recipe_id: str
    scope: str
    target_supply_id: str | None = None
    condition_var: str
    operator: str
    condition_value: str
    effect_type: str
    effect_value: float


@router.put("/recipe-rules/{rule_id}")
def update_rule(rule_id: str, payload: RuleUpdate):
    return recipe_rules_service.update_rule(
        rule_id,
        payload.recipe_id,
        payload.scope,
        payload.target_supply_id,
        payload.condition_var,
        payload.operator,
        payload.condition_value,
        payload.effect_type,
        payload.effect_value,
    )


@router.delete("/recipe-rules/{rule_id}")
def delete_rule(rule_id: str):
    return recipe_rules_service.delete_rule(rule_id)
