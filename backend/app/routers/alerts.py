from fastapi import APIRouter
from ..services import alerts as alerts_service

router = APIRouter()


@router.get("/alerts/low-stock")
def low_stock_alerts():
    return alerts_service.list_low_stock()
