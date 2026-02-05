"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { API_URL } from "@/lib/api";

type Recipe = {
  id: string;
  product_id: string;
  name: string;
  created_at: string;
};

type Product = {
  id: string;
  name: string;
  product_type?: string;
};

export default function ProductDetailPage() {
  const params = useParams();
  const productId = String(params?.id ?? "");
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [recipeName, setRecipeName] = useState("Base");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function load() {
    if (!productId) return;
    setLoading(true);
    setErr(null);
    try {
      const [pRes, rRes] = await Promise.all([
        fetch(`${API_URL}/products/${productId}`, { cache: "no-store" }),
        fetch(`${API_URL}/recipes?product_id=${productId}`, { cache: "no-store" }),
      ]);
      const pData = (await pRes.json()) as Product;
      const rData = (await rRes.json()) as Recipe[];
      setProduct(pData);
      setRecipes(rData);
    } catch {
      setErr("No se pudieron cargar las recetas");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, [productId]);

  async function createRecipe() {
    if (!productId) return;
    setLoading(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch(`${API_URL}/recipes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: productId, name: recipeName.trim() || "Base" }),
      });
      if (!res.ok) {
        const msg = await readError(res, "No se pudo crear la receta");
        setErr(msg);
        return;
      }
      setRecipeName("Base");
      setNotice("✅ Receta creada");
      await load();
    } catch {
      setErr("No se pudo crear la receta");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(r: Recipe) {
    setEditingId(r.id);
    setEditName(r.name);
  }

  async function saveEdit(recipeId: string) {
    setLoading(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch(`${API_URL}/recipes/${recipeId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editName.trim() || "Base" }),
      });
      if (!res.ok) {
        const msg = await readError(res, "No se pudo actualizar la receta");
        setErr(msg);
        return;
      }
      setEditingId(null);
      setNotice("✅ Receta actualizada");
      await load();
    } catch {
      setErr("No se pudo actualizar la receta");
    } finally {
      setLoading(false);
    }
  }

  async function deleteRecipe(recipeId: string) {
    const target = recipes.find((r) => r.id === recipeId)?.name ?? "esta receta";
    if (!confirm(`¿Eliminar "${target}"?\nSe eliminarán sus insumos.`)) return;
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
      await load();
    } catch {
      setErr("No se pudo eliminar la receta");
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
        <div>
          <h1 className="text-2xl font-bold">Recetas (BOM)</h1>
          {product && (
            <div className="text-sm text-zinc-600">
              Producto: <b>{product.name}</b>{" "}
              {product.product_type === "variable" ? "• Variable" : "• Fijo"}
            </div>
          )}
        </div>
        <Link className="font-semibold hover:underline" href="/products">
          ← Volver a Productos
        </Link>
      </div>

      <div className="card mb-6">
        <div className="font-semibold mb-2">Crear receta</div>
        <div className="flex gap-2 flex-wrap items-end">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Nombre</span>
            <input
              className="border rounded px-3 py-2"
              value={recipeName}
              onChange={(e) => setRecipeName(e.target.value)}
            />
          </label>
          <button className="btn btn-primary" onClick={createRecipe} disabled={loading}>
            Crear
          </button>
        </div>
      </div>

      {err && <div className="mb-3 text-red-700 font-semibold">❌ {err}</div>}
      {notice && <div className="mb-3 text-green-700 font-semibold">{notice}</div>}

      {recipes.length === 0 ? (
        <p className="text-zinc-600">Este producto no tiene recetas aún.</p>
      ) : (
        <table className="table-base w-full">
          <thead>
            <tr>
              <th className="border p-2 text-left">Nombre</th>
              <th className="border p-2 text-left">Creada</th>
              <th className="border p-2 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {recipes.map((r) => (
              <tr key={r.id}>
                <td className="border p-2 font-medium">
                  {editingId === r.id ? (
                    <input
                      className="border rounded px-2 py-1"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                    />
                  ) : (
                    <Link className="hover:underline text-blue-700" href={`/recipes/${r.id}`}>
                      {r.name}
                    </Link>
                  )}
                </td>
                <td className="border p-2">{new Date(r.created_at).toLocaleString()}</td>
                <td className="border p-2">
                  {editingId === r.id ? (
                    <div className="flex gap-2 flex-wrap">
                      <button className="btn btn-primary btn-sm" onClick={() => saveEdit(r.id)}>
                        Guardar
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}>
                        Cancelar
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2 flex-wrap">
                      <button className="btn btn-secondary btn-sm" onClick={() => startEdit(r)}>
                        Editar
                      </button>
                      <button className="btn btn-secondary btn-sm" onClick={() => deleteRecipe(r.id)}>
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
