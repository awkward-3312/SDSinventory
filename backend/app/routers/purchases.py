from fastapi import APIRouter
from pydantic import BaseModel
from ..services import purchases as purchases_service

router = APIRouter()


class PurchaseCreate(BaseModel):
    supply_id: str
    presentation_id: str
    packs_qty: float
    total_cost: float
    supplier_name: str | None = None


@router.post("/purchases")
def create_purchase(payload: PurchaseCreate):
    return purchases_service.create_purchase(
        payload.supply_id,
        payload.presentation_id,
        payload.packs_qty,
        payload.total_cost,
        payload.supplier_name,
    )
