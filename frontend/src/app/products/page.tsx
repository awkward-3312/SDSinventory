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
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [productType, setProductType] = useState("fixed");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editType, setEditType] = useState("fixed");

  const canCreate = name.trim().length > 0;

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${API_URL}/products?include_inactive=true`, { cache: "no-store" });
      const data = (await res.json()) as Product[];
      setProducts(data);
    } catch {
      setErr("No se pudieron cargar productos");
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
        body: JSON.stringify({ name: name.trim(), product_type: productType }),
      });
      if (!res.ok) throw new Error("create");
      setName("");
      setProductType("fixed");
      await load();
    } catch {
      setErr("No se pudo crear el producto");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(p: Product) {
    setEditingId(p.id);
    setEditName(p.name);
    setEditType(p.product_type ?? "fixed");
  }

  async function saveEdit(productId: string) {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${API_URL}/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim(), product_type: editType }),
      });
      if (!res.ok) throw new Error("update");
      setEditingId(null);
      await load();
    } catch {
      setErr("No se pudo actualizar el producto");
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
      if (!res.ok) throw new Error("active");
      await load();
    } catch {
      setErr("No se pudo cambiar el estado");
    } finally {
      setLoading(false);
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
        <div className="font-semibold mb-2">Crear producto</div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1 sm:col-span-2">
            <span className="text-sm font-medium">Nombre</span>
            <input
              className="border rounded px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Banner"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Tipo</span>
            <select
              className="border rounded px-3 py-2"
              value={productType}
              onChange={(e) => setProductType(e.target.value)}
            >
              <option value="fixed">Fijo</option>
              <option value="variable">Variable</option>
            </select>
          </label>
        </div>
        <div className="mt-3">
          <button className="btn btn-primary" onClick={createProduct} disabled={!canCreate || loading}>
            Guardar producto
          </button>
        </div>
      </div>

      {err && <div className="mb-3 text-red-700 font-semibold">❌ {err}</div>}

      <table className="table-base w-full">
        <thead>
          <tr>
            <th className="border p-2 text-left">Nombre</th>
            <th className="border p-2 text-left">Tipo</th>
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
              <td className="border p-3 text-center text-zinc-600" colSpan={4}>
                Sin productos
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
