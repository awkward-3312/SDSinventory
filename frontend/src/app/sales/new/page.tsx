"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/api";

type Product = { id: string; name: string };
type Recipe = { id: string; name: string };

type ApiProduct = { id: string; name: string };
type ApiRecipe = { id: string; name: string };

type RecipeCost = { recipe_id: string; materials_cost: number; currency: string; is_variable?: boolean };

type SaleLine = {
  key: string; // para React key estable
  product_id: string;
  recipe_id: string;
  qty: number;
  sale_price: string; // string para input (puede estar vacío)
  width: string;
  height: string;
};

type SaleResponse =
  | {
      sale_id: string;
      currency: string;
      total_sale: number;
      total_cost: number;
      total_profit: number;
      margin: number;
      items: Array<{
        sale_item_id: string;
        product_id: string;
        recipe_id: string;
        qty: number;
        materials_cost: number;
        suggested_price: number;
        sale_price: number;
        profit: number;
      }>;
      movements: Array<{
        supply_id: string;
        qty_base: number;
        unit_cost: number;
        ref_type: string;
        ref_id: string;
      }>;
    }
  | { error: string; [key: string]: unknown };

function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

async function fetchRecipeCost(recipeId: string, width?: number, height?: number): Promise<RecipeCost> {
  const qs =
    width != null && height != null
      ? `?width=${encodeURIComponent(String(width))}&height=${encodeURIComponent(String(height))}`
      : "";
  const res = await fetch(`${API_URL}/recipes/${recipeId}/cost${qs}`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("No se pudo cargar costo de receta");
  const data = (await res.json()) as RecipeCost;
  return data;
}

async function fetchSuggestedPrice(
  recipeId: string,
  margin: number,
  width?: number,
  height?: number
): Promise<number> {
  const qs =
    width != null && height != null
      ? `&width=${encodeURIComponent(String(width))}&height=${encodeURIComponent(String(height))}`
      : "";
  const res = await fetch(
    `${API_URL}/recipes/${recipeId}/suggested-price?mode=margin&value=${encodeURIComponent(
      String(margin)
    )}${qs}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("No se pudo cargar precio sugerido");
  const data = (await res.json()) as { suggested_price: number };
  return Number(data.suggested_price || 0);
}

export default function NewSalePage() {
  const [clientName, setClientName] = useState("");
  const [notes, setNotes] = useState("");
  const [margin, setMargin] = useState<number>(0.4);

  const [products, setProducts] = useState<Product[]>([]);
  const [recipesByProduct, setRecipesByProduct] = useState<Record<string, Recipe[]>>({});

  // Cache: costos por receta
  const [costByRecipe, setCostByRecipe] = useState<Record<string, RecipeCost>>({});
  // Cache: precio sugerido por receta (depende del margen)
  const [suggestedByRecipe, setSuggestedByRecipe] = useState<Record<string, number>>({});

  const [lines, setLines] = useState<SaleLine[]>([
    { key: uid(), product_id: "", recipe_id: "", qty: 1, sale_price: "", width: "", height: "" },
  ]);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SaleResponse | null>(null);

  // Load products
  useEffect(() => {
    fetch(`${API_URL}/products`)
      .then((r) => r.json() as Promise<ApiProduct[]>)
      .then((data) => setProducts(data.map((p) => ({ id: p.id, name: p.name }))))
      .catch(() => setProducts([]));
  }, []);

  // Cuando cambie el margen, hay que recalcular sugeridos (porque dependen del margen)
  useEffect(() => {
    setSuggestedByRecipe({}); // resetea cache
  }, [margin]);

  function costKey(recipeId: string, width?: number, height?: number) {
    return `${recipeId}|${width ?? ""}|${height ?? ""}`;
  }

  async function ensureRecipes(productId: string) {
    if (!productId) return;
    if (recipesByProduct[productId]) return;

    try {
      const res = await fetch(`${API_URL}/recipes?product_id=${productId}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as ApiRecipe[];
      setRecipesByProduct((prev) => ({
        ...prev,
        [productId]: data.map((r) => ({ id: r.id, name: r.name })),
      }));
    } catch {
      setRecipesByProduct((prev) => ({ ...prev, [productId]: [] }));
    }
  }

  async function ensureCost(recipeId: string, width?: number, height?: number) {
    if (!recipeId) return;
    const key = costKey(recipeId, width, height);
    if (costByRecipe[key]) return;

    try {
      const c = await fetchRecipeCost(recipeId, width, height);
      setCostByRecipe((prev) => ({ ...prev, [key]: c }));
    } catch {
      // si falla, no seteamos nada
    }
  }

  async function ensureSuggested(recipeId: string, width?: number, height?: number) {
    if (!recipeId) return;
    const key = costKey(recipeId, width, height);
    if (suggestedByRecipe[key] != null) return;

    try {
      const s = await fetchSuggestedPrice(recipeId, margin, width, height);
      setSuggestedByRecipe((prev) => ({ ...prev, [key]: s }));
    } catch {
      setSuggestedByRecipe((prev) => ({ ...prev, [key]: 0 }));
    }
  }

  // Prefetch cuando cambian recetas seleccionadas
  useEffect(() => {
    lines.forEach((l) => {
      if (!l.recipe_id) return;
      const width = l.width.trim() ? Number(l.width) : undefined;
      const height = l.height.trim() ? Number(l.height) : undefined;
      ensureCost(l.recipe_id, width, height);
      ensureSuggested(l.recipe_id, width, height);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, margin]);

  function addLine() {
    setLines((prev) => [
      ...prev,
      { key: uid(), product_id: "", recipe_id: "", qty: 1, sale_price: "", width: "", height: "" },
    ]);
  }

  function removeLine(key: string) {
    setLines((prev) => prev.filter((l) => l.key !== key));
  }

  function updateLine(key: string, patch: Partial<SaleLine>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  const computed = useMemo(() => {
    const lineViews = lines.map((l) => {
      const widthNum = l.width.trim() ? Number(l.width) : undefined;
      const heightNum = l.height.trim() ? Number(l.height) : undefined;
      const baseKey = l.recipe_id ? costKey(l.recipe_id) : "";
      const key = l.recipe_id ? costKey(l.recipe_id, widthNum, heightNum) : "";
      const suggested = l.recipe_id ? (suggestedByRecipe[key] ?? 0) : 0;
      const salePriceNum = l.sale_price.trim() ? Number(l.sale_price) : null;
      const unitPrice = salePriceNum != null && !Number.isNaN(salePriceNum) ? salePriceNum : suggested;

      const qty = Number(l.qty || 0);
      const subtotal = unitPrice * qty;

      const materialsCost = l.recipe_id ? (costByRecipe[key]?.materials_cost ?? 0) : 0;
      const costTotal = materialsCost * qty;

      return {
        ...l,
        suggested,
        unitPrice,
        subtotal,
        materialsCost,
        costTotal,
        widthNum,
        heightNum,
        costKey: key,
        baseKey,
      };
    });

    const totalSale = lineViews.reduce((a, v) => a + (Number.isFinite(v.subtotal) ? v.subtotal : 0), 0);
    const totalCost = lineViews.reduce((a, v) => a + (Number.isFinite(v.costTotal) ? v.costTotal : 0), 0);
    const profit = totalSale - totalCost;
    const marginPct = totalSale > 0 ? profit / totalSale : 0;

    return { lineViews, totalSale, totalCost, profit, marginPct };
  }, [lines, suggestedByRecipe, costByRecipe]);

  const canSubmit = useMemo(() => {
    if (loading) return false;
    if (computed.lineViews.length === 0) return false;
    // cada línea debe tener product + recipe y qty > 0
    return computed.lineViews.every((l) => {
      if (!l.product_id || !l.recipe_id || l.qty <= 0) return false;
      const isVar =
        (l.baseKey && costByRecipe[l.baseKey]?.is_variable) ||
        (l.costKey && costByRecipe[l.costKey]?.is_variable) ||
        false;
      if (isVar && (!l.widthNum || !l.heightNum)) return false;
      return true;
    });
  }, [computed.lineViews, loading, costByRecipe]);

  async function submit() {
  setLoading(true);
  setResult(null);

  try {
    const payload = {
      customer_name: clientName.trim() || null,
      notes: notes.trim() || null,
      currency: "HNL",
      margin,
      lines: computed.lineViews.map((l) => {
        const out: {
          product_id: string;
          recipe_id: string;
          qty: number;
          sale_price?: number;
          width?: number;
          height?: number;
        } = {
          product_id: l.product_id,
          recipe_id: l.recipe_id,
          qty: Number(l.qty),
        };

        // si está vacío => NO enviar sale_price (backend usa sugerido)
        const sp = l.sale_price.trim();
        if (sp !== "") out.sale_price = Number(sp);
        if (l.widthNum != null && l.heightNum != null) {
          out.width = l.widthNum;
          out.height = l.heightNum;
        }

        return out;
      }),
    };

    const res = await fetch(`${API_URL}/sales`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as SaleResponse;
    setResult(data);
  } catch {
    setResult({ error: "No se pudo conectar con el backend" });
  } finally {
    setLoading(false);
  }
}

  return (
    <main className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">Nueva Venta</h1>

      {/* Cabecera */}
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
            placeholder="Ej: entrega mañana, etc."
          />
        </label>

        <label className="grid gap-1 max-w-xs">
          <span className="font-medium">Margen (0.40 = 40%)</span>
          <input
            className="border rounded px-3 py-2"
            type="number"
            step="0.01"
            min={0}
            max={0.99}
            value={margin}
            onChange={(e) => setMargin(Number(e.target.value))}
          />
        </label>
      </div>

      {/* Resumen en vivo */}
      <div className="mb-6 grid gap-2 sm:grid-cols-3">
        <div className="stat-card">
          <div className="text-sm text-zinc-600">Total venta (preview)</div>
          <div className="text-xl font-bold">L {computed.totalSale.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="text-sm text-zinc-600">Costo (preview)</div>
          <div className="text-xl font-bold">L {computed.totalCost.toFixed(2)}</div>
        </div>
        <div className="stat-card">
          <div className="text-sm text-zinc-600">Utilidad (preview)</div>
          <div className="text-xl font-bold">
            L {computed.profit.toFixed(2)}{" "}
            <span className="text-sm text-zinc-600">
              ({(computed.marginPct * 100).toFixed(1)}%)
            </span>
          </div>
        </div>
      </div>

      {/* Líneas */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold">Líneas</div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={addLine}
            type="button"
          >
            + Agregar línea
          </button>
        </div>

        <div className="grid gap-4">
          {computed.lineViews.map((l) => {
            const isVariable =
              (l.baseKey && costByRecipe[l.baseKey]?.is_variable) ||
              (l.costKey && costByRecipe[l.costKey]?.is_variable) ||
              false;
            return (
              <div key={l.key} className="card">
              <div className="grid gap-3 sm:grid-cols-2">
                {/* Producto */}
                <label className="grid gap-1">
                  <span className="font-medium">Producto</span>
                  <select
                    className="border rounded px-3 py-2"
                    value={l.product_id}
                    onChange={(e) => {
                      const pid = e.target.value;
                      updateLine(l.key, { product_id: pid, recipe_id: "", width: "", height: "" });
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

                {/* Receta */}
                <label className="grid gap-1">
                  <span className="font-medium">Receta</span>
                  <select
                    className="border rounded px-3 py-2"
                    value={l.recipe_id}
                    onChange={(e) =>
                      updateLine(l.key, { recipe_id: e.target.value, width: "", height: "" })
                    }
                    disabled={!l.product_id}
                  >
                    <option value="">
                      {l.product_id ? "Selecciona…" : "Selecciona producto"}
                    </option>
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
                      placeholder="Ej: 1.2"
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
                      placeholder="Ej: 0.8"
                    />
                  </label>
                </div>
              )}

              <div className="grid gap-3 mt-3 sm:grid-cols-3">
                {/* Qty */}
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

                {/* Precio */}
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
                    <span className="text-xs text-zinc-600">
                      Sugerido: L {l.suggested.toFixed(2)}
                    </span>
                  )}
                </label>

                {/* Subtotal */}
                <div className="grid gap-1">
                  <span className="font-medium">Subtotal</span>
                  <div className="border rounded px-3 py-2 bg-zinc-50">
                    L {Number.isFinite(l.subtotal) ? l.subtotal.toFixed(2) : "0.00"}
                  </div>
                  <span className="text-xs text-zinc-600">
                    Costo: L {l.costTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex justify-end">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => removeLine(l.key)}
                  type="button"
                  disabled={lines.length === 1}
                  title={lines.length === 1 ? "Debe haber al menos 1 línea" : "Quitar"}
                >
                  Quitar
                </button>
              </div>
            </div>
            );
          })}
        </div>

        <button
          onClick={submit}
          disabled={!canSubmit}
          className="mt-4 btn btn-primary"
        >
          {loading ? "Registrando..." : "Registrar venta"}
        </button>
      </div>

      {/* Resultado */}
      {result && (
        <div className="card mt-6">
          {"error" in result ? (
            <div className="text-red-700 font-semibold">❌ {result.error}</div>
          ) : (
            <div>
              <div className="font-semibold text-green-700">✅ Venta creada</div>
              <div className="mt-2 grid gap-1">
                <div>
                  <b>ID:</b>{" "}
                  <Link className="font-semibold underline" href={`/sales/${result.sale_id}`}>
                    {result.sale_id}
                  </Link>
                </div>
                <div><b>Total venta:</b> {result.currency} {result.total_sale.toFixed(2)}</div>
                <div><b>Costo:</b> {result.currency} {result.total_cost.toFixed(2)}</div>
                <div><b>Utilidad:</b> {result.currency} {result.total_profit.toFixed(2)}</div>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
