from fastapi import APIRouter
from ..services import movements as movements_service

router = APIRouter()


@router.get("/movements")
def list_movements(supply_id: str):
    return movements_service.list_movements(supply_id)


@router.get("/movements/summary")
def movements_summary(supply_id: str):
    return movements_service.movements_summary(supply_id)
