from fastapi import APIRouter
from pydantic import BaseModel
from ..services import recipe_options as recipe_options_service

router = APIRouter()


class OptionCreate(BaseModel):
    recipe_id: str
    code: str
    label: str


@router.post("/recipe-options")
def create_option(payload: OptionCreate):
    return recipe_options_service.create_option(payload.recipe_id, payload.code, payload.label)


@router.get("/recipe-options")
def list_options(recipe_id: str):
    return recipe_options_service.list_options(recipe_id)


@router.get("/recipe-options/with-values")
def options_with_values(recipe_id: str):
    return recipe_options_service.options_with_values(recipe_id)


class OptionUpdate(BaseModel):
    recipe_id: str
    code: str
    label: str


@router.put("/recipe-options/{option_id}")
def update_option(option_id: str, payload: OptionUpdate):
    return recipe_options_service.update_option(option_id, payload.recipe_id, payload.code, payload.label)


@router.delete("/recipe-options/{option_id}")
def delete_option(option_id: str):
    return recipe_options_service.delete_option(option_id)


class OptionValueCreate(BaseModel):
    option_id: str
    value_key: str
    label: str
    numeric_value: float = 0


@router.post("/recipe-option-values")
def add_option_value(payload: OptionValueCreate):
    return recipe_options_service.add_option_value(
        payload.option_id, payload.value_key, payload.label, payload.numeric_value
    )


@router.get("/recipe-option-values")
def list_option_values(option_id: str):
    return recipe_options_service.list_option_values(option_id)


class OptionValueUpdate(BaseModel):
    option_id: str
    value_key: str
    label: str
    numeric_value: float = 0


@router.put("/recipe-option-values/{value_id}")
def update_option_value(value_id: str, payload: OptionValueUpdate):
    return recipe_options_service.update_option_value(
        value_id, payload.option_id, payload.value_key, payload.label, payload.numeric_value
    )


@router.delete("/recipe-option-values/{value_id}")
def delete_option_value(value_id: str):
    return recipe_options_service.delete_option_value(value_id)
