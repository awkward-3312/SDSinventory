import Link from "next/link";
import QuoteActions from "./QuoteActions";
import { API_URL } from "@/lib/api";

type QuoteItem = {
  quote_item_id: string;
  product_id: string;
  recipe_id: string;
  qty: number;
  materials_cost: number;
  suggested_price: number;
  sale_price: number;
  profit: number;
  width?: number | null;
  height?: number | null;
};

type QuoteDetail = {
  quote_id: string;
  quote_number: string;
  status: string;
  valid_until: string | null;
  customer_name: string | null;
  notes: string | null;
  currency: string;
  margin: number;
  materials_cost_total: number;
  operational_cost_total: number;
  total_cost: number;
  total_price: number;
  total_profit: number;
  converted_sale_id?: string | null;
  created_at: string;
  items: QuoteItem[];
};

async function getQuoteDetail(id: string): Promise<QuoteDetail> {
  const res = await fetch(`${API_URL}/quotes/${id}`, { cache: "no-store" });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Backend ${res.status}: ${txt}`);
  }
  return (await res.json()) as QuoteDetail;
}

export default async function QuoteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quote = await getQuoteDetail(id);
  const hasDims = quote.items.some((i) => i.width != null || i.height != null);
  const totalMaterials = quote.items.reduce((a, it) => a + Number(it.materials_cost || 0), 0);
  const opTotal = Number(quote.operational_cost_total || 0);

  return (
    <main className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Detalle de Cotización</h1>
        <Link className="font-semibold hover:underline" href="/quotes">
          ← Volver a Cotizaciones
        </Link>
      </div>

      <QuoteActions quoteId={quote.quote_id} status={quote.status} />

      <div className="card mb-6 mt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-zinc-600">
            <b>Número:</b> {quote.quote_number}
          </div>
          <div className="text-sm font-semibold">{quote.status}</div>
        </div>

        <div className="text-sm text-zinc-600 mt-1">
          <b>Fecha:</b> {new Date(quote.created_at).toLocaleString()}
        </div>
        <div className="text-sm text-zinc-600">
          <b>Vigencia:</b>{" "}
          {quote.valid_until ? new Date(quote.valid_until).toLocaleDateString() : "—"}
        </div>

        <div className="text-sm text-zinc-600">
          <b>Cliente:</b> {quote.customer_name || "-"}
        </div>

        {quote.notes && (
          <div className="text-sm text-zinc-600">
            <b>Notas:</b> {quote.notes}
          </div>
        )}

        {quote.converted_sale_id && (
          <div className="text-sm text-green-700 font-semibold mt-2">
            Convertida a venta: {quote.converted_sale_id}
          </div>
        )}

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="stat-card">
            <div className="text-sm text-zinc-600">Total</div>
            <div className="text-xl font-bold">
              {quote.currency} {quote.total_price.toFixed(2)}
            </div>
          </div>
          <div className="stat-card">
            <div className="text-sm text-zinc-600">Costo</div>
            <div className="text-xl font-bold">
              {quote.currency} {quote.total_cost.toFixed(2)}
            </div>
            <div className="text-xs text-zinc-600">
              Materiales: {quote.currency} {quote.materials_cost_total.toFixed(2)}
            </div>
            <div className="text-xs text-zinc-600">
              Operativo: {quote.currency} {quote.operational_cost_total.toFixed(2)}
            </div>
          </div>
          <div className="stat-card">
            <div className="text-sm text-zinc-600">Ganancia</div>
            <div className="text-xl font-bold">
              {quote.currency} {quote.total_profit.toFixed(2)}
            </div>
            <div className="text-sm text-zinc-600">
              Margen: {(quote.margin * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      </div>

      <h2 className="text-xl font-bold mb-1">Items</h2>
      <div className="text-sm text-zinc-600 mb-2">
        Costos y utilidades por unidad y por línea (incluye operativo prorrateado).
      </div>
      {quote.items.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 mb-4">
          {quote.items.map((it) => {
            const qty = Number(it.qty || 0);
            const unitPrice = qty > 0 ? it.sale_price / qty : 0;
            const opAlloc =
              totalMaterials > 0
                ? opTotal * (Number(it.materials_cost || 0) / totalMaterials)
                : opTotal / Math.max(1, quote.items.length);
            const lineCostTotal = Number(it.materials_cost || 0) + opAlloc;
            const unitCost = qty > 0 ? lineCostTotal / qty : 0;
            const unitProfit = unitPrice - unitCost;
            const marginPctLine = it.sale_price > 0 ? (it.sale_price - lineCostTotal) / it.sale_price : 0;
            return (
              <div key={it.quote_item_id} className="card bg-white">
                <div className="font-semibold">{it.product_id}</div>
                <div className="text-xs text-zinc-600">{it.recipe_id}</div>
                <div className="text-xs text-zinc-600 mt-1">Qty: {it.qty}</div>
                <div className="mt-3 grid gap-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-600">Precio unit.</span>
                    <span className="font-semibold">{quote.currency} {unitPrice.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-600">Costo unit.</span>
                    <span className="font-semibold">{quote.currency} {unitCost.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-600">Utilidad unit.</span>
                    <span className="font-semibold text-emerald-700">{quote.currency} {unitProfit.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-zinc-600">Margen línea</span>
                    <span className="font-semibold">{(marginPctLine * 100).toFixed(1)}%</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {quote.items.length === 0 ? (
        <p className="text-zinc-600 mb-6">Esta cotización no tiene items.</p>
      ) : (
        <div className="overflow-x-auto mb-8">
          <table className="table-base w-full">
            <thead>
              <tr>
                <th className="border p-2 text-left">Producto</th>
                <th className="border p-2 text-left">Receta</th>
                <th className="border p-2 text-right">Qty</th>
                {hasDims && <th className="border p-2 text-right">Ancho</th>}
                {hasDims && <th className="border p-2 text-right">Alto</th>}
                <th className="border p-2 text-right">Precio unit.</th>
                <th className="border p-2 text-right">Precio total</th>
                <th className="border p-2 text-right">Operativo línea</th>
                <th className="border p-2 text-right">Costo unit.</th>
                <th className="border p-2 text-right">Costo total</th>
                <th className="border p-2 text-right">Utilidad unit.</th>
                <th className="border p-2 text-right">Margen</th>
                <th className="border p-2 text-right">Ganancia</th>
              </tr>
            </thead>
            <tbody>
              {quote.items.map((it) => {
                const qty = Number(it.qty || 0);
                const unitPrice = qty > 0 ? it.sale_price / qty : 0;
                const opAlloc =
                  totalMaterials > 0
                    ? opTotal * (Number(it.materials_cost || 0) / totalMaterials)
                    : opTotal / Math.max(1, quote.items.length);
                const lineCostTotal = Number(it.materials_cost || 0) + opAlloc;
                const unitCost = qty > 0 ? lineCostTotal / qty : 0;
                const unitProfit = unitPrice - unitCost;
                const marginPctLine = it.sale_price > 0 ? (it.sale_price - lineCostTotal) / it.sale_price : 0;
                return (
                  <tr key={it.quote_item_id}>
                    <td className="border p-2">{it.product_id}</td>
                    <td className="border p-2">{it.recipe_id}</td>
                    <td className="border p-2 text-right">{it.qty}</td>
                    {hasDims && <td className="border p-2 text-right">{it.width ?? "—"}</td>}
                    {hasDims && <td className="border p-2 text-right">{it.height ?? "—"}</td>}
                    <td className="border p-2 text-right">
                      {quote.currency} {unitPrice.toFixed(2)}
                    </td>
                    <td className="border p-2 text-right">
                      {quote.currency} {it.sale_price.toFixed(2)}
                    </td>
                    <td className="border p-2 text-right">
                      {quote.currency} {opAlloc.toFixed(2)}
                    </td>
                    <td className="border p-2 text-right">
                      {quote.currency} {unitCost.toFixed(2)}
                    </td>
                    <td className="border p-2 text-right">
                      {quote.currency} {lineCostTotal.toFixed(2)}
                    </td>
                    <td className="border p-2 text-right">
                      {quote.currency} {unitProfit.toFixed(2)}
                    </td>
                    <td className="border p-2 text-right">
                      {(marginPctLine * 100).toFixed(1)}%
                    </td>
                    <td className="border p-2 text-right">
                      {quote.currency} {it.profit.toFixed(2)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}
