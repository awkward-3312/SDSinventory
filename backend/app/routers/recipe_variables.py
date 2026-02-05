from fastapi import APIRouter
from pydantic import BaseModel
from ..services import recipe_variables as recipe_variables_service

router = APIRouter()


class VariableCreate(BaseModel):
    recipe_id: str
    code: str
    label: str
    min_value: float | None = None
    max_value: float | None = None
    default_value: float | None = None


@router.post("/recipe-variables")
def add_variable(payload: VariableCreate):
    return recipe_variables_service.add_variable(
        payload.recipe_id,
        payload.code,
        payload.label,
        payload.min_value,
        payload.max_value,
        payload.default_value,
    )


@router.get("/recipe-variables")
def list_variables(recipe_id: str):
    return recipe_variables_service.list_variables(recipe_id)


class VariableUpdate(BaseModel):
    recipe_id: str
    code: str
    label: str
    min_value: float | None = None
    max_value: float | None = None
    default_value: float | None = None


@router.put("/recipe-variables/{var_id}")
def update_variable(var_id: str, payload: VariableUpdate):
    return recipe_variables_service.update_variable(
        var_id,
        payload.recipe_id,
        payload.code,
        payload.label,
        payload.min_value,
        payload.max_value,
        payload.default_value,
    )


@router.delete("/recipe-variables/{var_id}")
def delete_variable(var_id: str):
    return recipe_variables_service.delete_variable(var_id)
