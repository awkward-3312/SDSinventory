"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/api";

type Supply = {
  id: string;
  name: string;
  unit_base: string;
  stock_on_hand: number;
  avg_unit_cost: number;
  active?: boolean;
};

type Presentation = {
  id: string;
  supply_id: string;
  supply_name: string;
  name: string;
  units_in_base: number;
  created_at: string;
};

type PurchaseResult = {
  purchase_id: string;
  purchase_item_id: string;
  units_in_base: number;
  unit_cost: number;
  new_stock: number;
  new_avg_unit_cost: number;
};

export default function PurchasesPage() {
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [presentations, setPresentations] = useState<Presentation[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [presSupplyId, setPresSupplyId] = useState("");
  const [presName, setPresName] = useState("");
  const [presUnits, setPresUnits] = useState<string>("1");

  const [purchaseSupplyId, setPurchaseSupplyId] = useState("");
  const [purchasePresentationId, setPurchasePresentationId] = useState("");
  const [packsQty, setPacksQty] = useState<number>(1);
  const [totalCost, setTotalCost] = useState<string>("");
  const [supplierName, setSupplierName] = useState("");
  const [purchaseResult, setPurchaseResult] = useState<PurchaseResult | null>(null);

  const canCreatePresentation =
    !!presSupplyId && presName.trim().length > 0 && Number(presUnits) > 0;
  const canCreatePurchase =
    !!purchaseSupplyId &&
    !!purchasePresentationId &&
    Number(packsQty) > 0 &&
    Number(totalCost) > 0;

  const presentationsBySupply = useMemo(() => {
    if (!purchaseSupplyId) return presentations;
    return presentations.filter((p) => p.supply_id === purchaseSupplyId);
  }, [presentations, purchaseSupplyId]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [sRes, pRes] = await Promise.all([
        fetch(`${API_URL}/supplies?include_inactive=true`, { cache: "no-store" }),
        fetch(`${API_URL}/presentations`, { cache: "no-store" }),
      ]);
      if (!sRes.ok || !pRes.ok) {
        const msg = !sRes.ok
          ? await readError(sRes, "No se pudieron cargar insumos")
          : await readError(pRes, "No se pudieron cargar presentaciones");
        throw new Error(msg);
      }
      const sData = (await sRes.json()) as Supply[];
      const pData = (await pRes.json()) as Presentation[];
      setSupplies(sData);
      setPresentations(pData);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo cargar la información";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    if (!purchaseSupplyId) {
      setPurchasePresentationId("");
      return;
    }
    const first = presentations.find((p) => p.supply_id === purchaseSupplyId);
    setPurchasePresentationId(first?.id ?? "");
  }, [purchaseSupplyId, presentations]);

  async function createPresentation() {
    if (!presSupplyId || !presName.trim() || Number(presUnits) <= 0) {
      setErr("Completa insumo, nombre y unidades por empaque.");
      return;
    }
    setLoading(true);
    setErr(null);
    setNotice(null);
    try {
      const res = await fetch(`${API_URL}/presentations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supply_id: presSupplyId,
          name: presName.trim(),
          units_in_base: Number(presUnits),
        }),
      });
      if (!res.ok) {
        const msg = await readError(res, "No se pudo crear la presentación");
        throw new Error(msg);
      }
      setPresName("");
      setPresUnits("1");
      setNotice("✅ Presentación creada");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo crear la presentación";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  async function createPurchase() {
    if (!purchaseSupplyId || !purchasePresentationId || Number(packsQty) <= 0 || Number(totalCost) <= 0) {
      setErr("Completa insumo, presentación, cantidad de empaques y costo total.");
      return;
    }
    setLoading(true);
    setErr(null);
    setNotice(null);
    setPurchaseResult(null);
    try {
      const res = await fetch(`${API_URL}/purchases`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supply_id: purchaseSupplyId,
          presentation_id: purchasePresentationId,
          packs_qty: Number(packsQty),
          total_cost: Number(totalCost),
          supplier_name: supplierName.trim() || null,
        }),
      });
      if (!res.ok) {
        const msg = await readError(res, "No se pudo registrar la compra");
        throw new Error(msg);
      }
      const data = (await res.json()) as PurchaseResult;
      setPurchaseResult(data);
      setTotalCost("");
      setSupplierName("");
      setNotice("✅ Compra registrada");
      await load();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "No se pudo registrar la compra";
      setErr(msg);
    } finally {
      setLoading(false);
    }
  }

  async function readError(res: Response, fallback: string): Promise<string> {
    try {
      const data = await res.json();
      return data?.detail || data?.error || fallback;
    } catch {
      const text = await res.text().catch(() => "");
      return text || fallback;
    }
  }

  return (
    <main className="p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold">Compras y Presentaciones</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <a className="btn btn-secondary btn-sm" href="/">
            Ver Insumos
          </a>
          <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>
            {loading ? "Cargando..." : "Refrescar"}
          </button>
        </div>
      </div>

      <div className="card mb-6">
        <div className="font-semibold mb-1">Guía rápida</div>
        <div className="text-sm text-zinc-600">
          1. Crea la presentación del insumo (resma, rollo, botella) • 2. Registra la compra con costo total • 3. El
          sistema calcula costo unitario y actualiza el inventario.
        </div>
      </div>

      {err && <div className="mb-3 text-red-700 font-semibold">❌ {err}</div>}
      {notice && <div className="mb-3 text-green-700 font-semibold">{notice}</div>}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card">
          <div className="font-semibold mb-2">Presentaciones</div>
          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="text-sm font-medium">Insumo</span>
              <select
                className="border rounded px-3 py-2"
                value={presSupplyId}
                onChange={(e) => setPresSupplyId(e.target.value)}
              >
                <option value="">Selecciona…</option>
                {supplies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.unit_base})
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-medium">Nombre de presentación</span>
              <input
                className="border rounded px-3 py-2"
                value={presName}
                onChange={(e) => setPresName(e.target.value)}
                placeholder="Ej: Rollo 50m, Resma 500 hojas"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-medium">Unidades por empaque</span>
              <input
                className="border rounded px-3 py-2"
                type="number"
                min={0}
                step="0.01"
                value={presUnits}
                onChange={(e) => setPresUnits(e.target.value)}
                placeholder="Ej: 50, 500, 1000"
              />
            </label>
            <button className="btn btn-primary" onClick={createPresentation} disabled={loading || !canCreatePresentation}>
              Crear presentación
            </button>
            {!canCreatePresentation && (
              <div className="text-xs text-zinc-600">Selecciona un insumo y completa nombre + unidades.</div>
            )}
          </div>

          <div className="mt-4">
            {presentations.length === 0 ? (
              <p className="text-sm text-zinc-600">Aún no hay presentaciones.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="table-base w-full">
                  <thead>
                    <tr>
                      <th className="border p-2 text-left">Insumo</th>
                      <th className="border p-2 text-left">Presentación</th>
                      <th className="border p-2 text-right">Unidades</th>
                    </tr>
                  </thead>
                  <tbody>
                    {presentations.map((p) => (
                      <tr key={p.id}>
                        <td className="border p-2">{p.supply_name}</td>
                        <td className="border p-2">{p.name}</td>
                        <td className="border p-2 text-right">{p.units_in_base}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="card">
          <div className="font-semibold mb-2">Registrar compra</div>
          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="text-sm font-medium">Insumo</span>
              <select
                className="border rounded px-3 py-2"
                value={purchaseSupplyId}
                onChange={(e) => setPurchaseSupplyId(e.target.value)}
              >
                <option value="">Selecciona…</option>
                {supplies.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.unit_base})
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-medium">Presentación</span>
              <select
                className="border rounded px-3 py-2"
                value={purchasePresentationId}
                onChange={(e) => setPurchasePresentationId(e.target.value)}
                disabled={!purchaseSupplyId}
              >
                <option value="">
                  {purchaseSupplyId ? "Selecciona una presentación…" : "Selecciona un insumo primero"}
                </option>
                {presentationsBySupply.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.units_in_base} {supplies.find((s) => s.id === p.supply_id)?.unit_base})
                  </option>
                ))}
              </select>
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-medium">Cantidad de empaques</span>
              <input
                className="border rounded px-3 py-2"
                type="number"
                min={0}
                step="0.01"
                value={packsQty}
                onChange={(e) => setPacksQty(Number(e.target.value))}
              />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-medium">Costo total (L)</span>
              <input
                className="border rounded px-3 py-2"
                type="number"
                min={0}
                step="0.01"
                value={totalCost}
                onChange={(e) => setTotalCost(e.target.value)}
                placeholder="Ej: 1500"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-sm font-medium">Proveedor (opcional)</span>
              <input
                className="border rounded px-3 py-2"
                value={supplierName}
                onChange={(e) => setSupplierName(e.target.value)}
                placeholder="Ej: Proveedor ABC"
              />
            </label>
            <button
              className="btn btn-primary"
              onClick={createPurchase}
              disabled={loading || !canCreatePurchase}
            >
              Registrar compra
            </button>
            {!canCreatePurchase && (
              <div className="text-xs text-zinc-600">
                Completa insumo, presentación, empaques y costo total.
              </div>
            )}
          </div>

          {purchaseResult && (
            <div className="card mt-4">
              <div className="font-semibold mb-2">Resultado</div>
              <div className="text-sm">
                <div>
                  <b>Unidades a base:</b> {purchaseResult.units_in_base}
                </div>
                <div>
                  <b>Costo unitario:</b> L {purchaseResult.unit_cost.toFixed(2)}
                </div>
                <div>
                  <b>Nuevo stock:</b> {purchaseResult.new_stock}
                </div>
                <div>
                  <b>Costo promedio:</b> L {purchaseResult.new_avg_unit_cost.toFixed(2)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
