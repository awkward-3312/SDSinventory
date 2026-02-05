from ..db import get_conn
from ..repositories import movements as movements_repo


def _round2(x: float) -> float:
    return round(float(x), 2)


def list_movements(supply_id: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            rows = movements_repo.list_movements(cur, supply_id)
    return [
        {
            "id": str(r[0]),
            "movement_type": r[1],
            "qty_base": float(r[2]),
            "unit_cost_snapshot": float(r[3]),
            "ref_type": r[4],
            "ref_id": str(r[5]),
            "created_at": r[6],
        }
        for r in rows
    ]


def movements_summary(supply_id: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            row = movements_repo.summary_movements(cur, supply_id)

    total_in = float(row[0])
    total_out = float(row[1])
    return {
        "supply_id": supply_id,
        "total_in": _round2(total_in),
        "total_out": _round2(total_out),
        "balance": _round2(total_in - total_out),
    }
