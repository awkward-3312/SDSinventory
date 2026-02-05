"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/api";

type Period = {
  id: string;
  year: number;
  month: number;
  estimated_orders: number;
  currency: string;
  active: boolean;
  created_at: string;
};

type CostItem = {
  id: string;
  period_id: string;
  name: string;
  amount: number;
  created_at: string;
};

type Summary = {
  period_id: string | null;
  year?: number;
  month?: number;
  estimated_orders: number;
  currency: string;
  total_fixed_costs: number;
  operational_cost_per_order: number;
  active: boolean;
};

export default function FixedCostsPage() {
  const now = new Date();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [activeSummary, setActiveSummary] = useState<Summary | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [items, setItems] = useState<CostItem[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [estimatedOrders, setEstimatedOrders] = useState(0);
  const [makeActive, setMakeActive] = useState(true);

  const [itemName, setItemName] = useState("");
  const [itemAmount, setItemAmount] = useState<number>(0);

  const selected = useMemo(
    () => periods.find((p) => p.id === selectedId) || null,
    [periods, selectedId]
  );

  async function loadPeriods() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${API_URL}/fixed-costs/periods`, { cache: "no-store" });
      const data = (await res.json()) as Period[];
      setPeriods(data);
      if (!selectedId && data.length > 0) {
        setSelectedId(data[0].id);
      }
    } catch {
      setErr("No se pudieron cargar períodos");
    } finally {
      setLoading(false);
    }
  }

  async function loadActiveSummary() {
    try {
      const res = await fetch(`${API_URL}/fixed-costs/summary/active`, { cache: "no-store" });
      if (!res.ok) return;
      const data = (await res.json()) as Summary;
      setActiveSummary(data);
    } catch {
      setActiveSummary(null);
    }
  }

  async function loadPeriodDetails(id: string) {
    if (!id) return;
    try {
      const [itemsRes, sumRes] = await Promise.all([
        fetch(`${API_URL}/fixed-costs/items?period_id=${encodeURIComponent(id)}`, { cache: "no-store" }),
        fetch(`${API_URL}/fixed-costs/periods/${id}/summary`, { cache: "no-store" }),
      ]);
      const itemsData = (await itemsRes.json()) as CostItem[];
      const sumData = (await sumRes.json()) as Summary;
      setItems(itemsData);
      setSummary(sumData);
    } catch {
      setItems([]);
      setSummary(null);
    }
  }

  useEffect(() => {
    loadPeriods();
    loadActiveSummary();
  }, []);

  useEffect(() => {
    if (selectedId) {
      loadPeriodDetails(selectedId);
    }
  }, [selectedId]);

  async function createPeriod() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${API_URL}/fixed-costs/periods`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year,
          month,
          estimated_orders: Number(estimatedOrders),
          currency: "HNL",
          active: makeActive,
        }),
      });
      if (!res.ok) throw new Error("create");
      await loadPeriods();
      await loadActiveSummary();
    } catch {
      setErr("No se pudo crear el período");
    } finally {
      setLoading(false);
    }
  }

  async function setActive(periodId: string, active: boolean) {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${API_URL}/fixed-costs/periods/${periodId}/active`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error("active");
      await loadPeriods();
      await loadActiveSummary();
    } catch {
      setErr("No se pudo cambiar el estado");
    } finally {
      setLoading(false);
    }
  }

  async function addItem() {
    if (!selectedId || !itemName.trim()) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${API_URL}/fixed-costs/items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          period_id: selectedId,
          name: itemName.trim(),
          amount: Number(itemAmount),
        }),
      });
      if (!res.ok) throw new Error("item");
      setItemName("");
      setItemAmount(0);
      await loadPeriodDetails(selectedId);
      await loadActiveSummary();
    } catch {
      setErr("No se pudo agregar el gasto");
    } finally {
      setLoading(false);
    }
  }

  async function deleteItem(itemId: string) {
    if (!confirm("¿Eliminar este gasto?")) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${API_URL}/fixed-costs/items/${itemId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete");
      await loadPeriodDetails(selectedId);
      await loadActiveSummary();
    } catch {
      setErr("No se pudo eliminar el gasto");
    } finally {
      setLoading(false);
    }
  }

  const currency = summary?.currency || "HNL";

  return (
    <main className="p-6 max-w-5xl">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold">Costos Fijos</h1>
        <button className="btn btn-outline btn-sm" onClick={loadPeriods} disabled={loading}>
          {loading ? "Cargando..." : "Refrescar"}
        </button>
      </div>

      {activeSummary && (
        <div className="card mb-6">
          <div className="text-sm text-zinc-600">Periodo activo</div>
          <div className="text-lg font-bold">
            {activeSummary.year ?? "—"}-{String(activeSummary.month ?? "").padStart(2, "0")}
          </div>
          <div className="text-sm text-zinc-600 mt-1">
            Costo operativo por pedido: {activeSummary.currency}{" "}
            {Number(activeSummary.operational_cost_per_order ?? 0).toFixed(2)}
          </div>
        </div>
      )}

      <div className="card mb-6">
        <div className="font-semibold mb-2">Crear período mensual</div>
        <div className="grid gap-3 sm:grid-cols-4">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Año</span>
            <input
              className="border rounded px-3 py-2"
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Mes</span>
            <input
              className="border rounded px-3 py-2"
              type="number"
              min={1}
              max={12}
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            />
          </label>
          <label className="grid gap-1 sm:col-span-2">
            <span className="text-sm font-medium">Pedidos estimados</span>
            <input
              className="border rounded px-3 py-2"
              type="number"
              min={0}
              value={estimatedOrders}
              onChange={(e) => setEstimatedOrders(Number(e.target.value))}
            />
          </label>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={makeActive}
              onChange={(e) => setMakeActive(e.target.checked)}
            />
            Marcar como activo
          </label>
          <button className="btn btn-primary" onClick={createPeriod} disabled={loading}>
            Guardar período
          </button>
        </div>
      </div>

      {err && <div className="mb-3 text-red-700 font-semibold">❌ {err}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="font-semibold mb-2">Períodos</div>
          {periods.length === 0 ? (
            <p className="text-zinc-600">Aún no hay períodos.</p>
          ) : (
            <table className="table-base w-full">
              <thead>
                <tr>
                  <th className="border p-2 text-left">Periodo</th>
                  <th className="border p-2 text-right">Pedidos</th>
                  <th className="border p-2 text-left">Estado</th>
                  <th className="border p-2 text-left">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {periods.map((p) => (
                  <tr key={p.id} className={p.id === selectedId ? "bg-blue-50" : ""}>
                    <td className="border p-2 font-medium">
                      <button
                        className="hover:underline"
                        onClick={() => setSelectedId(p.id)}
                        type="button"
                      >
                        {p.year}-{String(p.month).padStart(2, "0")}
                      </button>
                    </td>
                    <td className="border p-2 text-right">{p.estimated_orders}</td>
                    <td className="border p-2">{p.active ? "Activo" : "Inactivo"}</td>
                    <td className="border p-2">
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setActive(p.id, true)}
                        disabled={loading}
                      >
                        Activar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="card">
          <div className="font-semibold mb-2">Gastos del período</div>
          {!selected ? (
            <p className="text-zinc-600">Selecciona un período.</p>
          ) : (
            <>
              {summary && (
                <div className="mb-3 text-sm text-zinc-700">
                  Total: {currency} {summary.total_fixed_costs.toFixed(2)} • Costo por pedido:{" "}
                  {currency} {summary.operational_cost_per_order.toFixed(2)}
                </div>
              )}

              <div className="grid gap-3 sm:grid-cols-3 mb-3">
                <label className="grid gap-1 sm:col-span-2">
                  <span className="text-sm font-medium">Nombre</span>
                  <input
                    className="border rounded px-3 py-2"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    placeholder="Ej: Renta, Sueldos"
                  />
                </label>
                <label className="grid gap-1">
                  <span className="text-sm font-medium">Monto</span>
                  <input
                    className="border rounded px-3 py-2"
                    type="number"
                    min={0}
                    value={itemAmount}
                    onChange={(e) => setItemAmount(Number(e.target.value))}
                  />
                </label>
              </div>

              <button className="btn btn-primary mb-3" onClick={addItem} disabled={loading}>
                Agregar gasto
              </button>

              {items.length === 0 ? (
                <p className="text-zinc-600">Este período no tiene gastos.</p>
              ) : (
                <table className="table-base w-full">
                  <thead>
                    <tr>
                      <th className="border p-2 text-left">Gasto</th>
                      <th className="border p-2 text-right">Monto</th>
                      <th className="border p-2 text-left">Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((it) => (
                      <tr key={it.id}>
                        <td className="border p-2">{it.name}</td>
                        <td className="border p-2 text-right">{currency} {it.amount.toFixed(2)}</td>
                        <td className="border p-2">
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => deleteItem(it.id)}
                            disabled={loading}
                          >
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </>
          )}
        </div>
      </div>
    </main>
  );
}
