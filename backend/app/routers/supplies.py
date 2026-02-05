from fastapi import APIRouter
from pydantic import BaseModel
from ..services import supplies as supplies_service

router = APIRouter()


class SupplyCreate(BaseModel):
    name: str
    unit_base_id: int
    stock_min: float = 0


@router.post("/supplies")
def create_supply(payload: SupplyCreate):
    return supplies_service.create_supply(payload.name, payload.unit_base_id, payload.stock_min)


@router.get("/supplies")
def list_supplies(include_inactive: bool = False):
    return supplies_service.list_supplies(include_inactive=include_inactive)


class SupplyUpdate(BaseModel):
    name: str
    unit_base_id: int
    stock_min: float = 0


@router.put("/supplies/{supply_id}")
def update_supply(supply_id: str, payload: SupplyUpdate):
    return supplies_service.update_supply(supply_id, payload.name, payload.unit_base_id, payload.stock_min)


class SupplyActiveUpdate(BaseModel):
    active: bool


@router.patch("/supplies/{supply_id}/active")
def set_supply_active(supply_id: str, payload: SupplyActiveUpdate):
    return supplies_service.set_supply_active(supply_id, payload.active)


@router.delete("/supplies/{supply_id}")
def delete_supply(supply_id: str):
    return supplies_service.set_supply_active(supply_id, False)
