"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { API_URL } from "@/lib/api";

type Supply = {
  id: string;
  name: string;
  unit_base: string;
  stock_on_hand: number;
};

type ApiSupply = {
  id: string;
  name: string;
  unit_base: string;
  stock_on_hand: number;
};

type Movement = {
  id: string;
  movement_type: "IN" | "OUT";
  qty_base: number;
  unit_cost_snapshot: number;
  ref_type: string;
  ref_id: string;
  created_at: string;
};

const API = API_URL;

export default function KardexPage() {
  const searchParams = useSearchParams();
  const supplyIdFromUrl = searchParams.get("supply_id") || "";

  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [supplyId, setSupplyId] = useState("");
  const [rows, setRows] = useState<Movement[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Cargar insumos (incluye stock_on_hand)
  useEffect(() => {
    fetch(`${API}/supplies`, { cache: "no-store" })
      .then((r) => r.json() as Promise<ApiSupply[]>)
      .then((data) =>
        setSupplies(
          data.map((s) => ({
            id: s.id,
            name: s.name,
            unit_base: s.unit_base,
            stock_on_hand: Number(s.stock_on_hand ?? 0),
          }))
        )
      )
      .catch(() => setSupplies([]));
  }, []);

  // Si viene supply_id en la URL, selecciona automáticamente
  useEffect(() => {
    if (!supplyIdFromUrl) return;
    setSupplyId(supplyIdFromUrl);
    setRows([]);
    setError(null);
  }, [supplyIdFromUrl]);

  const selectedSupply = useMemo(
    () => supplies.find((s) => s.id === supplyId) || null,
    [supplies, supplyId]
  );

  const totalIn = useMemo(() => {
    return rows
      .filter((r) => r.movement_type === "IN")
      .reduce((a, r) => a + Number(r.qty_base), 0);
  }, [rows]);

  const totalOut = useMemo(() => {
    return rows
      .filter((r) => r.movement_type === "OUT")
      .reduce((a, r) => a + Number(r.qty_base), 0);
  }, [rows]);

  const balanceByMovs = useMemo(() => totalIn - totalOut, [totalIn, totalOut]);

  const finalBalance = useMemo(() => {
    return selectedSupply ? Number(selectedSupply.stock_on_hand) : null;
  }, [selectedSupply]);

  async function fetchMovementsWithFallback(supplyIdValue: string): Promise<Movement[]> {
    const candidates = [
      `${API}/movements?supply_id=${encodeURIComponent(supplyIdValue)}`,
      `${API}/kardex?supply_id=${encodeURIComponent(supplyIdValue)}`,
      `${API}/inventory/movements?supply_id=${encodeURIComponent(supplyIdValue)}`,
    ];

    let lastText = "";

    for (const url of candidates) {
      const res = await fetch(url, { cache: "no-store" });

      if (res.ok) {
        console.log("✅ Kardex endpoint usado:", url);
        const data = (await res.json()) as Movement[];
        return data;
      }

      // Si es 404, probamos el siguiente
      if (res.status === 404) {
        lastText = await res.text().catch(() => "");
        continue;
      }

      // Si es otro error (400/500), paramos y mostramos
      lastText = await res.text().catch(() => "");
      throw new Error(`Error ${res.status} en ${url}: ${lastText}`);
    }

    // Ninguno existió (todas 404)
    throw new Error(`Ningún endpoint disponible (404). Última respuesta: ${lastText}`);
  }

  async function refreshSupplies() {
    try {
      const resSup = await fetch(`${API}/supplies`, { cache: "no-store" });
      if (!resSup.ok) return;

      const supData = (await resSup.json()) as ApiSupply[];
      setSupplies(
        supData.map((s) => ({
          id: s.id,
          name: s.name,
          unit_base: s.unit_base,
          stock_on_hand: Number(s.stock_on_hand ?? 0),
        }))
      );
    } catch {
      // ignorar
    }
  }

  async function load() {
    if (!supplyId) return;

    setLoading(true);
    setError(null);
    setRows([]);

    try {
      const data = await fetchMovementsWithFallback(supplyId);
      setRows(data);

      // refrescar supplies para stock actual (no tumba si falla)
      await refreshSupplies();
    } catch (e) {
      console.error(e);
      setError("No se pudo cargar el kardex (revisa el endpoint en backend)");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!supplyId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplyId]);

  const unit = selectedSupply?.unit_base || "";

  return (
    <main className="p-6 max-w-4xl">
      <h1 className="text-2xl font-bold mb-4">Kardex (Movimientos)</h1>

      <div className="flex gap-2 items-end mb-4">
        <label className="grid gap-1 flex-1">
          <span className="font-medium">Insumo</span>
          <select
            className="border rounded px-3 py-2"
            value={supplyId}
            onChange={(e) => {
              const id = e.target.value;
              setSupplyId(id);
              window.history.replaceState(null, "", `/kardex?supply_id=${id}`);
              setRows([]);
              setError(null);
            }}
          >
            <option value="">Selecciona un insumo…</option>
            {supplies.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.unit_base})
              </option>
            ))}
          </select>
        </label>

        <button
          onClick={load}
          disabled={!supplyId || loading}
          className="btn btn-primary"
        >
          {loading ? "Cargando..." : "Ver Kardex"}
        </button>
      </div>

      {selectedSupply && (
        <div className="card mb-4">
          <div className="font-semibold">{selectedSupply.name}</div>
          <div className="text-sm text-zinc-600">Unidad base: {selectedSupply.unit_base}</div>
        </div>
      )}

      {error && <div className="text-red-700 font-semibold mb-3">❌ {error}</div>}

      {selectedSupply && rows.length > 0 && (
        <div className="mb-4 grid gap-2 sm:grid-cols-3">
          <div className="stat-card">
            <div className="text-sm text-zinc-600">Total IN</div>
            <div className="text-xl font-bold">
              {totalIn.toFixed(2)} {unit}
            </div>
          </div>

          <div className="stat-card">
            <div className="text-sm text-zinc-600">Total OUT</div>
            <div className="text-xl font-bold">
              {totalOut.toFixed(2)} {unit}
            </div>
          </div>

          <div className="stat-card">
            <div className="text-sm text-zinc-600">Saldo final (stock actual)</div>
            <div className="text-xl font-bold">
              {finalBalance == null ? "—" : `${finalBalance.toFixed(2)} ${unit}`}
            </div>
            <div className="text-xs text-zinc-600 mt-1">
              Verificación (movimientos): {balanceByMovs.toFixed(2)} {unit}
            </div>
          </div>
        </div>
      )}

      {rows.length === 0 && !loading && !error ? (
        <p className="text-zinc-600">Selecciona un insumo y presiona “Ver Kardex”.</p>
      ) : (
        rows.length > 0 && (
          <table className="table-base w-full">
            <thead>
              <tr>
                <th className="border p-2 text-left">Tipo</th>
                <th className="border p-2 text-right">Cantidad</th>
                <th className="border p-2 text-right">Costo</th>
                <th className="border p-2 text-left">Ref</th>
                <th className="border p-2 text-left">Fecha</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td className="border p-2 font-semibold">{m.movement_type}</td>
                  <td className="border p-2 text-right">
                    {Number(m.qty_base).toFixed(2)} {unit}
                  </td>
                  <td className="border p-2 text-right">
                    L {Number(m.unit_cost_snapshot).toFixed(2)}
                  </td>
                  <td className="border p-2">
                    {m.ref_type} / {m.ref_id}
                  </td>
                  <td className="border p-2">{new Date(m.created_at).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      )}
    </main>
  );
}
