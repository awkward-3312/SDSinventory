"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { API_URL } from "@/lib/api";

type RecipeItem = {
  id: string;
  recipe_id: string;
  supply_id: string;
  supply_name: string;
  unit_base: string;
  qty_base: number;
  waste_pct: number;
  avg_unit_cost: number;
  qty_formula?: string | null;
};

type RecipeCost = {
  recipe_id: string;
  items: Array<{ supply_id: string; qty_with_waste: number; unit_code?: string }>;
  materials_cost: number;
  currency: string;
  is_variable?: boolean;
};

type SuggestedPrice = {
  recipe_id: string;
  materials_cost: number;
  mode: string;
  value: number;
  suggested_price: number;
  currency: string;
};

type Supply = { id: string; name: string; unit_base: string };
type Recipe = { id: string; product_id: string; name: string; product_type?: string };

export default function RecipeDetailPage() {
  const params = useParams();
  const recipeId = String(params?.id ?? "");

  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [items, setItems] = useState<RecipeItem[]>([]);
  const [cost, setCost] = useState<RecipeCost | null>(null);
  const [price, setPrice] = useState<SuggestedPrice | null>(null);
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [supplyId, setSupplyId] = useState("");
  const [qtyBase, setQtyBase] = useState(1);
  const [wastePct, setWastePct] = useState(0);
  const [qtyFormula, setQtyFormula] = useState("");

  const [editRecipeName, setEditRecipeName] = useState("");

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editSupplyId, setEditSupplyId] = useState("");
  const [editQtyBase, setEditQtyBase] = useState(1);
  const [editWastePct, setEditWastePct] = useState(0);
  const [editQtyFormula, setEditQtyFormula] = useState("");

  const [width, setWidth] = useState(1);
  const [height, setHeight] = useState(1);

  async function load() {
    if (!recipeId) return;
    setLoading(true);
    setErr(null);
    try {
      const [rRes, iRes, sRes] = await Promise.all([
        fetch(`${API_URL}/recipes/${recipeId}`, { cache: "no-store" }),
        fetch(`${API_URL}/recipe-items?recipe_id=${recipeId}`, { cache: "no-store" }),
        fetch(`${API_URL}/supplies?include_inactive=true`, { cache: "no-store" }),
      ]);
      const rData = (await rRes.json()) as Recipe;
      const iData = (await iRes.json()) as RecipeItem[];
      const sData = (await sRes.json()) as Supply[];
      setRecipe(rData);
      setEditRecipeName(rData.name);
      setItems(iData);
      setSupplies(sData);
    } catch {
      setErr("No se pudieron cargar los datos de la receta");
    } finally {
      setLoading(false);
    }
  }

  async function loadCost() {
    if (!recipeId) return;
    try {
      const qs = `width=${encodeURIComponent(String(width))}&height=${encodeURIComponent(String(height))}`;
      const [cRes, pRes] = await Promise.all([
        fetch(`${API_URL}/recipes/${recipeId}/cost?${qs}`, { cache: "no-store" }),
        fetch(`${API_URL}/recipes/${recipeId}/suggested-price?mode=margin&value=0.4&${qs}`, {
          cache: "no-store",
        }),
      ]);
      if (!cRes.ok) {
        setErr(await readError(cRes, "No se pudo calcular costo"));
        return;
      }
      if (!pRes.ok) {
        setErr(await readError(pRes, "No se pudo calcular precio sugerido"));
        return;
      }
      const cData = (await cRes.json()) as RecipeCost;
      const pData = (await pRes.json()) as SuggestedPrice;
      setCost(cData);
      setPrice(pData);
    } catch {
      setErr("No se pudo calcular costo");
    }
  }

  useEffect(() => {
    load();
  }, [recipeId]);

  useEffect(() => {
    loadCost();
  }, [recipeId, width, height]);

  async function addItem() {
    if (!recipeId || !supplyId) return;
    setLoading(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch(`${API_URL}/recipe-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipe_id: recipeId,
          supply_id: supplyId,
          qty_base: Number(qtyBase),
          waste_pct: Number(wastePct),
          qty_formula: qtyFormula.trim() || null,
        }),
      });
      if (!res.ok) {
        const msg = await readError(res, "No se pudo agregar el insumo");
        setErr(msg);
        return;
      }
      setSupplyId("");
      setQtyBase(1);
      setWastePct(0);
      setQtyFormula("");
      setNotice("✅ Insumo agregado");
      await load();
      await loadCost();
    } catch {
      setErr("No se pudo agregar el insumo");
    } finally {
      setLoading(false);
    }
  }

  function startEditItem(it: RecipeItem) {
    setEditingItemId(it.id);
    setEditSupplyId(it.supply_id);
    setEditQtyBase(it.qty_base);
    setEditWastePct(it.waste_pct);
    setEditQtyFormula(it.qty_formula || "");
  }

  async function saveItemEdit(itemId: string) {
    if (!recipeId) return;
    setLoading(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch(`${API_URL}/recipe-items/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipe_id: recipeId,
          supply_id: editSupplyId,
          qty_base: Number(editQtyBase),
          waste_pct: Number(editWastePct),
          qty_formula: editQtyFormula.trim() || null,
        }),
      });
      if (!res.ok) {
        const msg = await readError(res, "No se pudo actualizar el insumo");
        setErr(msg);
        return;
      }
      setEditingItemId(null);
      setNotice("✅ Insumo actualizado");
      await load();
      await loadCost();
    } catch (e) {
      setErr("No se pudo actualizar el insumo");
    } finally {
      setLoading(false);
    }
  }

  async function deleteItem(itemId: string) {
    if (!recipeId) return;
    const target = items.find((i) => i.id === itemId)?.supply_name ?? "este insumo";
    if (!confirm(`¿Eliminar "${target}" de la receta?`)) return;
    setLoading(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch(`${API_URL}/recipe-items/${itemId}`, { method: "DELETE" });
      if (!res.ok) {
        const msg = await readError(res, "No se pudo eliminar el insumo");
        setErr(msg);
        return;
      }
      setNotice("✅ Insumo eliminado");
      await load();
      await loadCost();
    } catch {
      setErr("No se pudo eliminar el insumo");
    } finally {
      setLoading(false);
    }
  }

  async function saveRecipeName() {
    if (!recipeId) return;
    setLoading(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch(`${API_URL}/recipes/${recipeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editRecipeName.trim() || "Base" }),
      });
      if (!res.ok) {
        const msg = await readError(res, "No se pudo actualizar la receta");
        setErr(msg);
        return;
      }
      setNotice("✅ Receta actualizada");
      await load();
    } catch {
      setErr("No se pudo actualizar la receta");
    } finally {
      setLoading(false);
    }
  }

  async function deleteRecipe() {
    if (!recipeId) return;
    if (!confirm(`¿Eliminar la receta "${recipe?.name ?? "esta receta"}"?`)) return;
    setLoading(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch(`${API_URL}/recipes/${recipeId}`, { method: "DELETE" });
      if (!res.ok) {
        const msg = await readError(res, "No se pudo eliminar la receta");
        setErr(msg);
        return;
      }
      setNotice("✅ Receta eliminada");
      if (recipe?.product_id) {
        window.location.href = `/products/${recipe.product_id}`;
      } else {
        window.location.href = "/products";
      }
    } catch {
      setErr("No se pudo eliminar la receta");
    } finally {
      setLoading(false);
    }
  }

  const isVariable = cost?.is_variable || items.some((i) => i.qty_formula);
  const consumptionBySupply = useMemo(() => {
    const map = new Map<string, number>();
    (cost?.items || []).forEach((it) => {
      if (it.supply_id) map.set(it.supply_id, Number(it.qty_with_waste));
    });
    return map;
  }, [cost]);

  async function readError(res: Response, fallback: string): Promise<string> {
    try {
      const data = await res.json();
      return data?.detail || data?.error || fallback;
    } catch {
      const text = await res.text().catch(() => "");
      return text || fallback;
    }
  }

  return (
    <main className="p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <div>
          <h1 className="text-2xl font-bold">Receta (BOM)</h1>
          {recipe && (
            <div className="text-sm text-zinc-600">
              {recipe.name} • {recipe.product_type === "variable" ? "Variable" : "Fija"}
            </div>
          )}
        </div>
        <Link className="font-semibold hover:underline" href="/products">
          ← Volver a Productos
        </Link>
      </div>

      {recipe && (
        <div className="card mb-6">
          <div className="font-semibold mb-2">Editar receta</div>
          <div className="flex gap-2 flex-wrap items-end">
            <label className="grid gap-1">
              <span className="text-sm font-medium">Nombre</span>
              <input
                className="border rounded px-3 py-2"
                value={editRecipeName}
                onChange={(e) => setEditRecipeName(e.target.value)}
              />
            </label>
            <button className="btn btn-primary" onClick={saveRecipeName} disabled={loading}>
              Guardar
            </button>
            <button className="btn btn-secondary" onClick={deleteRecipe} disabled={loading}>
              Eliminar receta
            </button>
          </div>
        </div>
      )}

      <div className="card mb-4">
        <div className="font-semibold mb-2">Vista previa</div>
        {isVariable && (
          <div className="grid gap-3 sm:grid-cols-3 mb-3">
            <label className="grid gap-1">
              <span className="text-sm font-medium">Ancho</span>
              <input
                className="border rounded px-3 py-2"
                type="number"
                min={0}
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-medium">Alto</span>
              <input
                className="border rounded px-3 py-2"
                type="number"
                min={0}
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
              />
            </label>
            <div className="text-xs text-zinc-600 mt-6">
              Fórmulas permiten variables `width`/`height` (o `ancho`/`alto`)
            </div>
          </div>
        )}

        {cost && (
          <div className="text-2xl font-bold">
            {cost.currency} {cost.materials_cost}
          </div>
        )}
        <div className="text-xs text-zinc-600 mt-2">
          Nota: si el insumo es por pieza, la merma se calcula como rendimiento real (no como +%).
        </div>
      </div>

      {price && (
        <div className="card mb-6 bg-green-50 border-green-200">
          <div className="font-semibold text-green-700">Precio sugerido (margen 40%)</div>
          <div className="text-2xl font-bold text-green-800">
            {price.currency} {price.suggested_price}
          </div>
        </div>
      )}

      <div className="card mb-6">
        <div className="font-semibold mb-2">Agregar insumo</div>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="grid gap-1 sm:col-span-2">
            <span className="text-sm font-medium">Insumo</span>
            <select
              className="border rounded px-3 py-2"
              value={supplyId}
              onChange={(e) => setSupplyId(e.target.value)}
            >
              <option value="">Selecciona…</option>
              {supplies.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.unit_base})
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Cantidad base</span>
            <input
              className="border rounded px-3 py-2"
              type="number"
              min={0}
              value={qtyBase}
              onChange={(e) => setQtyBase(Number(e.target.value))}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Merma %</span>
            <input
              className="border rounded px-3 py-2"
              type="number"
              min={0}
              value={wastePct}
              onChange={(e) => setWastePct(Number(e.target.value))}
            />
          </label>
        </div>
        <div className="grid gap-2 mt-3">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Fórmula (opcional)</span>
            <input
              className="border rounded px-3 py-2"
              value={qtyFormula}
              onChange={(e) => setQtyFormula(e.target.value)}
              placeholder="Ej: width * height * 1.15"
            />
          </label>
          <div className="text-xs text-zinc-600">
            Si usas fórmula, la cantidad base queda como respaldo (no se usa en cálculos).
          </div>
        </div>
        <div className="mt-3">
          <button className="btn btn-primary" onClick={addItem} disabled={!supplyId || loading}>
            Agregar
          </button>
        </div>
      </div>

      {err && <div className="mb-3 text-red-700 font-semibold">❌ {err}</div>}
      {notice && <div className="mb-3 text-green-700 font-semibold">{notice}</div>}

      {items.length === 0 ? (
        <p className="text-zinc-600">Esta receta no tiene insumos aún.</p>
      ) : (
        <table className="table-base w-full">
          <thead>
            <tr>
              <th className="border p-2 text-left">Insumo</th>
              <th className="border p-2 text-right">Cantidad</th>
              <th className="border p-2 text-right">Merma %</th>
              <th className="border p-2 text-right">Fórmula</th>
              <th className="border p-2 text-right">Consumo real</th>
              <th className="border p-2 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td className="border p-2">
                  {editingItemId === it.id ? (
                    <select
                      className="border rounded px-2 py-1"
                      value={editSupplyId}
                      onChange={(e) => setEditSupplyId(e.target.value)}
                    >
                      <option value="">Selecciona…</option>
                      {supplies.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.unit_base})
                        </option>
                      ))}
                    </select>
                  ) : (
                    it.supply_name
                  )}
                </td>
                <td className="border p-2 text-right">
                  {editingItemId === it.id ? (
                    <input
                      className="border rounded px-2 py-1 w-24 text-right"
                      type="number"
                      min={0}
                      value={editQtyBase}
                      onChange={(e) => setEditQtyBase(Number(e.target.value))}
                    />
                  ) : (
                    `${it.qty_base} ${it.unit_base}`
                  )}
                </td>
                <td className="border p-2 text-right">
                  {editingItemId === it.id ? (
                    <input
                      className="border rounded px-2 py-1 w-20 text-right"
                      type="number"
                      min={0}
                      value={editWastePct}
                      onChange={(e) => setEditWastePct(Number(e.target.value))}
                    />
                  ) : (
                    it.waste_pct
                  )}
                </td>
                <td className="border p-2 text-right">
                  {editingItemId === it.id ? (
                    <input
                      className="border rounded px-2 py-1"
                      value={editQtyFormula}
                      onChange={(e) => setEditQtyFormula(e.target.value)}
                    />
                  ) : (
                    it.qty_formula || "—"
                  )}
                </td>
                <td className="border p-2 text-right">
                  {consumptionBySupply.has(it.supply_id)
                    ? `${(consumptionBySupply.get(it.supply_id) || 0).toFixed(3)} ${it.unit_base}`
                    : "—"}
                </td>
                <td className="border p-2">
                  {editingItemId === it.id ? (
                    <div className="flex gap-2 flex-wrap">
                      <button className="btn btn-primary btn-sm" onClick={() => saveItemEdit(it.id)}>
                        Guardar
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditingItemId(null)}>
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      <button className="btn btn-secondary btn-sm" onClick={() => startEditItem(it)}>
                        Editar
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => deleteItem(it.id)}>
                        Eliminar
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
