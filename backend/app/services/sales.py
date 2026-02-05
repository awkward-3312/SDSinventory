from fastapi import HTTPException
from ..db import get_conn
from ..repositories import sales as sales_repo
from . import recipes as recipes_service
from .fixed_costs import get_operational_cost_per_order


def _round2(x: float) -> float:
    return round(float(x), 2)


def _allocate_operational(total_operational: float, line_materials: list[float]) -> list[float]:
    if not line_materials:
        return []
    total_materials = sum(line_materials)
    if total_materials <= 0:
        per = float(total_operational) / len(line_materials)
        return [per for _ in line_materials]
    return [float(total_operational) * (m / total_materials) for m in line_materials]


def create_sale(payload):
    if not payload.lines:
        raise HTTPException(status_code=400, detail="La venta debe tener al menos 1 línea")

    if payload.margin < 0 or payload.margin >= 1:
        raise HTTPException(status_code=400, detail="margin debe estar entre 0 y < 1 (ej 0.4)")

    try:
        with get_conn() as conn:
            with conn.transaction():
                with conn.cursor() as cur:
                    total_sale = 0.0
                    total_cost = 0.0
                    prepared_lines: list[dict] = []
                    stock_needs: dict[str, float] = {}
                    line_materials_list: list[float] = []

                    for line in payload.lines:
                        if float(line.qty) <= 0:
                            raise HTTPException(status_code=400, detail="qty debe ser > 0")

                        if not sales_repo.ensure_recipe_belongs(cur, line.recipe_id, line.product_id):
                            raise HTTPException(
                                status_code=400,
                                detail=f"recipe_id no pertenece al product_id (recipe_id={line.recipe_id})",
                            )

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
                        consumptions_for_line: list[dict] = []

                        for it in items:
                            qty_unit = float(it["qty_with_waste"])
                            qty = qty_unit * float(line.qty)
                            cost_u = float(it["avg_unit_cost"])
                            supply_id = str(it["supply_id"])

                            stock_needs[supply_id] = stock_needs.get(supply_id, 0.0) + qty
                            consumptions_for_line.append(
                                {"supply_id": supply_id, "qty_base": qty, "unit_cost": cost_u}
                            )

                        prepared_lines.append(
                            {
                                "product_id": line.product_id,
                                "recipe_id": line.recipe_id,
                                "qty": float(line.qty),
                                "materials_cost_total": float(line_materials_cost),
                                "materials_cost_unit": float(unit_materials_cost),
                                "consumptions": consumptions_for_line,
                                "width": line.width,
                                "height": line.height,
                                "sale_price_unit": float(line.sale_price) if line.sale_price is not None else None,
                                "vars": getattr(line, "vars", None),
                                "opts": getattr(line, "opts", None),
                            }
                        )

                        line_materials_list.append(float(line_materials_cost))
                        total_cost += line_materials_cost

                    operational_per_order, period_id = get_operational_cost_per_order()
                    operational_total = float(operational_per_order)
                    total_cost += operational_total

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
                        pl["suggested_unit"] = suggested_unit
                        pl["sale_price_unit"] = sale_price_unit
                        pl["line_sale_total"] = line_sale_total
                        pl["line_suggested_total"] = line_suggested_total
                        pl["line_profit"] = line_profit

                        total_sale += line_sale_total

                    total_profit = total_sale - total_cost

                    for supply_id, needed in stock_needs.items():
                        row = sales_repo.lock_supply_for_update(cur, supply_id)
                        if not row:
                            raise HTTPException(status_code=400, detail=f"supply_id no existe: {supply_id}")
                        available = float(row[0])
                        if available < needed:
                            raise HTTPException(
                                status_code=400,
                                detail=f"stock insuficiente supply_id={supply_id} needed={needed} available={available}",
                            )

                    sale_id = sales_repo.insert_sale(
                        cur,
                        payload.customer_name,
                        payload.notes,
                        payload.currency,
                        payload.margin,
                        total_sale,
                        total_cost,
                        total_profit,
                        total_materials=sum(line_materials_list),
                        operational_cost=operational_total,
                        fixed_cost_period_id=period_id,
                    )

                    sale_items_out: list[dict] = []
                    movements_out: list[dict] = []

                    for pl in prepared_lines:
                        sale_item_id = sales_repo.insert_sale_item(
                            cur,
                            sale_id,
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

                        for c in pl["consumptions"]:
                            supply_id = c["supply_id"]
                            qty_out = float(c["qty_base"])
                            cost_u = float(c["unit_cost"])

                            row = sales_repo.lock_supply_for_update(cur, supply_id)
                            current_stock = float(row[0])
                            new_stock = current_stock - qty_out

                            sales_repo.insert_sale_movement_out(cur, supply_id, qty_out, cost_u, sale_item_id)
                            sales_repo.update_supply_stock(cur, supply_id, new_stock)

                            movements_out.append(
                                {
                                    "supply_id": str(supply_id),
                                    "qty_base": _round2(qty_out),
                                    "unit_cost": _round2(cost_u),
                                    "ref_type": "sale",
                                    "ref_id": str(sale_item_id),
                                }
                            )

                        sale_items_out.append(
                            {
                                "sale_item_id": str(sale_item_id),
                                "product_id": pl["product_id"],
                                "recipe_id": pl["recipe_id"],
                                "qty": float(pl["qty"]),
                                "materials_cost": _round2(pl["materials_cost_total"]),
                                "suggested_price": _round2(pl["line_suggested_total"]),
                                "sale_price": _round2(pl["line_sale_total"]),
                                "profit": _round2(pl["line_profit"]),
                                "width": pl.get("width"),
                                "height": pl.get("height"),
                            }
                        )

        total_profit = total_sale - total_cost

        return {
            "sale_id": str(sale_id),
            "currency": payload.currency,
            "total_sale": _round2(total_sale),
            "total_cost": _round2(total_cost),
            "materials_cost_total": _round2(sum(line_materials_list)),
            "operational_cost_total": _round2(operational_total),
            "fixed_cost_period_id": period_id,
            "total_profit": _round2(total_profit),
            "margin": float(payload.margin),
            "items": sale_items_out,
            "movements": movements_out,
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


def list_sales(limit: int = 50, offset: int = 0):
    with get_conn() as conn:
        with conn.cursor() as cur:
            rows = sales_repo.list_sales(cur, limit, offset)

    return [
        {
            "id": str(r[0]),
            "created_at": r[1],
            "customer_name": r[2],
            "notes": r[3],
            "currency": r[4],
            "total_sale": float(r[5]),
            "total_cost": float(r[6]),
            "total_profit": float(r[7]),
            "materials_cost_total": float(r[8]) if r[8] is not None else 0.0,
            "operational_cost_total": float(r[9]) if r[9] is not None else 0.0,
            "margin": float(r[10]) if r[10] is not None else 0.0,
            "voided": bool(r[11]),
            "voided_at": r[12],
            "void_reason": r[13],
            "voided_by": r[14],
        }
        for r in rows
    ]


def sales_summary(include_voided: bool = False, period: str = "7d"):
    period = (period or "7d").strip().lower()
    interval_map = {
        "7d": "7 days",
        "1m": "1 month",
        "3m": "3 months",
        "6m": "6 months",
        "9m": "9 months",
        "1y": "1 year",
        "all": None,
    }

    if period not in interval_map:
        raise HTTPException(
            status_code=400,
            detail="period inválido. Usa: 7d, 1m, 3m, 6m, 9m, 1y, all",
        )

    where_parts = []

    if not include_voided:
        where_parts.append("voided = false")

    interval_literal = interval_map[period]
    if interval_literal is not None:
        where_parts.append(f"created_at >= now() - interval '{interval_literal}'")

    where_sql = ""
    if where_parts:
        where_sql = "where " + " and ".join(where_parts)

    with get_conn() as conn:
        with conn.cursor() as cur:
            row = sales_repo.sales_summary(cur, where_sql)

    total_sale = float(row[0])
    total_cost = float(row[1])
    total_profit = float(row[2])
    margin = (total_profit / total_sale) if total_sale > 0 else 0.0

    return {
        "include_voided": include_voided,
        "period": period,
        "count_sales": int(row[3]),
        "total_sale": round(total_sale, 2),
        "total_cost": round(total_cost, 2),
        "total_profit": round(total_profit, 2),
        "margin": round(margin, 4),
        "currency": "HNL",
    }


def get_sale_detail(sale_id: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            head = sales_repo.get_sale_head(cur, sale_id)
            if not head:
                raise HTTPException(status_code=404, detail="sale_id no existe")
            item_rows = sales_repo.get_sale_items(cur, sale_id)
            mov_rows = sales_repo.get_sale_movements(cur, sale_id)

    items = [
        {
            "sale_item_id": str(r[0]),
            "product_id": str(r[1]),
            "product_name": r[2],
            "recipe_id": str(r[3]),
            "recipe_name": r[4],
            "qty": float(r[5]),
            "materials_cost": float(r[6]),
            "suggested_price": float(r[7]),
            "sale_price": float(r[8]),
            "profit": float(r[9]),
            "created_at": r[10],
            "width": r[11],
            "height": r[12],
        }
        for r in item_rows
    ]

    movements = [
        {
            "movement_id": str(r[0]),
            "supply_id": str(r[1]),
            "supply_name": r[2],
            "unit_base": r[3],
            "movement_type": r[4],
            "qty_base": float(r[5]),
            "unit_cost_snapshot": float(r[6]),
            "ref_type": r[7],
            "ref_id": str(r[8]),
            "created_at": r[9],
            "kardex_url": f"/kardex?supply_id={r[1]}",
        }
        for r in mov_rows
    ]

    return {
        "sale_id": str(head[0]),
        "created_at": head[1],
        "customer_name": head[2],
        "notes": head[3],
        "currency": head[4],
        "total_sale": float(head[5]),
        "total_cost": float(head[6]),
        "total_profit": float(head[7]),
        "materials_cost_total": float(head[8]) if head[8] is not None else 0.0,
        "operational_cost_total": float(head[9]) if head[9] is not None else 0.0,
        "margin": float(head[10]) if head[10] is not None else None,
        "voided": bool(head[11]),
        "voided_at": head[12],
        "void_reason": head[13],
        "voided_by": head[14],
        "items": items,
        "movements": movements,
    }


def void_sale(sale_id: str, reason: str | None):
    with get_conn() as conn:
        with conn.transaction():
            with conn.cursor() as cur:
                sale = sales_repo.lock_sale(cur, sale_id)
                if not sale:
                    raise HTTPException(status_code=404, detail="sale_id no existe")
                if sale[1] is not None:
                    return {"error": "La venta ya está anulada", "sale_id": sale_id}

                outs = sales_repo.list_sale_out_movements(cur, sale_id)
                if not outs:
                    return {"error": "No hay movimientos OUT para revertir", "sale_id": sale_id}

                reversed_movements = []
                for supply_id, qty_base, unit_cost_snapshot, ref_id in outs:
                    qty_in = float(qty_base)
                    cost_u = float(unit_cost_snapshot)

                    row = sales_repo.lock_supply_for_update(cur, supply_id)
                    if not row:
                        raise HTTPException(status_code=400, detail=f"supply_id no existe: {supply_id}")

                    new_stock = float(row[0]) + qty_in

                    mov_id = sales_repo.insert_sale_void_movement(cur, supply_id, qty_in, cost_u, ref_id)
                    sales_repo.update_supply_stock(cur, supply_id, new_stock)

                    reversed_movements.append(
                        {
                            "movement_id": str(mov_id),
                            "supply_id": str(supply_id),
                            "qty_base": qty_in,
                            "unit_cost_snapshot": cost_u,
                            "ref_type": "sale_void",
                            "ref_id": str(ref_id),
                        }
                    )

                sales_repo.mark_sale_voided(cur, sale_id, reason)

    return {"ok": True, "sale_id": sale_id, "reversed_movements": reversed_movements}
