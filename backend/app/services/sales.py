from fastapi import HTTPException
from ..db import get_conn
from ..repositories import sales as sales_repo
from .formulas import eval_formula
from .quantity import apply_waste


def _round2(x: float) -> float:
    return round(float(x), 2)


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

                    for line in payload.lines:
                        if float(line.qty) <= 0:
                            raise HTTPException(status_code=400, detail="qty debe ser > 0")

                        if not sales_repo.ensure_recipe_belongs(cur, line.recipe_id, line.product_id):
                            raise HTTPException(
                                status_code=400,
                                detail=f"recipe_id no pertenece al product_id (recipe_id={line.recipe_id})",
                            )

                        items = sales_repo.list_recipe_items_for_sale(cur, line.recipe_id)
                        if not items:
                            raise HTTPException(status_code=400, detail="La receta no tiene items")

                        line_materials_cost = 0.0
                        consumptions_for_line: list[dict] = []

                        for (
                            supply_id,
                            qty_base,
                            waste_pct,
                            avg_cost,
                            _stock_on_hand,
                            qty_formula,
                            unit_code,
                            unit_name,
                        ) in items:
                            if qty_formula:
                                if line.width is None or line.height is None:
                                    raise HTTPException(
                                        status_code=400,
                                        detail=f"El producto requiere ancho y alto (recipe_id={line.recipe_id})",
                                    )
                                if float(line.width) <= 0 or float(line.height) <= 0:
                                    raise HTTPException(status_code=400, detail="Ancho/alto debe ser > 0")
                                qty_unit = float(
                                    eval_formula(
                                        qty_formula,
                                        {
                                            "width": line.width,
                                            "height": line.height,
                                            "w": line.width,
                                            "h": line.height,
                                            "ancho": line.width,
                                            "alto": line.height,
                                        },
                                    )
                                )
                            else:
                                if line.width is not None or line.height is not None:
                                    raise HTTPException(
                                        status_code=400,
                                        detail="Ancho/alto solo permitido en recetas con fórmula",
                                    )
                                qty_unit = float(qty_base)

                            qty = qty_unit * float(line.qty)
                            qty_with_waste = apply_waste(qty, float(waste_pct), unit_code, unit_name)

                            cost_u = float(avg_cost)
                            line_cost = qty_with_waste * cost_u
                            line_materials_cost += line_cost

                            stock_needs[str(supply_id)] = stock_needs.get(str(supply_id), 0.0) + qty_with_waste
                            consumptions_for_line.append(
                                {"supply_id": str(supply_id), "qty_base": qty_with_waste, "unit_cost": cost_u}
                            )

                        suggested = line_materials_cost / (1.0 - float(payload.margin))
                        sale_price = float(line.sale_price) if line.sale_price is not None else float(suggested)
                        if sale_price < 0:
                            raise HTTPException(status_code=400, detail="sale_price debe ser >= 0")

                        profit = sale_price - line_materials_cost

                        prepared_lines.append(
                            {
                                "product_id": line.product_id,
                                "recipe_id": line.recipe_id,
                                "qty": float(line.qty),
                                "materials_cost": float(line_materials_cost),
                                "suggested_price": float(suggested),
                                "sale_price": float(sale_price),
                                "profit": float(profit),
                                "consumptions": consumptions_for_line,
                                "width": line.width,
                                "height": line.height,
                            }
                        )

                        total_sale += sale_price
                        total_cost += line_materials_cost

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
                            pl["materials_cost"],
                            pl["suggested_price"],
                            pl["sale_price"],
                            pl["profit"],
                            pl.get("width"),
                            pl.get("height"),
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
                                "materials_cost": _round2(pl["materials_cost"]),
                                "suggested_price": _round2(pl["suggested_price"]),
                                "sale_price": _round2(pl["sale_price"]),
                                "profit": _round2(pl["profit"]),
                                "width": pl.get("width"),
                                "height": pl.get("height"),
                            }
                        )

        return {
            "sale_id": str(sale_id),
            "currency": payload.currency,
            "total_sale": _round2(total_sale),
            "total_cost": _round2(total_cost),
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
            "margin": float(r[8]) if r[8] is not None else 0.0,
            "voided": bool(r[9]),
            "voided_at": r[10],
            "void_reason": r[11],
            "voided_by": r[12],
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
        "margin": float(head[8]) if head[8] is not None else None,
        "voided": bool(head[9]),
        "voided_at": head[10],
        "void_reason": head[11],
        "voided_by": head[12],
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
