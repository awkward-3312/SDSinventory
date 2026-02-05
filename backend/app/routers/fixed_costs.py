from fastapi import APIRouter
from pydantic import BaseModel
from ..services import fixed_costs as fixed_costs_service

router = APIRouter()


class PeriodCreate(BaseModel):
    year: int
    month: int
    estimated_orders: float
    currency: str = "HNL"
    active: bool = False


@router.post("/fixed-costs/periods")
def create_period(payload: PeriodCreate):
    return fixed_costs_service.create_period(
        payload.year,
        payload.month,
        payload.estimated_orders,
        payload.currency,
        payload.active,
    )


@router.get("/fixed-costs/periods")
def list_periods():
    return fixed_costs_service.list_periods()


@router.get("/fixed-costs/periods/{period_id}")
def get_period(period_id: str):
    return fixed_costs_service.get_period(period_id)


class PeriodActiveUpdate(BaseModel):
    active: bool


@router.patch("/fixed-costs/periods/{period_id}/active")
def set_period_active(period_id: str, payload: PeriodActiveUpdate):
    return fixed_costs_service.set_period_active(period_id, payload.active)


class CostItemCreate(BaseModel):
    period_id: str
    name: str
    amount: float


@router.post("/fixed-costs/items")
def add_cost_item(payload: CostItemCreate):
    return fixed_costs_service.add_cost_item(payload.period_id, payload.name, payload.amount)


@router.get("/fixed-costs/items")
def list_cost_items(period_id: str):
    return fixed_costs_service.list_cost_items(period_id)


@router.delete("/fixed-costs/items/{item_id}")
def delete_cost_item(item_id: str):
    return fixed_costs_service.delete_cost_item(item_id)


@router.get("/fixed-costs/periods/{period_id}/summary")
def period_summary(period_id: str):
    return fixed_costs_service.period_summary(period_id)


@router.get("/fixed-costs/summary/active")
def active_period_summary():
    return fixed_costs_service.active_period_summary()
