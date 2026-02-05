from fastapi import APIRouter
from ..services import units as units_service

router = APIRouter()


@router.get("/units")
def list_units():
    return units_service.list_units()
