from fastapi import APIRouter
from pydantic import BaseModel
from ..services import sales as sales_service

router = APIRouter()


class SaleLine(BaseModel):
    product_id: str
    recipe_id: str
    qty: float = 1
    sale_price: float | None = None
    width: float | None = None
    height: float | None = None


class SaleCreate(BaseModel):
    customer_name: str | None = None
    notes: str | None = None
    currency: str = "HNL"
    margin: float = 0.4
    lines: list[SaleLine]


@router.post("/sales")
def create_sale(payload: SaleCreate):
    return sales_service.create_sale(payload)


@router.get("/sales")
def list_sales(limit: int = 50, offset: int = 0):
    return sales_service.list_sales(limit=limit, offset=offset)


@router.get("/sales/summary")
def sales_summary(include_voided: bool = False, period: str = "7d"):
    return sales_service.sales_summary(include_voided=include_voided, period=period)


@router.get("/sales/{sale_id}")
def get_sale_detail(sale_id: str):
    return sales_service.get_sale_detail(sale_id)


class VoidSaleBody(BaseModel):
    reason: str | None = None


@router.post("/sales/{sale_id}/void")
def void_sale(sale_id: str, payload: VoidSaleBody):
    return sales_service.void_sale(sale_id, payload.reason)
