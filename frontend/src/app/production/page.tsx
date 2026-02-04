"use client";

import { useEffect, useState } from "react";

type Product = {
  id: string;
  name: string;
};

type Recipe = {
  id: string;
  name: string;
};

type ApiProduct = { id: string; name: string };
type ApiRecipe = { id: string; name: string };

type Consumption = {
  supply_id: string;
  qty_base: number;
  unit_cost: number;
};

type ProductionOk = {
  production_id: string;
  materials_cost: number;
  currency: string;
  consumptions: Consumption[];
};

type ProductionErr = {
  error: string;
  [key: string]: unknown;
};

type ProductionResponse = ProductionOk | ProductionErr;

type RecipeCost = { recipe_id: string; materials_cost: number; currency: string };

type SuggestedPrice = {
  recipe_id: string;
  suggested_price: number;
  currency: string;
};

function isOk(r: ProductionResponse): r is ProductionOk {
  return "production_id" in r;
}

async function fetchRecipeCost(recipeId: string): Promise<RecipeCost> {
  const res = await fetch(`http://127.0.0.1:8000/recipes/${recipeId}/cost`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("cost");
  const data = (await res.json()) as {
    recipe_id: string;
    materials_cost: number;
    currency: string;
  };
  return {
    recipe_id: data.recipe_id,
    materials_cost: data.materials_cost,
    currency: data.currency,
  };
}

async function fetchSuggestedPrice(recipeId: string): Promise<SuggestedPrice> {
  const res = await fetch(
    `http://127.0.0.1:8000/recipes/${recipeId}/suggested-price?mode=margin&value=0.4`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("price");
  const data = (await res.json()) as {
    recipe_id: string;
    suggested_price: number;
    currency: string;
  };
  return {
    recipe_id: data.recipe_id,
    suggested_price: data.suggested_price,
    currency: data.currency,
  };
}

export default function ProductionPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [productId, setProductId] = useState("");
  const [recipeId, setRecipeId] = useState("");
  const [qty, setQty] = useState<number>(1);
  const [result, setResult] = useState<ProductionResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const [previewCost, setPreviewCost] = useState<RecipeCost | null>(null);
  const [previewPrice, setPreviewPrice] = useState<SuggestedPrice | null>(null);

  // Cargar productos
  useEffect(() => {
    fetch("http://127.0.0.1:8000/products")
      .then((r) => r.json() as Promise<ApiProduct[]>)
      .then((data) => setProducts(data.map((p) => ({ id: p.id, name: p.name }))))
      .catch(() => setProducts([]));
  }, []);

  // Cargar recetas cuando cambia el producto
  useEffect(() => {
    if (!productId) {
      setRecipes([]);
      setRecipeId("");
      setPreviewCost(null);
      setPreviewPrice(null);
      return;
    }

    fetch(`http://127.0.0.1:8000/recipes?product_id=${encodeURIComponent(productId)}`)
      .then((r) => r.json() as Promise<ApiRecipe[]>)
      .then((data) => setRecipes(data.map((rec) => ({ id: rec.id, name: rec.name }))))
      .catch(() => setRecipes([]));
  }, [productId]);

  // Cargar preview cuando cambia recipeId
  useEffect(() => {
    if (!recipeId) {
      setPreviewCost(null);
      setPreviewPrice(null);
      return;
    }

    Promise.all([fetchRecipeCost(recipeId), fetchSuggestedPrice(recipeId)])
      .then(([c, p]) => {
        setPreviewCost(c);
        setPreviewPrice(p);
      })
      .catch(() => {
        setPreviewCost(null);
        setPreviewPrice(null);
      });
  }, [recipeId]);

  async function submit() {
    setLoading(true);
    setResult(null);

    try {
      const res = await fetch("http://127.0.0.1:8000/production", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          product_id: productId,
          recipe_id: recipeId,
          qty,
        }),
      });

      const data = (await res.json()) as ProductionResponse;
      setResult(data);
    } catch {
      setResult({ error: "No se pudo conectar con el backend" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="p-6 max-w-2xl">
      <h1 className="text-2xl font-bold mb-4">Registrar Producción</h1>

      <div className="grid gap-3">
        {/* Producto */}
        <label className="grid gap-1">
          <span className="font-medium">Producto</span>
          <select
            className="border rounded px-3 py-2"
            value={productId}
            onChange={(e) => {
              setProductId(e.target.value);
              setResult(null);
            }}
          >
            <option value="">Selecciona un producto…</option>
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
            value={recipeId}
            onChange={(e) => {
              setRecipeId(e.target.value);
              setResult(null);
            }}
            disabled={!recipes.length}
          >
            <option value="">
              {recipes.length ? "Selecciona una receta…" : "Selecciona primero un producto"}
            </option>
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>

        {/* Preview */}
        {previewCost && previewPrice && (
          <div className="rounded border p-3 bg-white">
            <div className="font-semibold mb-1">Preview</div>
            <div className="text-sm">
              <b>Costo materiales:</b> {previewCost.currency} {previewCost.materials_cost}
            </div>
            <div className="text-sm">
              <b>Precio sugerido (margen 40%):</b> {previewPrice.currency} {previewPrice.suggested_price}
            </div>
          </div>
        )}

        {/* Cantidad */}
        <label className="grid gap-1">
          <span className="font-medium">Cantidad</span>
          <input
            className="border rounded px-3 py-2"
            type="number"
            min={1}
            value={qty}
            onChange={(e) => setQty(Number(e.target.value))}
          />
        </label>

        <button
          onClick={submit}
          disabled={!productId || !recipeId || qty <= 0 || loading}
          className="rounded bg-black text-white px-4 py-2 disabled:opacity-50"
        >
          {loading ? "Registrando..." : "Registrar"}
        </button>
      </div>

      {result && (
        <div className="mt-6 rounded border p-4 bg-white">
          {!isOk(result) ? (
            <div className="text-red-700 font-semibold">❌ {result.error}</div>
          ) : (
            <div>
              <div className="font-semibold text-green-700">✅ Producción creada</div>

              <div className="mt-2">
                <div>
                  <b>ID:</b> {result.production_id}
                </div>
                <div>
                  <b>Costo materiales:</b> {result.currency} {result.materials_cost}
                </div>
              </div>

              {/* NUEVO: lista consumptions + link a kardex */}
              {result.consumptions.length > 0 && (
                <div className="mt-4">
                  <div className="font-semibold mb-2">Insumos consumidos</div>

                  <ul className="grid gap-2">
                    {result.consumptions.map((c) => (
                      <li
                        key={c.supply_id}
                        className="flex items-center justify-between gap-3 rounded border p-3"
                      >
                        <div className="text-sm">
                          <div>
                            <b>Supply:</b> {c.supply_id}
                          </div>
                          <div>
                            <b>Cant.:</b> {c.qty_base}
                          </div>
                          <div>
                            <b>Costo u:</b> L {c.unit_cost}
                          </div>
                        </div>

                        <a
                          className="rounded border px-3 py-2 hover:bg-zinc-50"
                          href={`/kardex?supply_id=${encodeURIComponent(c.supply_id)}`}
                        >
                          Ver Kardex →
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </main>
  );
}