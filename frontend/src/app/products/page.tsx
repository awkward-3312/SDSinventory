"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { API_URL } from "@/lib/api";

type Product = {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
  product_type?: string;
  category?: string | null;
  unit_sale?: string | null;
  margin_target?: number | null;
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [productType, setProductType] = useState("fixed");
  const [category, setCategory] = useState("");
  const [unitSale, setUnitSale] = useState("");
  const [marginPct, setMarginPct] = useState<number>(40);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("fixed");
  const [editCategory, setEditCategory] = useState("");
  const [editUnitSale, setEditUnitSale] = useState("");
  const [editMarginPct, setEditMarginPct] = useState<number>(40);

  const canCreate = name.trim().length > 0;

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${API_URL}/products?include_inactive=true`, { cache: "no-store" });
      if (!res.ok) {
        const msg = await readError(res, "No se pudieron cargar productos");
        throw new Error(msg);
      }
      const data = (await res.json()) as Product[];
      setProducts(data);
    } catch (e) {
      const msg =
        e instanceof Error
          ? e.message
          : "No se pudieron cargar productos. Revisa que el backend esté activo y las migraciones aplicadas.";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createProduct() {
    if (!canCreate) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${API_URL}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          product_type: productType,
          category: category.trim() || null,
          unit_sale: unitSale.trim() || null,
          margin_target: Math.min(Math.max(Number(marginPct) / 100, 0), 0.99),
        }),
      });
      if (!res.ok) {
        const msg = await readError(res, "No se pudo crear el producto");
        throw new Error(msg);
      }
      setName("");
      setProductType("fixed");
      setCategory("");
      setUnitSale("");
      setMarginPct(40);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo crear el producto";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  function startEdit(p: Product) {
    setEditingId(p.id);
    setEditName(p.name);
    setEditType(p.product_type ?? "fixed");
    setEditCategory(p.category ?? "");
    setEditUnitSale(p.unit_sale ?? "");
    setEditMarginPct(Number((p.margin_target ?? 0.4) * 100));
  }

  async function saveEdit(productId: string) {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${API_URL}/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          product_type: editType,
          category: editCategory.trim() || null,
          unit_sale: editUnitSale.trim() || null,
          margin_target: Math.min(Math.max(Number(editMarginPct) / 100, 0), 0.99),
        }),
      });
      if (!res.ok) {
        const msg = await readError(res, "No se pudo actualizar el producto");
        throw new Error(msg);
      }
      setEditingId(null);
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo actualizar el producto";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  async function setActive(productId: string, active: boolean) {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${API_URL}/products/${productId}/active`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) {
        const msg = await readError(res, "No se pudo cambiar el estado");
        throw new Error(msg);
      }
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo cambiar el estado";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

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
        <h1 className="text-2xl font-bold">Productos</h1>
        <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>
          {loading ? "Cargando..." : "Refrescar"}
        </button>
      </div>

      <div className="card mb-6">
        <div className="font-semibold mb-1">Guía rápida</div>
        <div className="text-sm text-zinc-600">
          1. Crea el producto y su categoría • 2. Define la receta (BOM) y margen • 3. Usa ventas/cotizaciones para precio final.
        </div>
      </div>

      <div className="card mb-6">
        <div className="font-semibold mb-2">Crear producto</div>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="grid gap-1 sm:col-span-2">
            <span className="text-sm font-medium">Nombre del producto</span>
            <input
              className="border rounded px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Banner 1.20 x 2.00"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Categoría</span>
            <input
              className="border rounded px-3 py-2"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Ej: Banner, Camisa"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Unidad de venta</span>
            <input
              className="border rounded px-3 py-2"
              value={unitSale}
              onChange={(e) => setUnitSale(e.target.value)}
              placeholder="Ej: unidad, m²"
            />
          </label>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 mt-3">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Tipo de receta</span>
            <select
              className="border rounded px-3 py-2"
              value={productType}
              onChange={(e) => setProductType(e.target.value)}
            >
              <option value="fixed">Fijo (sin medidas)</option>
              <option value="variable">Variable (usa ancho/alto)</option>
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Margen objetivo (%)</span>
            <input
              className="border rounded px-3 py-2"
              type="number"
              min={0}
              max={99}
              value={marginPct}
              onChange={(e) => setMarginPct(Number(e.target.value))}
            />
          </label>
          <div className="text-xs text-zinc-600 mt-6">
            Este margen se usará como sugerido en recetas, ventas y cotizaciones.
          </div>
        </div>
        <div className="mt-3">
          <button className="btn btn-primary" onClick={createProduct} disabled={!canCreate || loading}>
            Guardar producto
          </button>
        </div>
      </div>

      {err && <div className="mb-3 text-red-700 font-semibold">❌ {err}</div>}

      <div className="overflow-x-auto">
        <table className="table-base w-full">
          <thead>
            <tr>
              <th className="border p-2 text-left">Nombre</th>
              <th className="border p-2 text-left">Categoría</th>
              <th className="border p-2 text-left">Unidad</th>
              <th className="border p-2 text-left">Tipo</th>
              <th className="border p-2 text-right">Margen</th>
              <th className="border p-2 text-left">Estado</th>
              <th className="border p-2 text-left">Acciones</th>
            </tr>
          </thead>

          <tbody>
            {products.map((p) => {
              const isEditing = editingId === p.id;
              const isActive = p.active !== false;
              return (
                <tr key={p.id}>
                  <td className="border p-2">
                    {isEditing ? (
                      <input
                        className="border rounded px-2 py-1"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    ) : (
                      <Link href={`/products/${p.id}`} className="font-semibold hover:underline text-blue-700">
                        {p.name}
                      </Link>
                    )}
                  </td>
                  <td className="border p-2">
                    {isEditing ? (
                      <input
                        className="border rounded px-2 py-1"
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        placeholder="Ej: Banner"
                      />
                    ) : (
                      p.category || "—"
                    )}
                  </td>
                  <td className="border p-2">
                    {isEditing ? (
                      <input
                        className="border rounded px-2 py-1"
                        value={editUnitSale}
                        onChange={(e) => setEditUnitSale(e.target.value)}
                        placeholder="Ej: unidad"
                      />
                    ) : (
                      p.unit_sale || "—"
                    )}
                  </td>
                  <td className="border p-2">
                    {isEditing ? (
                      <select
                        className="border rounded px-2 py-1"
                        value={editType}
                        onChange={(e) => setEditType(e.target.value)}
                      >
                        <option value="fixed">Fijo</option>
                        <option value="variable">Variable</option>
                      </select>
                    ) : (
                      p.product_type === "variable" ? "Variable" : "Fijo"
                    )}
                  </td>
                  <td className="border p-2 text-right">
                    {isEditing ? (
                      <input
                        className="border rounded px-2 py-1 w-20 text-right"
                        type="number"
                        min={0}
                        max={99}
                        value={editMarginPct}
                        onChange={(e) => setEditMarginPct(Number(e.target.value))}
                      />
                    ) : (
                      `${Number((p.margin_target ?? 0.4) * 100).toFixed(0)}%`
                    )}
                  </td>
                  <td className="border p-2">{isActive ? "Activo" : "Inactivo"}</td>
                  <td className="border p-2">
                    <div className="flex gap-2 flex-wrap">
                      {isEditing ? (
                        <>
                          <button className="btn btn-primary btn-sm" onClick={() => saveEdit(p.id)}>
                            Guardar
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}>
                            Cancelar
                          </button>
                        </>
                      ) : (
                        <>
                          <button className="btn btn-secondary btn-sm" onClick={() => startEdit(p)}>
                            Editar
                          </button>
                          <Link className="btn btn-outline btn-sm" href={`/products/${p.id}`}>
                            Receta
                          </Link>
                          <button className="btn btn-outline btn-sm" onClick={() => setActive(p.id, !isActive)}>
                            {isActive ? "Desactivar" : "Activar"}
                          </button>
                          <button className="btn btn-secondary btn-sm" onClick={() => setActive(p.id, false)}>
                            Eliminar
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {products.length === 0 && (
              <tr>
                <td className="border p-3 text-center text-zinc-600" colSpan={7}>
                  Sin productos
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
