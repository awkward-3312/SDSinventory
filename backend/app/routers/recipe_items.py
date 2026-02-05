from fastapi import APIRouter
from pydantic import BaseModel
from ..services import recipe_items as recipe_items_service

router = APIRouter()


class RecipeItemCreate(BaseModel):
    recipe_id: str
    supply_id: str
    qty_base: float
    waste_pct: float = 0
    qty_formula: str | None = None


@router.post("/recipe-items")
def add_recipe_item(payload: RecipeItemCreate):
    return recipe_items_service.add_recipe_item(
        payload.recipe_id,
        payload.supply_id,
        payload.qty_base,
        payload.waste_pct,
        payload.qty_formula,
    )


@router.get("/recipe-items")
def list_recipe_items(recipe_id: str):
    return recipe_items_service.list_recipe_items(recipe_id)


class RecipeItemUpdate(BaseModel):
    recipe_id: str
    supply_id: str
    qty_base: float
    waste_pct: float = 0
    qty_formula: str | None = None


@router.put("/recipe-items/{item_id}")
def update_recipe_item(item_id: str, payload: RecipeItemUpdate):
    return recipe_items_service.update_recipe_item(
        item_id,
        payload.recipe_id,
        payload.supply_id,
        payload.qty_base,
        payload.waste_pct,
        payload.qty_formula,
    )


@router.delete("/recipe-items/{item_id}")
def delete_recipe_item(item_id: str):
    return recipe_items_service.delete_recipe_item(item_id)
