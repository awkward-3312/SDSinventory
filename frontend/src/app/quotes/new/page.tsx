"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/api";

type Product = { id: string; name: string };
type Recipe = { id: string; name: string; margin_target?: number };

type ApiProduct = { id: string; name: string };
type ApiRecipe = { id: string; name: string; margin_target?: number };

type RecipeCost = { recipe_id: string; materials_cost: number; currency: string; is_variable?: boolean };

type RecipeVar = {
  id: string;
  code: string;
  label: string;
  min_value: number | null;
  max_value: number | null;
  default_value: number | null;
};

type RecipeOptionValue = {
  id: string;
  value_key: string;
  label: string;
  numeric_value: number;
};

type RecipeOption = {
  id: string;
  code: string;
  label: string;
  values: RecipeOptionValue[];
};

type QuoteLine = {
  key: string;
  product_id: string;
  recipe_id: string;
  qty: number;
  sale_price: string;
  width: string;
  height: string;
  vars: Record<string, string>;
  opts: Record<string, string>;
};

type QuoteResponse =
  | {
      quote_id: string;
      quote_number: string;
      status: string;
      total_price: number;
      total_cost: number;
      total_profit: number;
      currency: string;
    }
  | { error: string; [key: string]: unknown };

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

export default function NewQuotePage() {
  const [clientName, setClientName] = useState("");
  const [notes, setNotes] = useState("");
  const [margin, setMargin] = useState<number>(0.4);
  const [marginAuto, setMarginAuto] = useState(true);
  const [marginInputMode, setMarginInputMode] = useState<"decimal" | "percent">("percent");
  const [validUntil, setValidUntil] = useState<string>("");

  const [products, setProducts] = useState<Product[]>([]);
  const [recipesByProduct, setRecipesByProduct] = useState<Record<string, Recipe[]>>({});
  const [varsByRecipe, setVarsByRecipe] = useState<Record<string, RecipeVar[]>>({});
  const [optionsByRecipe, setOptionsByRecipe] = useState<Record<string, RecipeOption[]>>({});
  const [costByLine, setCostByLine] = useState<Record<string, RecipeCost>>({});
  const [operationalPerOrder, setOperationalPerOrder] = useState<number>(0);

  const [lines, setLines] = useState<QuoteLine[]>([
    { key: uid(), product_id: "", recipe_id: "", qty: 1, sale_price: "", width: "", height: "", vars: {}, opts: {} },
  ]);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<QuoteResponse | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/products`)
      .then((r) => r.json() as Promise<ApiProduct[]>)
      .then((data) => setProducts(data.map((p) => ({ id: p.id, name: p.name }))))
      .catch(() => setProducts([]));
  }, []);

  useEffect(() => {
    if (validUntil) return;
    const d = new Date();
    d.setDate(d.getDate() + 15);
    const iso = d.toISOString().slice(0, 10);
    setValidUntil(iso);
  }, [validUntil]);

  useEffect(() => {
    fetch(`${API_URL}/fixed-costs/summary/active`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => setOperationalPerOrder(Number(d?.operational_cost_per_order ?? 0)))
      .catch(() => setOperationalPerOrder(0));
  }, []);

  async function ensureRecipes(productId: string) {
    if (!productId) return;
    if (recipesByProduct[productId]) return;
    try {
      const res = await fetch(`${API_URL}/recipes?product_id=${productId}`, { cache: "no-store" });
      const data = (await res.json()) as ApiRecipe[];
      setRecipesByProduct((prev) => ({
        ...prev,
        [productId]: data.map((r) => ({ id: r.id, name: r.name, margin_target: r.margin_target })),
      }));
    } catch {
      setRecipesByProduct((prev) => ({ ...prev, [productId]: [] }));
    }
  }

  function applyDefaults(line: QuoteLine, varsDef: RecipeVar[], optionsDef: RecipeOption[]) {
    const nextVars = { ...line.vars };
    varsDef.forEach((v) => {
      const code = v.code;
      if ((nextVars[code] ?? "").trim() === "" && v.default_value != null) {
        nextVars[code] = String(v.default_value);
      }
    });

    const nextOpts = { ...line.opts };
    optionsDef.forEach((o) => {
      if (!nextOpts[o.code]) {
        const first = o.values[0];
        if (first) nextOpts[o.code] = first.value_key;
      }
    });

    return { ...line, vars: nextVars, opts: nextOpts };
  }

  async function ensureRecipeConfig(recipeId: string, lineKey?: string) {
    if (!recipeId) return;
    if (varsByRecipe[recipeId] && optionsByRecipe[recipeId]) return;
    try {
      const [vRes, oRes] = await Promise.all([
        fetch(`${API_URL}/recipe-variables?recipe_id=${encodeURIComponent(recipeId)}`, { cache: "no-store" }),
        fetch(`${API_URL}/recipe-options/with-values?recipe_id=${encodeURIComponent(recipeId)}`, { cache: "no-store" }),
      ]);
      const vData = (await vRes.json()) as RecipeVar[];
      const oData = (await oRes.json()) as RecipeOption[];
      setVarsByRecipe((prev) => ({ ...prev, [recipeId]: vData }));
      setOptionsByRecipe((prev) => ({ ...prev, [recipeId]: oData }));
      if (lineKey) {
        setLines((prev) => prev.map((l) => (l.key === lineKey ? applyDefaults(l, vData, oData) : l)));
      }
    } catch {
      setVarsByRecipe((prev) => ({ ...prev, [recipeId]: [] }));
      setOptionsByRecipe((prev) => ({ ...prev, [recipeId]: [] }));
    }
  }

  function buildVarsPayload(line: QuoteLine, varsDef: RecipeVar[]) {
    const out: Record<string, number> = {};
    for (const v of varsDef) {
      const raw = (line.vars[v.code] ?? "").trim();
      if (raw === "") {
        if (v.default_value != null) {
          out[v.code] = Number(v.default_value);
          continue;
        }
        return null;
      }
      const val = Number(raw);
      if (Number.isNaN(val)) return null;
      out[v.code] = val;
    }
    return out;
  }

  function buildOptsPayload(line: QuoteLine, optionsDef: RecipeOption[]) {
    const out: Record<string, string> = {};
    for (const o of optionsDef) {
      const raw = (line.opts[o.code] ?? "").trim();
      if (raw === "") {
        if (o.values[0]) {
          out[o.code] = o.values[0].value_key;
          continue;
        }
        return null;
      }
      out[o.code] = raw;
    }
    return out;
  }

  async function ensureCostForLine(line: QuoteLine) {
    if (!line.recipe_id) return;
    const varsDef = varsByRecipe[line.recipe_id] || [];
    const optionsDef = optionsByRecipe[line.recipe_id] || [];
    const width = line.width.trim() ? Number(line.width) : undefined;
    const height = line.height.trim() ? Number(line.height) : undefined;
    const varsPayload = buildVarsPayload(line, varsDef) ?? undefined;
    const optsPayload = buildOptsPayload(line, optionsDef) ?? undefined;

    try {
      const res = await fetch(`${API_URL}/recipes/${line.recipe_id}/cost`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          width,
          height,
          vars: varsPayload,
          opts: optsPayload,
          strict: false,
        }),
        cache: "no-store",
      });
      if (!res.ok) return;
      const c = (await res.json()) as RecipeCost;
      setCostByLine((prev) => ({ ...prev, [line.key]: c }));
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    lines.forEach((l) => {
      if (!l.recipe_id) return;
      ensureCostForLine(l);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, varsByRecipe, optionsByRecipe]);

  function addLine() {
    setLines((prev) => [
      ...prev,
      { key: uid(), product_id: "", recipe_id: "", qty: 1, sale_price: "", width: "", height: "", vars: {}, opts: {} },
    ]);
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
    setCostByLine((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function updateLine(key: string, patch: Partial<QuoteLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  const computed = useMemo(() => {
    const lineViews = lines.map((l) => {
      const costData = costByLine[l.key];
      const qty = Number(l.qty || 0);
      const materialsUnit = costData?.materials_cost ?? 0;
      const materialsTotal = materialsUnit * qty;
      return { ...l, materialsUnit, materialsTotal };
    });

    const totalMaterials = lineViews.reduce((a, v) => a + (Number.isFinite(v.materialsTotal) ? v.materialsTotal : 0), 0);
    const opTotal = Number(operationalPerOrder || 0);

    const withPricing = lineViews.map((v) => {
      const qty = Number(v.qty || 0);
      const opAlloc = totalMaterials > 0 ? opTotal * (v.materialsTotal / totalMaterials) : opTotal / Math.max(1, lineViews.length);
      const unitCostForPrice = qty > 0 ? v.materialsUnit + opAlloc / qty : v.materialsUnit;
      const suggested = unitCostForPrice / (1 - margin);
      const salePriceNum = v.sale_price.trim() ? Number(v.sale_price) : null;
      const unitPrice = salePriceNum != null && !Number.isNaN(salePriceNum) ? salePriceNum : suggested;
      const subtotal = unitPrice * qty;
      const costTotal = v.materialsTotal + opAlloc;
      const profit = subtotal - costTotal;
      const unitProfit = unitPrice - unitCostForPrice;
      const marginPctLine = subtotal > 0 ? profit / subtotal : 0;
      return { ...v, suggested, unitPrice, subtotal, costTotal, opAlloc, profit, unitCostForPrice, unitProfit, marginPctLine };
    });

    const totalSale = withPricing.reduce((a, v) => a + (Number.isFinite(v.subtotal) ? v.subtotal : 0), 0);
    const totalCost = withPricing.reduce((a, v) => a + (Number.isFinite(v.costTotal) ? v.costTotal : 0), 0);
    const profit = totalSale - totalCost;
    const marginPct = totalSale > 0 ? profit / totalSale : 0;

    return { lineViews: withPricing, totalSale, totalCost, profit, marginPct };
  }, [lines, costByLine, operationalPerOrder, margin]);

  const canSubmit = useMemo(() => {
    if (loading) return false;
    if (computed.lineViews.length === 0) return false;
    return computed.lineViews.every((l) => {
      if (!l.product_id || !l.recipe_id || l.qty <= 0) return false;
      const varsDef = varsByRecipe[l.recipe_id] || [];
      const optionsDef = optionsByRecipe[l.recipe_id] || [];
      const varsPayload = buildVarsPayload(l, varsDef);
      const optsPayload = buildOptsPayload(l, optionsDef);
      if (varsPayload === null || optsPayload === null) return false;
      const hasW = l.width.trim() !== "";
      const hasH = l.height.trim() !== "";
      if (hasW !== hasH) return false;
      if (hasW && (Number(l.width) <= 0 || Number(l.height) <= 0)) return false;
      return true;
    });
  }, [computed.lineViews, loading, varsByRecipe, optionsByRecipe]);

  async function submit() {
    setLoading(true);
    setResult(null);

    try {
      const payload = {
        customer_name: clientName.trim() || null,
        notes: notes.trim() || null,
        currency: "HNL",
        margin,
        valid_until: validUntil || null,
        lines: computed.lineViews.map((l) => {
          const out: {
            product_id: string;
            recipe_id: string;
            qty: number;
            sale_price?: number;
            width?: number;
            height?: number;
            vars?: Record<string, number>;
            opts?: Record<string, string>;
          } = {
            product_id: l.product_id,
            recipe_id: l.recipe_id,
            qty: Number(l.qty),
          };

          const sp = l.sale_price.trim();
          if (sp !== "") out.sale_price = Number(sp);
          const widthNum = l.width.trim() ? Number(l.width) : undefined;
          const heightNum = l.height.trim() ? Number(l.height) : undefined;
          if (widthNum != null && heightNum != null) {
            out.width = widthNum;
            out.height = heightNum;
          }

          const varsDef = varsByRecipe[l.recipe_id] || [];
          const optsDef = optionsByRecipe[l.recipe_id] || [];
          const varsPayload = buildVarsPayload(l, varsDef);
          const optsPayload = buildOptsPayload(l, optsDef);
          if (varsPayload) out.vars = varsPayload;
          if (optsPayload) out.opts = optsPayload;

          return out;
        }),
      };

      const res = await fetch(`${API_URL}/quotes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = (await res.json()) as QuoteResponse;
      setResult(data);
    } catch {
      setResult({ error: "No se pudo conectar con el backend" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">Nueva Cotización</h1>

      <div className="card mb-6">
        <div className="font-semibold mb-1">Guía rápida</div>
        <div className="text-sm text-zinc-600">
          1. Selecciona producto y receta • 2. Completa medidas/variables si aplica • 3. Genera precio sugerido y guarda.
        </div>
      </div>

      <div className="grid gap-3 mb-6">
        <label className="grid gap-1">
          <span className="font-medium">Cliente (opcional)</span>
          <input
            className="border rounded px-3 py-2"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Nombre del cliente"
          />
        </label>

        <label className="grid gap-1">
          <span className="font-medium">Notas (opcional)</span>
          <input
            className="border rounded px-3 py-2"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Ej: entrega 15 días, etc."
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1">
            <span className="font-medium">Vigencia</span>
            <input
              className="border rounded px-3 py-2"
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
            />
          </label>
          <label className="grid gap-1">
            <span className="font-medium">Margen (0.40 = 40%)</span>
            <input
              className="border rounded px-3 py-2"
              type="number"
              step="0.01"
              min={0}
              max={marginInputMode === "percent" ? 99 : 0.99}
              value={marginInputMode === "percent" ? margin * 100 : margin}
              onChange={(e) => {
                const raw = Number(e.target.value || 0);
                setMargin(marginInputMode === "percent" ? raw / 100 : raw);
                setMarginAuto(false);
              }}
            />
            <span className="text-xs text-zinc-600">Margen = ganancia / precio</span>
            <div className="flex items-center gap-2 text-xs text-zinc-600">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={marginInputMode === "percent"}
                  onChange={(e) => setMarginInputMode(e.target.checked ? "percent" : "decimal")}
                />
                Ingresar en %
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={marginAuto}
                  onChange={(e) => setMarginAuto(e.target.checked)}
                />
                Auto por receta
              </label>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => {
                  setMargin(0.4);
                  setMarginInputMode("percent");
                  setMarginAuto(false);
                }}
              >
                Usar 40%
              </button>
            </div>
            <span className="text-xs text-zinc-600">
              Si está activo, el margen se actualiza al elegir receta.
            </span>
          </label>
        </div>
      </div>

      <div className="mb-6 grid gap-2 sm:grid-cols-4">
        <div className="stat-card">
          <div className="text-sm text-zinc-600">Total cotizado</div>
          <div className="text-xl font-bold">L {computed.totalSale.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="text-sm text-zinc-600">Costo</div>
          <div className="text-xl font-bold">L {computed.totalCost.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="text-sm text-zinc-600">Utilidad</div>
          <div className="text-xl font-bold">
            L {computed.profit.toFixed(2)}{" "}
            <span className="text-sm text-zinc-600">({(computed.marginPct * 100).toFixed(1)}%)</span>
          </div>
        </div>
        <div className="stat-card">
          <div className="text-sm text-zinc-600">Costo operativo</div>
          <div className="text-xl font-bold">L {Number(operationalPerOrder || 0).toFixed(2)}</div>
          <div className="text-xs text-zinc-600">Por pedido</div>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">Líneas</div>
          <button className="btn btn-secondary btn-sm" onClick={addLine} type="button">
            + Agregar línea
          </button>
        </div>

        <div className="grid gap-4">
          {computed.lineViews.map((l) => {
            const isVariable = costByLine[l.key]?.is_variable ?? false;
            const varsDef = varsByRecipe[l.recipe_id] || [];
            const optionsDef = optionsByRecipe[l.recipe_id] || [];
            return (
              <div key={l.key} className="card">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1">
                    <span className="font-medium">Producto</span>
                    <select
                      className="border rounded px-3 py-2"
                      value={l.product_id}
                      onChange={(e) => {
                        const pid = e.target.value;
                        updateLine(l.key, { product_id: pid, recipe_id: "", width: "", height: "", vars: {}, opts: {} });
                        setCostByLine((prev) => {
                          const next = { ...prev };
                          delete next[l.key];
                          return next;
                        });
                        ensureRecipes(pid);
                      }}
                    >
                      <option value="">Selecciona…</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="grid gap-1">
                    <span className="font-medium">Receta</span>
                    <select
                      className="border rounded px-3 py-2"
                      value={l.recipe_id}
                      onChange={(e) => {
                        const rid = e.target.value;
                        updateLine(l.key, { recipe_id: rid, width: "", height: "", vars: {}, opts: {} });
                        setCostByLine((prev) => {
                          const next = { ...prev };
                          delete next[l.key];
                          return next;
                        });
                        if (rid) ensureRecipeConfig(rid, l.key);
                        if (rid && marginAuto) {
                          const selected = (recipesByProduct[l.product_id] || []).find((r) => r.id === rid);
                          if (selected?.margin_target != null) {
                            setMargin(Number(selected.margin_target));
                          }
                        }
                      }}
                      disabled={!l.product_id}
                    >
                      <option value="">{l.product_id ? "Selecciona…" : "Selecciona producto"}</option>
                      {(recipesByProduct[l.product_id] || []).map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                {isVariable && (
                  <div className="grid gap-3 mt-3 sm:grid-cols-2">
                    <label className="grid gap-1">
                      <span className="font-medium">Ancho</span>
                      <input
                        className="border rounded px-3 py-2"
                        type="number"
                        min={0}
                        value={l.width}
                        onChange={(e) => updateLine(l.key, { width: e.target.value })}
                      />
                    </label>
                    <label className="grid gap-1">
                      <span className="font-medium">Alto</span>
                      <input
                        className="border rounded px-3 py-2"
                        type="number"
                        min={0}
                        value={l.height}
                        onChange={(e) => updateLine(l.key, { height: e.target.value })}
                      />
                    </label>
                  </div>
                )}

                {optionsDef.length > 0 && (
                  <div className="grid gap-3 mt-3 sm:grid-cols-2">
                    {optionsDef.map((o) => (
                      <label key={o.id} className="grid gap-1">
                        <span className="font-medium">{o.label}</span>
                        <select
                          className="border rounded px-3 py-2"
                          value={l.opts[o.code] ?? ""}
                          onChange={(e) =>
                            updateLine(l.key, { opts: { ...l.opts, [o.code]: e.target.value } })
                          }
                        >
                          <option value="">Selecciona…</option>
                          {o.values.map((v) => (
                            <option key={v.id} value={v.value_key}>
                              {v.label}
                            </option>
                          ))}
                        </select>
                      </label>
                    ))}
                  </div>
                )}

                {varsDef.length > 0 && (
                  <div className="grid gap-3 mt-3 sm:grid-cols-3">
                    {varsDef.map((v) => (
                      <label key={v.id} className="grid gap-1">
                        <span className="font-medium">{v.label}</span>
                        <input
                          className="border rounded px-3 py-2"
                          type="number"
                          min={v.min_value ?? undefined}
                          max={v.max_value ?? undefined}
                          value={l.vars[v.code] ?? ""}
                          onChange={(e) =>
                            updateLine(l.key, { vars: { ...l.vars, [v.code]: e.target.value } })
                          }
                        />
                      </label>
                    ))}
                  </div>
                )}

                <div className="grid gap-3 mt-3 sm:grid-cols-3">
                  <label className="grid gap-1">
                    <span className="font-medium">Qty</span>
                    <input
                      className="border rounded px-3 py-2"
                      type="number"
                      min={1}
                      value={l.qty}
                      onChange={(e) => updateLine(l.key, { qty: Number(e.target.value) })}
                    />
                  </label>

                  <label className="grid gap-1">
                    <span className="font-medium">Precio venta (opcional)</span>
                    <input
                      className="border rounded px-3 py-2"
                      value={l.sale_price}
                      onChange={(e) => updateLine(l.key, { sale_price: e.target.value })}
                      placeholder="Vacío = sugerido"
                      inputMode="decimal"
                    />
                    {l.recipe_id && (
                      <span className="text-xs text-zinc-600">Sugerido: L {l.suggested.toFixed(2)}</span>
                    )}
                  </label>

                  <div className="grid gap-1">
                    <span className="font-medium">Subtotal</span>
                    <div className="border rounded px-3 py-2 bg-zinc-50">
                      L {Number.isFinite(l.subtotal) ? l.subtotal.toFixed(2) : "0.00"}
                    </div>
                    <span className="text-xs text-zinc-600">Costo: L {l.costTotal.toFixed(2)}</span>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-3 text-sm">
                  <div className="stat-card bg-amber-50 border-amber-200">
                    <div className="text-xs text-amber-700">Costo unitario</div>
                    <div className="font-bold">L {l.unitCostForPrice.toFixed(2)}</div>
                    <div className="text-xs text-amber-700">Incluye operativo</div>
                  </div>
                  <div className="stat-card bg-emerald-50 border-emerald-200">
                    <div className="text-xs text-emerald-700">Utilidad por unidad</div>
                    <div className="font-bold">L {l.unitProfit.toFixed(2)}</div>
                    <div className="text-xs text-emerald-700">Ganancia directa</div>
                  </div>
                  <div className="stat-card bg-sky-50 border-sky-200">
                    <div className="text-xs text-sky-700">Margen en línea</div>
                    <div className="font-bold">{(l.marginPctLine * 100).toFixed(1)}%</div>
                    <div className="text-xs text-sky-700">Sobre precio total</div>
                  </div>
                </div>

                <div className="mt-3 flex justify-end">
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => removeLine(l.key)}
                    type="button"
                    disabled={lines.length === 1}
                  >
                    Quitar
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <button onClick={submit} disabled={!canSubmit} className="mt-4 btn btn-primary">
          {loading ? "Guardando..." : "Guardar cotización"}
        </button>
      </div>

      {result && "quote_number" in result && (
        <div className="card mt-6">
          <div className="font-semibold mb-2">Cotización creada</div>
          <div>Número: {result.quote_number}</div>
          <div>Total: L {Number(result.total_price || 0).toFixed(2)}</div>
          <div>
            <a className="font-semibold hover:underline" href={`/quotes/${result.quote_id}`}>
              Ver detalle →
            </a>
          </div>
        </div>
      )}

      {result && "error" in result && (
        <div className="mt-6 text-red-700 font-semibold">❌ {result.error}</div>
      )}
    </main>
  );
}
