import math
import time
from fastapi import HTTPException
from ..db import get_conn


DEFAULT_PIECE_CODES = {
    "unidad",
    "pieza",
    "unidad/pieza",
    "unit",
    "units",
    "piece",
    "pieces",
    "u",
    "ud",
    "uds",
    "pz",
    "pza",
    "pzas",
    "pc",
    "pcs",
}

_CACHE_TTL_SEC = 60
_cached_codes: set[str] | None = None
_cached_at: float = 0.0


def _load_piece_codes_from_db() -> set[str]:
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("select code from public.piece_unit_codes")
            rows = cur.fetchall()
    return {str(r[0]).strip().lower() for r in rows if r and r[0]}


def get_piece_unit_codes() -> set[str]:
    global _cached_codes, _cached_at
    now = time.monotonic()
    if _cached_codes is not None and (now - _cached_at) < _CACHE_TTL_SEC:
        return _cached_codes
    try:
        codes = _load_piece_codes_from_db()
        if not codes:
            codes = set(DEFAULT_PIECE_CODES)
    except Exception:
        codes = set(DEFAULT_PIECE_CODES)
    _cached_codes = codes
    _cached_at = now
    return codes


def is_piece_unit(unit_code: str | None, unit_name: str | None) -> bool:
    code = (unit_code or "").strip().lower()
    name = (unit_name or "").strip().lower()
    codes = get_piece_unit_codes()
    if code in codes:
        return True
    if name in codes:
        return True
    return False


def apply_waste(qty: float, waste_pct: float, unit_code: str | None, unit_name: str | None) -> float:
    waste = float(waste_pct)
    if waste < 0:
        raise HTTPException(status_code=400, detail="waste_pct debe ser >= 0")
    if waste == 0:
        return float(qty)

    if is_piece_unit(unit_code, unit_name):
        if waste >= 100:
            raise HTTPException(status_code=400, detail="waste_pct debe ser < 100 para unidades por pieza")
        # merma como rendimiento real para piezas (redondeo hacia arriba)
        return float(math.ceil(float(qty) / (1 - waste / 100.0)))

    return float(qty) * (1 + waste / 100.0)
