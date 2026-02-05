from datetime import date
from fastapi import APIRouter
from pydantic import BaseModel
from ..services import quotes as quotes_service

router = APIRouter()


class QuoteLine(BaseModel):
    product_id: str
    recipe_id: str
    qty: float = 1
    sale_price: float | None = None
    width: float | None = None
    height: float | None = None
    vars: dict[str, float] | None = None
    opts: dict[str, str] | None = None


class QuoteCreate(BaseModel):
    customer_name: str | None = None
    notes: str | None = None
    currency: str = "HNL"
    margin: float = 0.4
    valid_until: date | None = None
    status: str | None = None
    lines: list[QuoteLine]


@router.post("/quotes")
def create_quote(payload: QuoteCreate):
    return quotes_service.create_quote(payload)


@router.get("/quotes")
def list_quotes(limit: int = 50, offset: int = 0, status: str | None = None):
    return quotes_service.list_quotes(limit=limit, offset=offset, status=status)


@router.get("/quotes/{quote_id}")
def get_quote_detail(quote_id: str):
    return quotes_service.get_quote_detail(quote_id)


class QuoteStatusUpdate(BaseModel):
    status: str
    notes: str | None = None
    changed_by: str | None = None


@router.post("/quotes/{quote_id}/status")
def update_quote_status(quote_id: str, payload: QuoteStatusUpdate):
    return quotes_service.update_quote_status(quote_id, payload.status, payload.notes, payload.changed_by)


@router.post("/quotes/{quote_id}/convert")
def convert_quote(quote_id: str):
    return quotes_service.convert_quote(quote_id)
