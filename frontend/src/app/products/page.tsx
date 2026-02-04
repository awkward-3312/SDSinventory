import Link from "next/link";

type Product = {
  id: string;
  name: string;
  active: boolean;
  created_at: string;
};

async function getProducts(): Promise<Product[]> {
  const res = await fetch("http://127.0.0.1:8000/products", {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Error al cargar productos");
  }

  return res.json();
}

export default async function ProductsPage() {
  const products = await getProducts();

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Productos</h1>

      <table className="w-full border border-gray-300 border-collapse">
        <thead className="bg-gray-100">
          <tr>
            <th className="border p-2 text-left">Nombre</th>
            <th className="border p-2 text-right">Activo</th>
          </tr>
        </thead>

        <tbody>
          {products.map((p) => (
            <tr key={p.id}>
              <td className="border p-2">
                <Link
                  href={`/products/${p.id}`}
                  className="font-semibold hover:underline text-blue-700"
                >
                  {p.name}
                </Link>
              </td>
              <td className="border p-2 text-right">
                {p.active ? "Sí" : "No"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
