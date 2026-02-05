import os
from contextlib import contextmanager
from dotenv import load_dotenv
from fastapi import HTTPException
import psycopg

try:
    from psycopg_pool import ConnectionPool
except Exception:  # pragma: no cover
    ConnectionPool = None  # type: ignore

from .core.config import get_settings

load_dotenv()

_pool = None


def get_db_url() -> str:
    settings = get_settings()
    db_url = getattr(settings, "DATABASE_URL", None) or os.getenv("DATABASE_URL")
    if not db_url:
        raise HTTPException(status_code=500, detail="DATABASE_URL no configurado")
    return db_url


def get_pool():
    global _pool
    if ConnectionPool is None:
        return None
    if _pool is None:
        _pool = ConnectionPool(conninfo=get_db_url(), min_size=1, max_size=5, open=True)
    return _pool


@contextmanager
def get_conn():
    pool = get_pool()
    if pool is not None:
        with pool.connection() as conn:
            yield conn
    else:
        with psycopg.connect(get_db_url()) as conn:
            yield conn


def check_db():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("select 1;")
            return cur.fetchone()
