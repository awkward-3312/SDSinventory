from ..db import get_conn
from ..repositories import presentations as presentations_repo


def create_presentation(supply_id: str, name: str, units_in_base: float):
    with get_conn() as conn:
        with conn.cursor() as cur:
            row = presentations_repo.insert_presentation(cur, supply_id, name.strip(), units_in_base)
        conn.commit()
    return {
        "id": str(row[0]),
        "supply_id": str(row[1]),
        "name": row[2],
        "units_in_base": float(row[3]),
        "created_at": row[4],
    }


def list_presentations():
    with get_conn() as conn:
        with conn.cursor() as cur:
            rows = presentations_repo.list_presentations(cur)
    return [
        {
            "id": str(r[0]),
            "supply_id": str(r[1]),
            "supply_name": r[2],
            "name": r[3],
            "units_in_base": float(r[4]),
            "created_at": r[5],
        }
        for r in rows
    ]
