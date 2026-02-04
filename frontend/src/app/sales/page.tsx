import Link from "next/link";

type SaleRow = {
  id: string;
  created_at: string;
  customer_name: string | null;
  notes: string | null;
  currency: string;
  total_sale: number;
  total_cost: number;
  total_profit: number;
  margin: number;
  voided: boolean;
};

async function getSales(): Promise<SaleRow[]> {
  const res = await fetch("http://127.0.0.1:8000/sales?limit=50&offset=0", {
    cache: "no-store",
  });
  if (!res.ok) throw new Error("Error al cargar ventas");
  return (await res.json()) as SaleRow[];
}

type Status = "all" | "active" | "voided";

export default async function SalesPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const status = (sp.status as Status) ?? "all";

  const sales = await getSales();

  const filtered =
    status === "active"
      ? sales.filter((s) => !s.voided)
      : status === "voided"
      ? sales.filter((s) => s.voided)
      : sales;

  const countAll = sales.length;
  const countActive = sales.filter((s) => !s.voided).length;
  const countVoided = sales.filter((s) => s.voided).length;

  const tabClass = (on: boolean) =>
    `border rounded px-3 py-1 text-sm font-semibold ${
      on ? "bg-black text-white" : "bg-white hover:bg-zinc-50"
    }`;

  return (
    <main className="p-6 max-w-5xl">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold">Ventas</h1>

        <Link
          href="/sales/new"
          className="rounded bg-black text-white px-4 py-2 hover:opacity-90"
        >
          + Nueva venta
        </Link>
      </div>

      {/* Filtros */}
      <div className="flex gap-2 mb-4">
        <Link href="/sales?status=all" className={tabClass(status === "all")}>
          Todas ({countAll})
        </Link>
        <Link
          href="/sales?status=active"
          className={tabClass(status === "active")}
        >
          Activas ({countActive})
        </Link>
        <Link
          href="/sales?status=voided"
          className={tabClass(status === "voided")}
        >
          Anuladas ({countVoided})
        </Link>
      </div>

      {filtered.length === 0 ? (
        <p className="text-zinc-600">No hay ventas para este filtro.</p>
      ) : (
        <table className="w-full border border-gray-300 border-collapse">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2 text-left">Estado</th>
              <th className="border p-2 text-left">Fecha</th>
              <th className="border p-2 text-left">Cliente</th>
              <th className="border p-2 text-right">Total</th>
              <th className="border p-2 text-right">Costo</th>
              <th className="border p-2 text-right">Ganancia</th>
              <th className="border p-2 text-right">Margen</th>
              <th className="border p-2 text-left">Detalle</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((s) => (
              <tr key={s.id} className={s.voided ? "bg-red-50" : ""}>
                <td className="border p-2 font-semibold">
                  {s.voided ? (
                    <span className="text-red-600">ANULADA</span>
                  ) : (
                    <span className="text-green-700">ACTIVA</span>
                  )}
                </td>

                <td className="border p-2">
                  {new Date(s.created_at).toLocaleString()}
                </td>

                <td className="border p-2">{s.customer_name || "—"}</td>

                <td className="border p-2 text-right">
                  {s.currency} {s.total_sale.toFixed(2)}
                </td>

                <td className="border p-2 text-right">
                  {s.currency} {s.total_cost.toFixed(2)}
                </td>

                <td className="border p-2 text-right">
                  {s.currency} {s.total_profit.toFixed(2)}
                </td>

                <td className="border p-2 text-right">
                  {(s.margin * 100).toFixed(0)}%
                </td>

                <td className="border p-2">
                  <Link className="hover:underline font-semibold" href={`/sales/${s.id}`}>
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}