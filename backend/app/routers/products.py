from fastapi import APIRouter
from pydantic import BaseModel
from ..services import products as products_service

router = APIRouter()


class ProductCreate(BaseModel):
    name: str
    product_type: str = "fixed"
    category: str | None = None
    unit_sale: str | None = None
    margin_target: float | None = None


@router.post("/products")
def create_product(payload: ProductCreate):
    return products_service.create_product(
        payload.name,
        payload.product_type,
        payload.category,
        payload.unit_sale,
        payload.margin_target,
    )


@router.get("/products")
def list_products(include_inactive: bool = False):
    return products_service.list_products(include_inactive=include_inactive)


@router.get("/products/{product_id}")
def get_product(product_id: str):
    return products_service.get_product(product_id)


class ProductUpdate(BaseModel):
    name: str
    product_type: str = "fixed"
    category: str | None = None
    unit_sale: str | None = None
    margin_target: float | None = None


@router.put("/products/{product_id}")
def update_product(product_id: str, payload: ProductUpdate):
    return products_service.update_product(
        product_id,
        payload.name,
        payload.product_type,
        payload.category,
        payload.unit_sale,
        payload.margin_target,
    )


class ProductActiveUpdate(BaseModel):
    active: bool


@router.patch("/products/{product_id}/active")
def set_product_active(product_id: str, payload: ProductActiveUpdate):
    return products_service.set_product_active(product_id, payload.active)


@router.delete("/products/{product_id}")
def delete_product(product_id: str):
    return products_service.set_product_active(product_id, False)
