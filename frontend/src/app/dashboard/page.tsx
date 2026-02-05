import Link from "next/link";
import { API_URL } from "@/lib/api";

type SalesSummary = {
  include_voided: boolean;
  count_sales: number;
  total_sale: number;
  total_cost: number;
  total_profit: number;
  margin: number;
  currency: string;
  range?: string;
  since?: string | null;
};

type LowStockRow = {
  supply_id: string;
  name: string;
  unit_base: string;
  stock_on_hand: number;
  stock_min: number;
  avg_unit_cost: number;
};

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
  voided_at: string | null;
  void_reason: string | null;
  voided_by: string | null;
};

const API = API_URL;

type RangeKey = "7d" | "1m" | "3m" | "6m" | "9m" | "1y";
const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "7d", label: "7 días" },
  { key: "1m", label: "1 mes" },
  { key: "3m", label: "3 meses" },
  { key: "6m", label: "6 meses" },
  { key: "9m", label: "9 meses" },
  { key: "1y", label: "1 año" },
];

function parseRange(x?: string): RangeKey {
  const ok = new Set<RangeKey>(["7d", "1m", "3m", "6m", "9m", "1y"]);
  return ok.has(x as RangeKey) ? (x as RangeKey) : "1m";
}

function parseBool(x?: string): boolean {
  return x === "1" || x === "true";
}

async function getSummary(includeVoided: boolean, range: RangeKey): Promise<SalesSummary> {
  const res = await fetch(
    `${API}/sales/summary?include_voided=${includeVoided}&period=${encodeURIComponent(range)}`,
    { cache: "no-store" }
  );
  if (!res.ok) throw new Error("No se pudo cargar sales summary");
  return res.json() as Promise<SalesSummary>;
}

async function getLowStock(): Promise<LowStockRow[]> {
  const res = await fetch(`${API}/alerts/low-stock`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json() as Promise<LowStockRow[]>;
}

async function getRecentSales(): Promise<SaleRow[]> {
  const res = await fetch(`${API}/sales?limit=5&offset=0`, { cache: "no-store" });
  if (!res.ok) return [];
  return res.json() as Promise<SaleRow[]>;
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams?: { range?: string; include_voided?: string };
}) {
  const range = parseRange(searchParams?.range);
  const includeVoided = parseBool(searchParams?.include_voided);

  const [activeSum, allSum, lowStock, recentSales] = await Promise.all([
    getSummary(false, range),
    getSummary(true, range),
    getLowStock(),
    getRecentSales(),
  ]);

  const currency = allSum.currency || "HNL";

  const tabClass = (on: boolean) => `chip ${on ? "chip-active" : ""}`;

  return (
    <main className="p-6 max-w-5xl">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold">Dashboard</h1>

        <div className="flex gap-2">
          <Link className="btn btn-secondary" href="/sales">
            Ver ventas
          </Link>
          <Link className="btn btn-primary" href="/sales/new">
            + Nueva venta
          </Link>
        </div>
      </div>

      {/* Filtros de rango */}
      <div className="flex flex-wrap gap-2 mb-4">
        {RANGE_OPTIONS.map((r) => (
          <Link
            key={r.key}
            href={`/dashboard?range=${r.key}&include_voided=${includeVoided ? "1" : "0"}`}
            className={tabClass(range === r.key)}
          >
            {r.label}
          </Link>
        ))}

        <span className="mx-2 text-zinc-400">|</span>

        <Link
          href={`/dashboard?range=${range}&include_voided=${includeVoided ? "0" : "1"}`}
          className={tabClass(includeVoided)}
        >
          Incluir anuladas
        </Link>
      </div>

      {/* Cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 mb-6">
        <div className="card">
          <div className="text-sm text-zinc-600">Ventas activas</div>
          <div className="text-2xl font-bold">{activeSum.count_sales}</div>
          <div className="text-sm text-zinc-600 mt-1">
            Total: {currency} {activeSum.total_sale.toFixed(2)}
          </div>
        </div>

        <div className="card">
          <div className="text-sm text-zinc-600">Ventas (incluye anuladas)</div>
          <div className="text-2xl font-bold">{allSum.count_sales}</div>
          <div className="text-sm text-zinc-600 mt-1">
            Total: {currency} {allSum.total_sale.toFixed(2)}
          </div>
        </div>

        <div className="card">
          <div className="text-sm text-zinc-600">Utilidad (activas)</div>
          <div className="text-2xl font-bold">
            {currency} {activeSum.total_profit.toFixed(2)}
          </div>
          <div className="text-sm text-zinc-600 mt-1">
            Margen: {(activeSum.margin * 100).toFixed(1)}%
          </div>
        </div>

        <div className="card">
          <div className="text-sm text-zinc-600">Alertas stock bajo</div>
          <div className="text-2xl font-bold">{lowStock.length}</div>
          <div className="text-sm text-zinc-600 mt-1">
            <Link className="font-semibold hover:underline" href="/alerts">
              Ver alertas →
            </Link>
          </div>
        </div>
      </div>

      {/* Últimas ventas */}
      <div className="card mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Últimas ventas</h2>
          <Link className="font-semibold hover:underline" href="/sales">
            Ver todas →
          </Link>
        </div>

        {recentSales.length === 0 ? (
          <p className="text-zinc-600">Aún no hay ventas.</p>
        ) : (
          <table className="table-base w-full">
            <thead>
              <tr>
                <th className="border p-2 text-left">Estado</th>
                <th className="border p-2 text-left">Fecha</th>
                <th className="border p-2 text-left">Cliente</th>
                <th className="border p-2 text-right">Total</th>
                <th className="border p-2 text-left">Detalle</th>
              </tr>
            </thead>
            <tbody>
              {recentSales.map((s) => (
                <tr key={s.id} className={s.voided ? "bg-red-50" : ""}>
                  <td className="border p-2 font-semibold">
                    {s.voided ? (
                      <span className="text-red-600">ANULADA</span>
                    ) : (
                      <span className="text-green-700">ACTIVA</span>
                    )}
                  </td>
                  <td className="border p-2">{new Date(s.created_at).toLocaleString()}</td>
                  <td className="border p-2">{s.customer_name || "—"}</td>
                  <td className="border p-2 text-right">
                    {s.currency} {s.total_sale.toFixed(2)}
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
      </div>

      {/* Stock bajo */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold">Stock bajo</h2>
          <Link className="font-semibold hover:underline" href="/alerts">
            Ver alertas →
          </Link>
        </div>

        {lowStock.length === 0 ? (
          <p className="text-zinc-600">No hay insumos en stock bajo 🎉</p>
        ) : (
          <table className="table-base w-full">
            <thead>
              <tr>
                <th className="border p-2 text-left">Insumo</th>
                <th className="border p-2 text-right">Stock</th>
                <th className="border p-2 text-right">Mínimo</th>
                <th className="border p-2 text-left">Kardex</th>
              </tr>
            </thead>
            <tbody>
              {lowStock.map((r) => (
                <tr key={r.supply_id}>
                  <td className="border p-2">{r.name}</td>
                  <td className="border p-2 text-right">
                    {Number(r.stock_on_hand).toFixed(2)} {r.unit_base}
                  </td>
                  <td className="border p-2 text-right">
                    {Number(r.stock_min).toFixed(2)} {r.unit_base}
                  </td>
                  <td className="border p-2">
                    <Link className="hover:underline font-semibold" href={`/kardex?supply_id=${r.supply_id}`}>
                      Ver Kardex
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </main>
  );
}
