import Link from "next/link";
import VoidSaleCard from "./VoidSaleCard";
import { API_URL } from "@/lib/api";

type SaleItem = {
  sale_item_id: string;
  product_id: string;
  product_name: string | null;
  recipe_id: string;
  recipe_name: string | null;
  qty: number;
  materials_cost: number;
  suggested_price: number;
  sale_price: number;
  profit: number;
  created_at: string;
  width?: number | null;
  height?: number | null;
};

type SaleMovement = {
  movement_id: string;
  supply_id: string;
  supply_name: string;
  unit_base: string;
  movement_type: "OUT" | "IN";
  qty_base: number;
  unit_cost_snapshot: number;
  ref_type: string; // "sale" | "sale_void" | etc
  ref_id: string;
  created_at: string;
  kardex_url: string;
};

type SaleDetail = {
  sale_id: string;
  created_at: string;
  customer_name: string | null;
  notes: string | null;
  currency: string;
  total_sale: number;
  total_cost: number;
  total_profit: number;
  margin: number;

  voided: boolean;
  voided_at?: string | null;
  void_reason?: string | null;
  voided_by?: string | null;

  items: SaleItem[];
  movements: SaleMovement[];
};

async function getSaleDetail(id: string): Promise<SaleDetail> {
  const res = await fetch(`${API_URL}/sales/${id}`, {
    cache: "no-store",
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Backend ${res.status}: ${txt}`);
  }

  return (await res.json()) as SaleDetail;
}

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const sale = await getSaleDetail(id);
  const hasDims = sale.items.some((i) => i.width != null || i.height != null);

  return (
    <main className="p-6 max-w-5xl">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Detalle de Venta</h1>
        <Link className="font-semibold hover:underline" href="/sales">
          ← Volver a Ventas
        </Link>
      </div>

      <VoidSaleCard
        saleId={sale.sale_id}
        voided={sale.voided}
        initialReason={sale.void_reason ?? null}
      />

      {/* Resumen */}
      <div className={`card mb-6 ${sale.voided ? "border-red-200 bg-red-50" : ""}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="text-sm text-zinc-600">
            <b>ID:</b> {sale.sale_id}
          </div>

          <div className="text-sm font-semibold">
            {sale.voided ? (
              <span className="text-red-600">ANULADA</span>
            ) : (
              <span className="text-green-700">ACTIVA</span>
            )}
          </div>
        </div>

        <div className="text-sm text-zinc-600 mt-1">
          <b>Fecha:</b> {new Date(sale.created_at).toLocaleString()}
        </div>

        <div className="text-sm mt-2">
          {sale.voided ? (
            <span className="text-red-600 font-semibold">
              ANULADA
              {sale.voided_at
                ? ` • ${new Date(sale.voided_at).toLocaleString()}`
                : ""}
              {sale.void_reason ? ` • ${sale.void_reason}` : ""}
            </span>
          ) : (
            <span className="text-green-700 font-semibold">ACTIVA</span>
          )}
        </div>

        <div className="text-sm text-zinc-600">
          <b>Cliente:</b> {sale.customer_name || "-"}
        </div>

        {sale.notes && (
          <div className="text-sm text-zinc-600">
            <b>Notas:</b> {sale.notes}
          </div>
        )}

        {/* Info de anulación */}
        {sale.voided && (
          <div className="card border-red-200 bg-white mt-2">
            <div className="text-sm text-red-700 font-semibold">
              Venta anulada
            </div>

            <div className="text-sm text-zinc-700">
              <b>Anulada el:</b>{" "}
              {sale.voided_at ? new Date(sale.voided_at).toLocaleString() : "-"}
            </div>

            <div className="text-sm text-zinc-700">
              <b>Motivo:</b> {sale.void_reason || "-"}
            </div>

            {sale.voided_by && (
              <div className="text-sm text-zinc-700">
                <b>Anulada por:</b> {sale.voided_by}
              </div>
            )}
          </div>
        )}

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <div className="stat-card">
            <div className="text-sm text-zinc-600">Total</div>
            <div className="text-xl font-bold">
              {sale.currency} {sale.total_sale.toFixed(2)}
            </div>
          </div>
          <div className="stat-card">
            <div className="text-sm text-zinc-600">Costo</div>
            <div className="text-xl font-bold">
              {sale.currency} {sale.total_cost.toFixed(2)}
            </div>
          </div>
          <div className="stat-card">
            <div className="text-sm text-zinc-600">Ganancia</div>
            <div className="text-xl font-bold">
              {sale.currency} {sale.total_profit.toFixed(2)}
            </div>
            <div className="text-sm text-zinc-600">
              Margen: {(sale.margin * 100).toFixed(0)}%
            </div>
          </div>
        </div>
      </div>

      {/* Items */}
      <h2 className="text-xl font-bold mb-2">Items</h2>
      {sale.items.length === 0 ? (
        <p className="text-zinc-600 mb-6">Esta venta no tiene items.</p>
      ) : (
        <table className="table-base w-full mb-8">
          <thead>
            <tr>
              <th className="border p-2 text-left">Producto</th>
              <th className="border p-2 text-left">Receta</th>
              <th className="border p-2 text-right">Qty</th>
              {hasDims && <th className="border p-2 text-right">Ancho</th>}
              {hasDims && <th className="border p-2 text-right">Alto</th>}
              <th className="border p-2 text-right">Precio</th>
              <th className="border p-2 text-right">Costo</th>
              <th className="border p-2 text-right">Ganancia</th>
            </tr>
          </thead>
          <tbody>
            {sale.items.map((it) => (
              <tr
                key={it.sale_item_id}
                className={sale.voided ? "opacity-70" : ""}
              >
                <td className="border p-2">{it.product_name || it.product_id}</td>
                <td className="border p-2">{it.recipe_name || it.recipe_id}</td>
                <td className="border p-2 text-right">{it.qty}</td>
                {hasDims && <td className="border p-2 text-right">{it.width ?? "—"}</td>}
                {hasDims && <td className="border p-2 text-right">{it.height ?? "—"}</td>}
                <td className="border p-2 text-right">
                  {sale.currency} {it.sale_price.toFixed(2)}
                </td>
                <td className="border p-2 text-right">
                  {sale.currency} {it.materials_cost.toFixed(2)}
                </td>
                <td className="border p-2 text-right">
                  {sale.currency} {it.profit.toFixed(2)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Movimientos */}
      <h2 className="text-xl font-bold mb-2">Movimientos (Kardex)</h2>
      {sale.movements.length === 0 ? (
        <p className="text-zinc-600">No hay movimientos para esta venta.</p>
      ) : (
        <table className="table-base w-full">
          <thead>
            <tr>
              <th className="border p-2 text-left">Insumo</th>
              <th className="border p-2 text-right">Cantidad</th>
              <th className="border p-2 text-left">Tipo</th>
              <th className="border p-2 text-right">Costo</th>
              <th className="border p-2 text-left">Kardex</th>
              <th className="border p-2 text-left">Fecha</th>
            </tr>
          </thead>

          <tbody>
            {sale.movements.map((m) => {
              const isVoid = m.ref_type === "sale_void";
              const sign = isVoid ? "+" : "-";

              return (
                <tr
                  key={m.movement_id}
                  className={
                    isVoid
                      ? "bg-green-50 text-green-700"
                      : sale.voided
                      ? "opacity-70"
                      : ""
                  }
                >
                  {/* Insumo */}
                  <td className="border p-2">
                    {m.supply_name} ({m.unit_base})
                  </td>

                  {/* Cantidad */}
                  <td className="border p-2 text-right font-semibold">
                    {sign}
                    {Number(m.qty_base).toFixed(2)} {m.unit_base}
                  </td>

                  {/* Tipo */}
                  <td className="border p-2 text-left">
                    {isVoid ? "Reverso" : "Venta"}
                  </td>

                  {/* Costo */}
                  <td className="border p-2 text-right">
                    {sale.currency} {Number(m.unit_cost_snapshot).toFixed(2)}
                  </td>

                  {/* Kardex */}
                  <td className="border p-2">
                    <Link className="hover:underline" href={m.kardex_url}>
                      Ver Kardex
                    </Link>
                  </td>

                  {/* Fecha */}
                  <td className="border p-2">
                    {new Date(m.created_at).toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </main>
  );
}
