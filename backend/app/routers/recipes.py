from fastapi import APIRouter
from pydantic import BaseModel
from ..services import recipes as recipes_service

router = APIRouter()


class RecipeCreate(BaseModel):
    product_id: str
    name: str = "Base"


@router.post("/recipes")
def create_recipe(payload: RecipeCreate):
    return recipes_service.create_recipe(payload.product_id, payload.name)


@router.get("/recipes")
def list_recipes(product_id: str):
    return recipes_service.list_recipes(product_id)


@router.get("/recipes/{recipe_id}")
def get_recipe(recipe_id: str):
    return recipes_service.get_recipe(recipe_id)

class RecipeUpdate(BaseModel):
    name: str


@router.put("/recipes/{recipe_id}")
def update_recipe(recipe_id: str, payload: RecipeUpdate):
    return recipes_service.update_recipe(recipe_id, payload.name)


@router.delete("/recipes/{recipe_id}")
def delete_recipe(recipe_id: str):
    return recipes_service.delete_recipe(recipe_id)


@router.get("/recipes/{recipe_id}/cost")
def recipe_cost(recipe_id: str, width: float | None = None, height: float | None = None):
    return recipes_service.recipe_cost(recipe_id, width=width, height=height)


class RecipeCostBody(BaseModel):
    width: float | None = None
    height: float | None = None
    vars: dict[str, float] | None = None
    opts: dict[str, str] | None = None
    strict: bool = False


@router.post("/recipes/{recipe_id}/cost")
def recipe_cost_post(recipe_id: str, payload: RecipeCostBody):
    return recipes_service.recipe_cost(
        recipe_id,
        width=payload.width,
        height=payload.height,
        vars_payload=payload.vars,
        opts_payload=payload.opts,
        strict=payload.strict,
    )


@router.get("/recipes/{recipe_id}/suggested-price")
def suggested_price(
    recipe_id: str,
    value: float = 0.4,
    mode: str = "margin",
    width: float | None = None,
    height: float | None = None,
):
    return recipes_service.suggested_price(recipe_id, value=value, mode=mode, width=width, height=height)


class RecipeMarginUpdate(BaseModel):
    margin_target: float
    apply_to_product: bool = True


@router.patch("/recipes/{recipe_id}/margin")
def update_recipe_margin(recipe_id: str, payload: RecipeMarginUpdate):
    return recipes_service.update_recipe_margin(recipe_id, payload.margin_target, payload.apply_to_product)
