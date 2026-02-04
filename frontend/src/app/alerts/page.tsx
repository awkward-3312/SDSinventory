type AlertSupply = {
  supply_id: string;
  name: string;
  unit_base: string;
  stock_on_hand: number;
  stock_min: number;
  avg_unit_cost: number;
};

async function getLowStockAlerts(): Promise<AlertSupply[]> {
  const res = await fetch("http://127.0.0.1:8000/alerts/low-stock", {
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error("Error al cargar alertas de stock");
  }

  return res.json();
}

export default async function AlertsPage() {
  const alerts = await getLowStockAlerts();

  return (
    <main className="p-6">
      <h1 className="text-2xl font-bold mb-4 text-red-700">
        Alertas de Stock Bajo
      </h1>

      {alerts.length === 0 ? (
        <p className="text-green-700 font-medium">
          ✅ No hay insumos con stock bajo
        </p>
      ) : (
        <table className="w-full border border-red-300 border-collapse">
          <thead className="bg-red-100">
            <tr>
              <th className="border p-2 text-left">Insumo</th>
              <th className="border p-2 text-right">Stock actual</th>
              <th className="border p-2 text-right">Stock mínimo</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((s) => (
              <tr key={s.supply_id} className="bg-red-50 text-red-700">
                <td className="border p-2 font-medium">
                  {s.name}
                </td>
                <td className="border p-2 text-right">
                  {s.stock_on_hand} {s.unit_base}
                </td>
                <td className="border p-2 text-right">
                  {s.stock_min} {s.unit_base}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
