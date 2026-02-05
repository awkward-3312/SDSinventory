from ..db import get_conn
from ..repositories import units as units_repo


def list_units():
    with get_conn() as conn:
        with conn.cursor() as cur:
            rows = units_repo.list_units(cur)
    return [{"id": str(r[0]), "code": r[1], "name": r[2]} for r in rows]
