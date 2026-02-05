from fastapi import APIRouter
from ..db import check_db

router = APIRouter()


@router.get("/health")
def health():
    return {"ok": True}


@router.get("/db-health")
def db_health():
    result = check_db()
    return {"db": "ok", "result": result}
