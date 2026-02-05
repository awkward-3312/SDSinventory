import Link from "next/link";
import { API_URL } from "@/lib/api";

type QuoteRow = {
  id: string;
  quote_number: string;
  status: string;
  valid_until: string | null;
  customer_name: string | null;
  currency: string;
  total_price: number;
  total_cost: number;
  total_profit: number;
  created_at: string;
};

async function getQuotes(status?: string): Promise<QuoteRow[]> {
  const qs = status ? `&status=${encodeURIComponent(status)}` : "";
  const res = await fetch(`${API_URL}/quotes?limit=50&offset=0${qs}`, { cache: "no-store" });
  if (!res.ok) throw new Error("Error al cargar cotizaciones");
  return (await res.json()) as QuoteRow[];
}

type Status = "all" | "draft" | "sent" | "accepted" | "rejected" | "expired" | "converted";

export default async function QuotesPage({
  searchParams,
}: {
  searchParams?: Promise<{ status?: string }>;
}) {
  const sp = (await searchParams) ?? {};
  const status = (sp.status as Status) ?? "all";

  const quotes = await getQuotes(status === "all" ? undefined : status);

  const tabClass = (on: boolean) => `chip ${on ? "chip-active" : ""}`;

  return (
    <main className="p-6 max-w-5xl">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold">Cotizaciones</h1>
        <Link href="/quotes/new" className="btn btn-primary">
          + Nueva cotización
        </Link>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {(["all", "draft", "sent", "accepted", "rejected", "expired", "converted"] as Status[]).map((s) => (
          <Link key={s} href={`/quotes?status=${s}`} className={tabClass(status === s)}>
            {s === "all" ? "Todas" : s}
          </Link>
        ))}
      </div>

      {quotes.length === 0 ? (
        <p className="text-zinc-600">No hay cotizaciones para este filtro.</p>
      ) : (
        <table className="table-base w-full">
          <thead>
            <tr>
              <th className="border p-2 text-left">Número</th>
              <th className="border p-2 text-left">Estado</th>
              <th className="border p-2 text-left">Cliente</th>
              <th className="border p-2 text-left">Vigencia</th>
              <th className="border p-2 text-right">Total</th>
              <th className="border p-2 text-left">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {quotes.map((q) => (
              <tr key={q.id}>
                <td className="border p-2 font-semibold">{q.quote_number}</td>
                <td className="border p-2">{q.status}</td>
                <td className="border p-2">{q.customer_name || "—"}</td>
                <td className="border p-2">
                  {q.valid_until ? new Date(q.valid_until).toLocaleDateString() : "—"}
                </td>
                <td className="border p-2 text-right">
                  {q.currency} {q.total_price.toFixed(2)}
                </td>
                <td className="border p-2">
                  <Link className="hover:underline font-semibold" href={`/quotes/${q.id}`}>
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
