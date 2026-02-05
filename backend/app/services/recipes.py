from fastapi import HTTPException
from ..db import get_conn
from ..repositories import recipes as recipes_repo
from ..repositories import recipe_variables as recipe_variables_repo
from ..repositories import recipe_options as recipe_options_repo
from ..repositories import recipe_rules as recipe_rules_repo
from .formulas import eval_formula
from .quantity import apply_waste


def _round2(x: float) -> float:
    return round(float(x), 2)


def _normalize_vars_payload(payload: dict | None) -> dict[str, float]:
    if not payload:
        return {}
    out: dict[str, float] = {}
    for k, v in payload.items():
        if k is None:
            continue
        out[str(k).strip().lower()] = float(v)
    return out


def _normalize_opts_payload(payload: dict | None) -> dict[str, str]:
    if not payload:
        return {}
    out: dict[str, str] = {}
    for k, v in payload.items():
        if k is None:
            continue
        out[str(k).strip().lower()] = str(v).strip()
    return out


def _load_recipe_context(cur, recipe_id: str):
    vars_rows = recipe_variables_repo.list_recipe_variables(cur, recipe_id)
    options_rows = recipe_options_repo.list_options_with_values(cur, recipe_id)
    rules_rows = recipe_rules_repo.list_recipe_rules(cur, recipe_id)

    variables = [
        {
            "code": r[2],
            "min_value": r[4],
            "max_value": r[5],
            "default_value": r[6],
        }
        for r in vars_rows
    ]

    options: dict[str, dict[str, float]] = {}
    for _opt_id, opt_code, _opt_label, _val_id, value_key, _value_label, numeric_value in options_rows:
        if opt_code is None:
            continue
        code = str(opt_code).strip().lower()
        if code not in options:
            options[code] = {}
        if value_key is not None:
            options[code][str(value_key)] = float(numeric_value)

    rules = [
        {
            "scope": r[2],
            "target_supply_id": r[3],
            "condition_var": str(r[4]).strip().lower(),
            "operator": r[5],
            "condition_value": r[6],
            "effect_type": r[7],
            "effect_value": float(r[8]),
        }
        for r in rules_rows
    ]

    return variables, options, rules


def _build_variable_context(
    variables_def: list[dict],
    options_def: dict[str, dict[str, float]],
    width: float | None,
    height: float | None,
    vars_payload: dict | None,
    opts_payload: dict | None,
    strict: bool,
):
    vars_map = _normalize_vars_payload(vars_payload)
    opts_map = _normalize_opts_payload(opts_payload)

    numeric_vars: dict[str, float] = {}
    opts_selected: dict[str, str] = {}

    if width is None and not strict:
        width = 1.0
    if height is None and not strict:
        height = 1.0

    if width is not None:
        if width <= 0:
            raise HTTPException(status_code=400, detail="width debe ser > 0")
        numeric_vars["width"] = float(width)
        numeric_vars["w"] = float(width)
        numeric_vars["ancho"] = float(width)

    if height is not None:
        if height <= 0:
            raise HTTPException(status_code=400, detail="height debe ser > 0")
        numeric_vars["height"] = float(height)
        numeric_vars["h"] = float(height)
        numeric_vars["alto"] = float(height)

    for v in variables_def:
        code = str(v["code"]).strip().lower()
        if code in vars_map:
            val = float(vars_map[code])
        elif v.get("default_value") is not None:
            val = float(v["default_value"])
        elif not strict:
            if v.get("min_value") is not None:
                val = float(v["min_value"])
            else:
                val = 1.0
        else:
            raise HTTPException(status_code=400, detail=f"Falta valor para variable: {code}")

        if v.get("min_value") is not None and val < float(v["min_value"]):
            raise HTTPException(status_code=400, detail=f"{code} debe ser >= {v['min_value']}")
        if v.get("max_value") is not None and val > float(v["max_value"]):
            raise HTTPException(status_code=400, detail=f"{code} debe ser <= {v['max_value']}")
        numeric_vars[code] = val

    for opt_code, values in options_def.items():
        key = opts_map.get(opt_code)
        if key is None:
            if not strict and values:
                key = next(iter(values.keys()))
            else:
                if strict:
                    raise HTTPException(status_code=400, detail=f"Falta opción: {opt_code}")
                continue
        if key not in values:
            raise HTTPException(status_code=400, detail=f"Opción inválida para {opt_code}")
        opts_selected[opt_code] = key
        numeric_vars[opt_code] = float(values[key])

    return numeric_vars, opts_selected


def _eval_condition(var_name: str, operator: str, condition_value: str, numeric_vars: dict, opts_selected: dict) -> bool:
    var = var_name.strip().lower()
    if var in numeric_vars:
        left = float(numeric_vars[var])
        try:
            right = float(condition_value)
        except Exception:
            raise HTTPException(status_code=400, detail=f"condition_value inválido para {var}")
        if operator == "==":
            return left == right
        if operator == "!=":
            return left != right
        if operator == ">":
            return left > right
        if operator == "<":
            return left < right
        if operator == ">=":
            return left >= right
        if operator == "<=":
            return left <= right
        return False

    if var in opts_selected:
        left = opts_selected[var]
        if operator == "==":
            return left == condition_value
        if operator == "!=":
            return left != condition_value
        return False

    return False


def _apply_supply_rules(
    qty: float,
    supply_id: str,
    rules: list[dict],
    numeric_vars: dict,
    opts_selected: dict,
) -> float:
    new_qty = float(qty)
    for r in rules:
        if r["scope"] != "supply":
            continue
        if str(r.get("target_supply_id")) != str(supply_id):
            continue
        if not _eval_condition(r["condition_var"], r["operator"], r["condition_value"], numeric_vars, opts_selected):
            continue
        if r["effect_type"] == "multiplier":
            new_qty *= float(r["effect_value"])
        elif r["effect_type"] == "add_qty":
            new_qty += float(r["effect_value"])
    return float(new_qty)


def _apply_global_rules(
    total_cost: float,
    rules: list[dict],
    numeric_vars: dict,
    opts_selected: dict,
) -> float:
    new_total = float(total_cost)
    for r in rules:
        if r["scope"] != "global":
            continue
        if not _eval_condition(r["condition_var"], r["operator"], r["condition_value"], numeric_vars, opts_selected):
            continue
        if r["effect_type"] == "multiplier":
            new_total *= float(r["effect_value"])
    return float(new_total)


def _compute_recipe_cost(
    recipe_id: str,
    width: float | None,
    height: float | None,
    vars_payload: dict | None,
    opts_payload: dict | None,
    strict: bool,
):
    with get_conn() as conn:
        with conn.cursor() as cur:
            rows = recipes_repo.list_recipe_items_for_cost(cur, recipe_id)
            variables_def, options_def, rules = _load_recipe_context(cur, recipe_id)

    numeric_vars, opts_selected = _build_variable_context(
        variables_def,
        options_def,
        width,
        height,
        vars_payload,
        opts_payload,
        strict,
    )

    items = []
    total = 0.0
    has_formula = False

    for supply_id, supply_name, qty_base, waste_pct, avg_unit_cost, qty_formula, unit_code, unit_name in rows:
        if qty_formula:
            has_formula = True
            qty = float(eval_formula(qty_formula, numeric_vars))
        else:
            qty = float(qty_base)

        qty = _apply_supply_rules(qty, str(supply_id), rules, numeric_vars, opts_selected)
        cost_u = float(avg_unit_cost)

        qty_with_waste = apply_waste(qty, float(waste_pct), unit_code, unit_name)
        line_cost = qty_with_waste * cost_u
        total += line_cost

        items.append(
            {
                "supply_id": str(supply_id),
                "supply_name": supply_name,
                "qty_base": qty,
                "waste_pct": float(waste_pct),
                "qty_with_waste": qty_with_waste,
                "avg_unit_cost": cost_u,
                "line_cost": _round2(line_cost),
                "qty_formula": qty_formula,
                "unit_code": unit_code,
            }
        )

    total = _apply_global_rules(total, rules, numeric_vars, opts_selected)

    return {
        "recipe_id": recipe_id,
        "items": items,
        "materials_cost": _round2(total),
        "currency": "HNL",
        "is_variable": has_formula,
        "variables": numeric_vars,
    }


def create_recipe(product_id: str, name: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            row = recipes_repo.insert_recipe(cur, product_id, name.strip())
        conn.commit()
    return {
        "id": str(row[0]),
        "product_id": str(row[1]),
        "name": row[2],
        "created_at": row[3],
        "margin_target": float(row[4]) if row[4] is not None else 0.4,
    }


def list_recipes(product_id: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            rows = recipes_repo.list_recipes(cur, product_id)
    return [
        {
            "id": str(r[0]),
            "product_id": str(r[1]),
            "name": r[2],
            "created_at": r[3],
            "margin_target": float(r[4]) if r[4] is not None else 0.4,
        }
        for r in rows
    ]


def get_recipe(recipe_id: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            row = recipes_repo.get_recipe(cur, recipe_id)
    if not row:
        raise HTTPException(status_code=404, detail="recipe_id no existe")
    return {
        "id": str(row[0]),
        "product_id": str(row[1]),
        "name": row[2],
        "created_at": row[3],
        "product_type": row[4],
        "margin_target": float(row[5]) if row[5] is not None else 0.4,
        "product_margin_target": float(row[6]) if row[6] is not None else 0.4,
    }


def update_recipe(recipe_id: str, name: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            row = recipes_repo.update_recipe(cur, recipe_id, name.strip())
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="recipe_id no existe")
    return {
        "id": str(row[0]),
        "product_id": str(row[1]),
        "name": row[2],
        "created_at": row[3],
        "margin_target": float(row[4]) if row[4] is not None else 0.4,
    }


def update_recipe_margin(recipe_id: str, margin_target: float, apply_to_product: bool = True):
    if margin_target < 0 or margin_target >= 1:
        raise HTTPException(status_code=400, detail="margin_target debe estar entre 0 y < 1 (ej 0.4)")
    with get_conn() as conn:
        with conn.cursor() as cur:
            row = recipes_repo.update_recipe_margin(cur, recipe_id, float(margin_target))
            if not row:
                raise HTTPException(status_code=404, detail="recipe_id no existe")
            if apply_to_product:
                from ..repositories import products as products_repo  # local import to avoid cycles
                products_repo.update_product_margin(cur, row[1], float(margin_target))
        conn.commit()
    return {"id": str(row[0]), "product_id": str(row[1]), "margin_target": float(row[2])}


def delete_recipe(recipe_id: str):
    with get_conn() as conn:
        with conn.cursor() as cur:
            if recipes_repo.recipe_has_sales(cur, recipe_id):
                raise HTTPException(
                    status_code=400,
                    detail="No se puede eliminar la receta porque tiene ventas asociadas",
                )
            ok = recipes_repo.delete_recipe(cur, recipe_id)
        conn.commit()
    if not ok:
        raise HTTPException(status_code=404, detail="recipe_id no existe")
    return {"ok": True, "id": recipe_id}


def recipe_cost(
    recipe_id: str,
    width: float | None = None,
    height: float | None = None,
    vars_payload: dict | None = None,
    opts_payload: dict | None = None,
    strict: bool = False,
):
    return _compute_recipe_cost(
        recipe_id,
        width=width,
        height=height,
        vars_payload=vars_payload,
        opts_payload=opts_payload,
        strict=strict,
    )


def suggested_price(recipe_id: str, value: float = 0.4, mode: str = "margin", width: float | None = None, height: float | None = None):
    data = recipe_cost(recipe_id, width=width, height=height)
    cost = float(data["materials_cost"])

    if value < 0:
        raise HTTPException(status_code=400, detail="value debe ser >= 0")

    mode = mode.lower().strip()
    if mode == "markup":
        price = cost * (1.0 + value)
    elif mode == "margin":
        if value >= 1:
            raise HTTPException(status_code=400, detail="margen debe ser < 1 (ej 0.4)")
        price = cost / (1.0 - value)
    else:
        raise HTTPException(status_code=400, detail="mode debe ser 'markup' o 'margin'")

    return {
        "recipe_id": recipe_id,
        "materials_cost": _round2(cost),
        "mode": mode,
        "value": float(value),
        "suggested_price": _round2(price),
        "currency": "HNL",
    }


def compute_recipe_cost_strict(
    recipe_id: str,
    width: float | None = None,
    height: float | None = None,
    vars_payload: dict | None = None,
    opts_payload: dict | None = None,
):
    return _compute_recipe_cost(
        recipe_id,
        width=width,
        height=height,
        vars_payload=vars_payload,
        opts_payload=opts_payload,
        strict=True,
    )
