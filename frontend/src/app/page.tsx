"use client";

import { useEffect, useMemo, useState } from "react";
import { API_URL } from "@/lib/api";

type Supply = {
  id: string;
  name: string;
  unit_base: string;
  stock_on_hand: number;
  stock_min: number;
  avg_unit_cost: number;
  active?: boolean;
};

type Unit = { id: string; code: string; name: string };

export default function Home() {
  const [supplies, setSupplies] = useState<Supply[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [unitId, setUnitId] = useState("");
  const [stockMin, setStockMin] = useState(0);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | "low" | "active" | "inactive">("all");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editUnitId, setEditUnitId] = useState("");
  const [editStockMin, setEditStockMin] = useState(0);

  const canCreate = name.trim().length > 0 && unitId;

  const activeSupplies = useMemo(() => supplies, [supplies]);
  const totals = useMemo(() => {
    const total = supplies.length;
    const low = supplies.filter((s) => Number(s.stock_on_hand) <= Number(s.stock_min)).length;
    const inactive = supplies.filter((s) => s.active === false).length;
    return { total, low, inactive };
  }, [supplies]);

  const filteredSupplies = useMemo(() => {
    const text = query.trim().toLowerCase();
    return supplies.filter((s) => {
      if (filter === "low" && Number(s.stock_on_hand) > Number(s.stock_min)) return false;
      if (filter === "active" && s.active === false) return false;
      if (filter === "inactive" && s.active !== false) return false;
      if (!text) return true;
      return (
        s.name.toLowerCase().includes(text) ||
        s.unit_base.toLowerCase().includes(text)
      );
    });
  }, [supplies, query, filter]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [sRes, uRes] = await Promise.all([
        fetch(`${API_URL}/supplies?include_inactive=true`, { cache: "no-store" }),
        fetch(`${API_URL}/units`, { cache: "no-store" }),
      ]);
      const sData = (await sRes.json()) as Supply[];
      const uData = (await uRes.json()) as Unit[];
      setSupplies(sData);
      setUnits(uData);
    } catch {
      setErr("No se pudieron cargar los insumos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function createSupply() {
    if (!canCreate) return;
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${API_URL}/supplies`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          unit_base_id: Number(unitId),
          stock_min: Number(stockMin),
        }),
      });
      if (!res.ok) throw new Error("create");
      setName("");
      setUnitId("");
      setStockMin(0);
      await load();
    } catch {
      setErr("No se pudo crear el insumo");
    } finally {
      setLoading(false);
    }
  }

  function startEdit(s: Supply) {
    setEditingId(s.id);
    setEditName(s.name);
    const unit = units.find((u) => u.code === s.unit_base);
    setEditUnitId(unit ? unit.id : "");
    setEditStockMin(Number(s.stock_min ?? 0));
  }

  async function saveEdit(supplyId: string) {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${API_URL}/supplies/${supplyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          unit_base_id: Number(editUnitId),
          stock_min: Number(editStockMin),
        }),
      });
      if (!res.ok) throw new Error("update");
      setEditingId(null);
      await load();
    } catch {
      setErr("No se pudo actualizar el insumo");
    } finally {
      setLoading(false);
    }
  }

  async function setActive(supplyId: string, active: boolean) {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`${API_URL}/supplies/${supplyId}/active`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) throw new Error("active");
      await load();
    } catch {
      setErr("No se pudo cambiar el estado");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="p-6">
      <div className="flex items-center justify-between gap-4 mb-4">
        <h1 className="text-2xl font-bold">Insumos</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <a className="btn btn-secondary btn-sm" href="/purchases">
            Registrar compra
          </a>
          <a className="btn btn-outline btn-sm" href="/kardex">
            Ver Kardex
          </a>
          <button className="btn btn-outline btn-sm" onClick={load} disabled={loading}>
            {loading ? "Cargando..." : "Refrescar"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 mb-6 sm:grid-cols-3">
        <div className="stat-card">
          <div className="text-sm text-zinc-600">Total insumos</div>
          <div className="text-xl font-bold">{totals.total}</div>
        </div>
        <div className="stat-card">
          <div className="text-sm text-zinc-600">Stock bajo</div>
          <div className="text-xl font-bold">{totals.low}</div>
        </div>
        <div className="stat-card">
          <div className="text-sm text-zinc-600">Inactivos</div>
          <div className="text-xl font-bold">{totals.inactive}</div>
        </div>
      </div>

      <div className="card mb-6">
        <div className="font-semibold mb-1">Guía rápida</div>
        <div className="text-sm text-zinc-600">
          1. Crea el insumo con su unidad base • 2. Registra compras/entradas para calcular costo promedio • 3. Úsalo en recetas y revisa el Kardex cuando necesites.
        </div>
      </div>

      <div className="card mb-6">
        <div className="font-semibold mb-2">Crear insumo</div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1">
            <span className="text-sm font-medium">Nombre</span>
            <input
              className="border rounded px-3 py-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: Vinil"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Unidad</span>
            <select
              className="border rounded px-3 py-2"
              value={unitId}
              onChange={(e) => setUnitId(e.target.value)}
            >
              <option value="">Selecciona…</option>
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.code})
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Stock mínimo</span>
            <input
              className="border rounded px-3 py-2"
              type="number"
              min={0}
              value={stockMin}
              onChange={(e) => setStockMin(Number(e.target.value))}
            />
          </label>
        </div>
        <div className="mt-3">
          <button className="btn btn-primary" onClick={createSupply} disabled={!canCreate || loading}>
            Guardar insumo
          </button>
        </div>
        <div className="mt-2 text-xs text-zinc-600">
          El costo promedio se actualiza con compras/entradas y se usa para calcular recetas y ventas.
        </div>
      </div>

      {err && <div className="mb-3 text-red-700 font-semibold">❌ {err}</div>}

      <div className="card mb-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1 sm:col-span-2">
            <span className="text-sm font-medium">Buscar</span>
            <input
              className="border rounded px-3 py-2"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Nombre o unidad (ej: m², ml)"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-sm font-medium">Filtro</span>
            <select
              className="border rounded px-3 py-2"
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
            >
              <option value="all">Todos</option>
              <option value="low">Stock bajo</option>
              <option value="active">Activos</option>
              <option value="inactive">Inactivos</option>
            </select>
          </label>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="table-base w-full">
          <thead>
            <tr>
              <th className="border p-2 text-left">Nombre</th>
              <th className="border p-2 text-right">Stock</th>
              <th className="border p-2 text-right">Mínimo</th>
              <th className="border p-2 text-right">Costo prom.</th>
              <th className="border p-2 text-left">Estado</th>
              <th className="border p-2 text-left">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredSupplies.map((s) => {
            const isLow = s.stock_on_hand <= s.stock_min;
            const isEditing = editingId === s.id;
            const isActive = s.active !== false;
            return (
              <tr key={s.id} className={isLow ? "bg-red-50 text-red-700" : ""}>
                <td className="border p-2">
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <input
                        className="border rounded px-2 py-1"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                      />
                    ) : (
                      <span>{s.name}</span>
                    )}
                    {isLow && (
                      <span className="text-xs font-semibold px-2 py-1 rounded-full bg-red-100 text-red-700">
                        STOCK BAJO
                      </span>
                    )}
                  </div>
                </td>
                <td className="border p-2 text-right">
                  {s.stock_on_hand} {s.unit_base}
                </td>
                <td className="border p-2 text-right">
                  {isEditing ? (
                    <input
                      className="border rounded px-2 py-1 w-24 text-right"
                      type="number"
                      min={0}
                      value={editStockMin}
                      onChange={(e) => setEditStockMin(Number(e.target.value))}
                    />
                  ) : (
                    `${s.stock_min} ${s.unit_base}`
                  )}
                </td>
                <td className="border p-2 text-right">
                  {Number(s.avg_unit_cost) > 0 ? `L ${Number(s.avg_unit_cost).toFixed(2)}` : "—"}
                </td>
                <td className="border p-2">{isActive ? "Activo" : "Inactivo"}</td>
                <td className="border p-2">
                  <div className="flex gap-2 flex-wrap">
                    {isEditing ? (
                      <>
                        <select
                          className="border rounded px-2 py-1"
                          value={editUnitId}
                          onChange={(e) => setEditUnitId(e.target.value)}
                        >
                          <option value="">Unidad…</option>
                          {units.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.code}
                            </option>
                          ))}
                        </select>
                        <button className="btn btn-primary btn-sm" onClick={() => saveEdit(s.id)}>
                          Guardar
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setEditingId(null)}>
                          Cancelar
                        </button>
                      </>
                    ) : (
                      <>
                        <button className="btn btn-secondary btn-sm" onClick={() => startEdit(s)}>
                          Editar
                        </button>
                        <a className="btn btn-outline btn-sm" href={`/kardex?supply_id=${s.id}`}>
                          Kardex
                        </a>
                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => setActive(s.id, !isActive)}
                        >
                          {isActive ? "Desactivar" : "Activar"}
                        </button>
                        <button className="btn btn-secondary btn-sm" onClick={() => setActive(s.id, false)}>
                          Eliminar
                        </button>
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
          {filteredSupplies.length === 0 && (
            <tr>
              <td className="border p-3 text-center text-zinc-600" colSpan={6}>
                {query || filter !== "all" ? "Sin resultados para ese filtro" : "Sin insumos"}
              </td>
            </tr>
          )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
