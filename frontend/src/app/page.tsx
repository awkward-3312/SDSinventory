import { getSupplies, type Supply } from "@/lib/api";

export default async function Home() {
  const supplies = await getSupplies();

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4">Insumos</h1>

      <table className="w-full border border-gray-300 border-collapse">
        <thead className="bg-gray-100">
          <tr>
            <th className="border p-2 text-left">Nombre</th>
            <th className="border p-2 text-right">Stock</th>
            <th className="border p-2 text-right">Costo Promedio</th>
          </tr>
        </thead>
        <tbody>
  {supplies.map((s: Supply) => {
    const isLow = s.stock_on_hand <= s.stock_min;

    return (
      <tr
        key={s.id}
        className={isLow ? "bg-red-50 text-red-700" : ""}
      >
        <td className="border p-2">
  <div className="flex items-center gap-2">
    <span>{s.name}</span>
    {isLow && (
      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-red-100 text-red-700">
        STOCK BAJO
      </span>
    )}
  </div>
</td>
        <td className="border p-2 text-right">
          {s.stock_on_hand} {s.unit_base}
        </td>
        <td className="border p-2 text-right">
          L {s.avg_unit_cost}
        </td>
      </tr>
    );
  })}
</tbody>

      </table>
    </main>
  );
}
