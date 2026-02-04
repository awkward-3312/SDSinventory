import Link from "next/link";

type RecipeItem = {
  id: string;
  recipe_id: string;
  supply_id: string;
  supply_name: string;
  unit_base: string;
  qty_base: number;
  waste_pct: number;
  avg_unit_cost: number;
};

type RecipeCost = {
  recipe_id: string;
  items: unknown[];
  materials_cost: number;
  currency: string; // "HNL"
};

type SuggestedPrice = {
  recipe_id: string;
  materials_cost: number;
  mode: string;
  value: number;
  suggested_price: number;
  currency: string;
};

async function getRecipeItems(recipeId: string): Promise<RecipeItem[]> {
  const res = await fetch(
    `http://127.0.0.1:8000/recipe-items?recipe_id=${recipeId}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error("Error al cargar items de receta");
  }

  return res.json();
}

async function getRecipeCost(recipeId: string): Promise<RecipeCost> {
  const res = await fetch(
    `http://127.0.0.1:8000/recipes/${recipeId}/cost`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error("Error al cargar costo de receta");
  }

  return res.json();
}

async function getSuggestedPrice(recipeId: string): Promise<SuggestedPrice> {
  const res = await fetch(
    `http://127.0.0.1:8000/recipes/${recipeId}/suggested-price?mode=margin&value=0.4`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error("Error al cargar precio sugerido");
  }

  return res.json();
}

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: recipeId } = await params;

  const [items, cost, price] = await Promise.all([
    getRecipeItems(recipeId),
    getRecipeCost(recipeId),
    getSuggestedPrice(recipeId),
  ]);

  return (
    <main className="p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold">Receta (BOM)</h1>
        <Link className="font-semibold hover:underline" href="/products">
          ← Volver a Productos
        </Link>
      </div>

      {/* Costo */}
      <div className="mb-4 rounded-lg border p-3 bg-white">
        <div className="font-semibold">Costo de materiales</div>
        <div className="text-2xl font-bold">
          {cost.currency} {cost.materials_cost}
        </div>
      </div>

      {/* Precio sugerido */}
      <div className="mb-6 rounded-lg border p-3 bg-green-50">
        <div className="font-semibold text-green-700">
          Precio sugerido (margen 40%)
        </div>
        <div className="text-2xl font-bold text-green-800">
          {price.currency} {price.suggested_price}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="text-zinc-600">Esta receta no tiene insumos aún.</p>
      ) : (
        <table className="w-full border border-gray-300 border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2 text-left">Insumo</th>
              <th className="border p-2 text-right">Cantidad</th>
              <th className="border p-2 text-right">Merma %</th>
              <th className="border p-2 text-right">Costo prom.</th>
            </tr>
          </thead>
          <tbody>
            {items.map((it) => (
              <tr key={it.id}>
                <td className="border p-2">{it.supply_name}</td>
                <td className="border p-2 text-right">
                  {it.qty_base} {it.unit_base}
                </td>
                <td className="border p-2 text-right">{it.waste_pct}</td>
                <td className="border p-2 text-right">
                  L {it.avg_unit_cost}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
