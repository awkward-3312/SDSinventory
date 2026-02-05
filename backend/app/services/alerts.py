from ..db import get_conn
from ..repositories import alerts as alerts_repo


def list_low_stock():
    with get_conn() as conn:
        with conn.cursor() as cur:
            rows = alerts_repo.list_low_stock(cur)

    return [
        {
            "supply_id": str(r[0]),
            "name": r[1],
            "unit_base": r[2],
            "stock_on_hand": round(float(r[3]), 6),
            "stock_min": round(float(r[4]), 6),
            "avg_unit_cost": round(float(r[5]), 6),
            "active": bool(r[6]),
        }
        for r in rows
    ]
