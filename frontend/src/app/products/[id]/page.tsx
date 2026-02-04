import Link from "next/link";

type Recipe = {
  id: string;
  product_id: string;
  name: string;
  created_at: string;
};

async function getRecipes(productId: string): Promise<Recipe[]> {
  const res = await fetch(
    `http://127.0.0.1:8000/recipes?product_id=${productId}`,
    { cache: "no-store" }
  );

  if (!res.ok) {
    throw new Error("Error al cargar recetas");
  }

  return res.json();
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: productId } = await params;
  const recipes = await getRecipes(productId);

  return (
    <main className="p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold">Recetas (BOM)</h1>
        <Link className="font-semibold hover:underline" href="/products">
          ← Volver a Productos
        </Link>
      </div>

      {recipes.length === 0 ? (
        <p className="text-zinc-600">Este producto no tiene recetas aún.</p>
      ) : (
        <table className="w-full border border-gray-300 border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2 text-left">Nombre</th>
              <th className="border p-2 text-left">Creada</th>
            </tr>
          </thead>
          <tbody>
            {recipes.map((r) => (
              <tr key={r.id}>
                <td className="border p-2 font-medium">
  <Link className="hover:underline text-blue-700" href={`/recipes/${r.id}`}>
    {r.name}
  </Link>
</td>

                <td className="border p-2">{new Date(r.created_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}