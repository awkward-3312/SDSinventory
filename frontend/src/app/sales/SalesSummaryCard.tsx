"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/api";

type Period = "7d" | "1m" | "3m" | "6m" | "9m" | "1y" | "all";

type Summary = {
  include_voided: boolean;
  period: Period;
  count_sales: number;
  total_sale: number;
  total_cost: number;
  total_profit: number;
  margin: number;
  currency: string;
};

const PERIODS: Array<{ key: Period; label: string }> = [
  { key: "7d", label: "Semana" },
  { key: "1m", label: "Mes" },
  { key: "3m", label: "3 meses" },
  { key: "6m", label: "6 meses" },
  { key: "9m", label: "9 meses" },
  { key: "1y", label: "Año" },
  { key: "all", label: "Todo" },
];

export default function SalesSummaryCard() {
  const [period, setPeriod] = useState<Period>("7d");
  const [includeVoided, setIncludeVoided] = useState(false);
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const url = useMemo(() => {
    const p = new URLSearchParams();
    p.set("period", period);
    p.set("include_voided", includeVoided ? "true" : "false");
    return `${API_URL}/sales/summary?${p.toString()}`;
  }, [period, includeVoided]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        const t = await res.text().catch(() => "");
        throw new Error(`${res.status} ${t}`);
      }
      const json = (await res.json()) as Summary;
      setData(json);
    } catch (e) {
      console.error(e);
      setErr("No se pudo cargar el resumen de ventas");
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url]);

  const currency = data?.currency ?? "HNL";

  return (
    <section className="card mb-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-lg font-bold">Resumen de Ventas</div>
          <div className="text-sm text-zinc-600">
            Rango: <b>{PERIODS.find((x) => x.key === period)?.label}</b>{" "}
            {includeVoided ? "• incluyendo anuladas" : "• solo activas"}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={includeVoided}
              onChange={(e) => setIncludeVoided(e.target.checked)}
            />
            Incluir anuladas
          </label>

          <button
            className="btn btn-outline btn-sm"
            onClick={load}
            type="button"
            disabled={loading}
          >
            {loading ? "Cargando..." : "Refrescar"}
          </button>
        </div>
      </div>

      <div className="mt-3 flex gap-2 flex-wrap">
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPeriod(p.key)}
            className={`chip ${period === p.key ? "chip-active" : ""}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {err && <div className="mt-3 text-red-700 font-semibold">❌ {err}</div>}

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <div className="stat-card">
          <div className="text-sm text-zinc-600">Ventas</div>
          <div className="text-xl font-bold">{data ? data.count_sales : "—"}</div>
        </div>
        <div className="stat-card">
          <div className="text-sm text-zinc-600">Total</div>
          <div className="text-xl font-bold">
            {data ? `${currency} ${data.total_sale.toFixed(2)}` : "—"}
          </div>
        </div>
        <div className="stat-card">
          <div className="text-sm text-zinc-600">Costo</div>
          <div className="text-xl font-bold">
            {data ? `${currency} ${data.total_cost.toFixed(2)}` : "—"}
          </div>
        </div>
        <div className="stat-card">
          <div className="text-sm text-zinc-600">Ganancia</div>
          <div className="text-xl font-bold">
            {data ? `${currency} ${data.total_profit.toFixed(2)}` : "—"}
          </div>
          <div className="text-sm text-zinc-600">
            Margen: {data ? `${(data.margin * 100).toFixed(0)}%` : "—"}
          </div>
        </div>
      </div>
    </section>
  );
}
