from fastapi import APIRouter
from pydantic import BaseModel
from ..services import production as production_service

router = APIRouter()


class ProductionCreate(BaseModel):
    product_id: str
    recipe_id: str
    qty: float = 1


@router.post("/production")
def create_production(payload: ProductionCreate):
    return production_service.create_production(payload.product_id, payload.recipe_id, payload.qty)
