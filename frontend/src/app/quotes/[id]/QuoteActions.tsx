"use client";

import { useState } from "react";
import { API_URL } from "@/lib/api";

type Props = {
  quoteId: string;
  status: string;
};

export default function QuoteActions({ quoteId, status }: Props) {
  const [nextStatus, setNextStatus] = useState(status);
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function updateStatus() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`${API_URL}/quotes/${quoteId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) throw new Error("status");
      setMsg("✅ Estado actualizado");
      window.location.reload();
    } catch {
      setMsg("No se pudo actualizar el estado");
    } finally {
      setLoading(false);
    }
  }

  async function convertQuote() {
    if (!confirm("¿Convertir esta cotización en venta?")) return;
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch(`${API_URL}/quotes/${quoteId}/convert`, { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error("convert");
      setMsg(`✅ Convertida a venta ${data.sale_id}`);
      window.location.reload();
    } catch {
      setMsg("No se pudo convertir la cotización");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card mt-4">
      <div className="font-semibold mb-2">Acciones</div>

      <div className="flex flex-wrap items-end gap-3">
        <label className="grid gap-1">
          <span className="text-sm font-medium">Estado</span>
          <select
            className="border rounded px-3 py-2"
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value)}
          >
            {["draft", "sent", "accepted", "rejected", "expired", "converted"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <button className="btn btn-secondary btn-sm" onClick={updateStatus} disabled={loading}>
          Actualizar estado
        </button>
        <button className="btn btn-primary btn-sm" onClick={convertQuote} disabled={loading || status === "converted"}>
          Convertir a venta
        </button>
      </div>

      {msg && <div className="mt-3 text-sm font-semibold">{msg}</div>}
    </div>
  );
}
