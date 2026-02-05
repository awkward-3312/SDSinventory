from fastapi import APIRouter
from pydantic import BaseModel
from ..services import presentations as presentations_service

router = APIRouter()


class PresentationCreate(BaseModel):
    supply_id: str
    name: str
    units_in_base: float


@router.post("/presentations")
def create_presentation(payload: PresentationCreate):
    return presentations_service.create_presentation(payload.supply_id, payload.name, payload.units_in_base)


@router.get("/presentations")
def list_presentations():
    return presentations_service.list_presentations()
