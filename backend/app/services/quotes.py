from datetime import date, timedelta
from types import SimpleNamespace
from fastapi import HTTPException
from ..db import get_conn
from ..repositories import quotes as quotes_repo
from . import recipes as recipes_service
from .fixed_costs import get_operational_cost_per_order
from .sales import create_sale as create_sale_service


def _round2(x: float) -> float:
    return round(float(x), 2)


ALLOWED_STATUSES = {"draft", "sent", "accepted", "rejected", "expired", "converted"}


def _next_quote_number(cur) -> str:
    year = date.today().year
    row = quotes_repo.lock_sequence(cur, year)
    if row is None:
        quotes_repo.insert_sequence(cur, year)
        last = 0
    else:
        last = int(row[0])
    new_num = last + 1
    quotes_repo.update_sequence(cur, year, new_num)
    return f"COT-{year}-{new_num:04d}"


def _allocate_operational(total_operational: float, line_materials: list[float]) -> list[float]:
    if not line_materials:
        return []
    total_materials = sum(line_materials)
    if total_materials <= 0:
        per = float(total_operational) / len(line_materials)
        return [per for _ in line_materials]
    return [float(total_operational) * (m / total_materials) for m in line_materials]


def create_quote(payload):
    try:
        if not payload.lines:
            raise HTTPException(status_code=400, detail="La cotización debe tener al menos 1 línea")
        if payload.margin < 0 or payload.margin >= 1:
            raise HTTPException(status_code=400, detail="margin debe estar entre 0 y < 1 (ej 0.4)")

        status = payload.status or "draft"
        if status not in ALLOWED_STATUSES:
            raise HTTPException(status_code=400, detail="status inválido")

        valid_until = payload.valid_until or (date.today() + timedelta(days=15))

        prepared_lines: list[dict] = []
        line_materials_list: list[float] = []
        total_materials = 0.0

        with get_conn() as conn:
            with conn.transaction():
                with conn.cursor() as cur:
                    quote_number = _next_quote_number(cur)

                    for line in payload.lines:
                        if float(line.qty) <= 0:
                            raise HTTPException(status_code=400, detail="qty debe ser > 0")

                        cost_data = recipes_service.compute_recipe_cost_strict(
                            line.recipe_id,
                            width=line.width,
                            height=line.height,
                            vars_payload=getattr(line, "vars", None),
                            opts_payload=getattr(line, "opts", None),
                        )
                        items = cost_data["items"]
                        if not items:
                            raise HTTPException(status_code=400, detail="La receta no tiene items")

                        unit_materials_cost = float(cost_data["materials_cost"])
                        line_materials_cost = unit_materials_cost * float(line.qty)

                        prepared_lines.append(
                            {
                                "product_id": line.product_id,
                                "recipe_id": line.recipe_id,
                                "qty": float(line.qty),
                                "materials_cost_total": float(line_materials_cost),
                                "materials_cost_unit": float(unit_materials_cost),
                                "width": line.width,
                                "height": line.height,
                                "sale_price_unit": float(line.sale_price) if line.sale_price is not None else None,
                                "vars": getattr(line, "vars", None),
                                "opts": getattr(line, "opts", None),
                            }
                        )

                        line_materials_list.append(float(line_materials_cost))
                        total_materials += line_materials_cost

                    operational_per_order, period_id = get_operational_cost_per_order()
                    operational_total = float(operational_per_order)

                    op_allocs = _allocate_operational(operational_total, line_materials_list)

                    total_sale = 0.0
                    for idx, pl in enumerate(prepared_lines):
                        op_alloc = float(op_allocs[idx]) if idx < len(op_allocs) else 0.0
                        unit_cost_for_price = float(pl["materials_cost_unit"]) + (
                            op_alloc / float(pl["qty"]) if float(pl["qty"]) > 0 else 0.0
                        )
                        suggested_unit = unit_cost_for_price / (1.0 - float(payload.margin))
                        sale_price_unit = (
                            float(pl["sale_price_unit"]) if pl["sale_price_unit"] is not None else float(suggested_unit)
                        )
                        if sale_price_unit < 0:
                            raise HTTPException(status_code=400, detail="sale_price debe ser >= 0")

                        line_sale_total = sale_price_unit * float(pl["qty"])
                        line_suggested_total = float(suggested_unit) * float(pl["qty"])
                        line_profit = line_sale_total - (float(pl["materials_cost_total"]) + op_alloc)

                        pl["op_alloc"] = op_alloc
                        pl["line_sale_total"] = line_sale_total
                        pl["line_suggested_total"] = line_suggested_total
                        pl["line_profit"] = line_profit

                        total_sale += line_sale_total

                    total_cost = total_materials + operational_total
                    total_profit = total_sale - total_cost

                    quote_id = quotes_repo.insert_quote(
                        cur,
                        quote_number,
                        status,
                        valid_until,
                        payload.customer_name,
                        payload.notes,
                        payload.currency,
                        payload.margin,
                        total_materials,
                        operational_total,
                        total_cost,
                        total_sale,
                        total_profit,
                        period_id,
                    )

                    for pl in prepared_lines:
                        quotes_repo.insert_quote_item(
                            cur,
                            quote_id,
                            pl["product_id"],
                            pl["recipe_id"],
                            pl["qty"],
                            pl["materials_cost_total"],
                            pl["line_suggested_total"],
                            pl["line_sale_total"],
                            pl["line_profit"],
                            pl.get("width"),
                            pl.get("height"),
                            {"vars": pl.get("vars") or {}, "opts": pl.get("opts") or {}},
                        )

                    quotes_repo.insert_status_history(cur, quote_id, status, None, None)

        return {
            "quote_id": str(quote_id),
            "quote_number": quote_number,
            "status": status,
            "valid_until": str(valid_until),
            "currency": payload.currency,
            "total_price": _round2(total_sale),
            "total_cost": _round2(total_cost),
            "materials_cost_total": _round2(total_materials),
            "operational_cost_total": _round2(operational_total),
            "total_profit": _round2(total_profit),
            "margin": float(payload.margin),
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


def list_quotes(limit: int = 50, offset: int = 0, status: str | None = None):
    with get_conn() as conn:
        with conn.cursor() as cur:
            rows = quotes_repo.list_quotes(cur, limit, offset, status)
    return [
        {
            "id": str(r[0]),
            "quote_number": r[1],
            "status": r[2],
            "valid_until": r[3],
            "customer_name": r[4],
            "currency": r[5],
            "total_price": float(r[6]),
            "total_cost": float(r[7]),
            "total_profit": float(r[8]),
            "created_at": r[9],
        }
        for r in rows
    ]


def get_quote_detail(quote_id: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            head = quotes_repo.get_quote(cur, quote_id)
            if not head:
                raise HTTPException(status_code=404, detail="quote_id no existe")
            items_rows = quotes_repo.list_quote_items(cur, quote_id)

    items = [
        {
            "quote_item_id": str(r[0]),
            "product_id": r[1],
            "recipe_id": r[2],
            "qty": float(r[3]),
            "materials_cost": float(r[4]),
            "suggested_price": float(r[5]),
            "sale_price": float(r[6]),
            "profit": float(r[7]),
            "width": r[8],
            "height": r[9],
            "var_payload": r[10] or {},
            "created_at": r[11],
        }
        for r in items_rows
    ]

    return {
        "quote_id": str(head[0]),
        "quote_number": head[1],
        "status": head[2],
        "valid_until": head[3],
        "customer_name": head[4],
        "notes": head[5],
        "currency": head[6],
        "margin": float(head[7]),
        "materials_cost_total": float(head[8]),
        "operational_cost_total": float(head[9]),
        "total_cost": float(head[10]),
        "total_price": float(head[11]),
        "total_profit": float(head[12]),
        "fixed_cost_period_id": head[13],
        "converted_sale_id": head[14],
        "created_at": head[15],
        "items": items,
    }


def update_quote_status(quote_id: str, status: str, notes: str | None, changed_by: str | None):
    if status not in ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail="status inválido")
    with get_conn() as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                head = quotes_repo.get_quote(cur, quote_id)
                if not head:
                    raise HTTPException(status_code=404, detail="quote_id no existe")
                quotes_repo.update_quote_status(cur, quote_id, status)
                quotes_repo.insert_status_history(cur, quote_id, status, notes, changed_by)
    return {"ok": True, "quote_id": quote_id, "status": status}


def convert_quote(quote_id: str):
    detail = get_quote_detail(quote_id)
    if detail["status"] == "converted":
        return {"error": "La cotización ya fue convertida", "quote_id": quote_id}

    lines = []
    for it in detail["items"]:
        qty = float(it["qty"])
        sale_price_unit = float(it["sale_price"]) / qty if qty > 0 else 0.0
        payload = SimpleNamespace(
            product_id=it["product_id"],
            recipe_id=it["recipe_id"],
            qty=qty,
            sale_price=sale_price_unit,
            width=it.get("width"),
            height=it.get("height"),
            vars=(it.get("var_payload") or {}).get("vars"),
            opts=(it.get("var_payload") or {}).get("opts"),
        )
        lines.append(payload)

    sale_payload = SimpleNamespace(
        customer_name=detail.get("customer_name"),
        notes=detail.get("notes"),
        currency=detail.get("currency") or "HNL",
        margin=detail.get("margin") or 0.4,
        lines=lines,
    )

    sale_result = create_sale_service(sale_payload)
    sale_id = sale_result.get("sale_id")

    with get_conn() as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                quotes_repo.mark_quote_converted(cur, quote_id, sale_id)
                quotes_repo.insert_status_history(cur, quote_id, "converted", None, None)

    return {"ok": True, "quote_id": quote_id, "sale_id": sale_id}
