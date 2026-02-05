"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";

type Props = {
  saleId: string;
  voided: boolean;
  initialReason?: string | null;
};

type ApiResp = { ok?: boolean; error?: string; detail?: string; sale_id?: string };

export default function VoidSaleCard({ saleId, voided, initialReason }: Props) {
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState(initialReason ?? "");
  const [loading, setLoading] = useState(false);

  // mini “toast” sin librerías
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  function showToast(type: "success" | "error", msg: string) {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  }

  const canVoid = useMemo(() => {
    if (voided) return false;
    if (loading) return false;
    return reason.trim().length > 0; // motivo obligatorio ✅
  }, [voided, loading, reason]);

  async function onConfirmVoid() {
    if (!canVoid) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/sales/${saleId}/void`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() }),
      });

      const data = (await res.json()) as ApiResp;

      if (!res.ok) {
        showToast("error", data.detail || data.error || "No se pudo anular");
        return;
      }

      if (data.ok) {
        showToast("success", "✅ Venta anulada");
        setOpen(false);
        router.refresh(); // recarga datos del server component ✅
      } else {
        showToast("error", data.error || "No se pudo anular");
      }
    } catch {
      showToast("error", "No se pudo conectar con el backend");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card mt-4">
      {/* Toast */}
      {toast && (
        <div
          className={`mb-3 rounded border p-2 text-sm font-semibold ${
            toast.type === "success"
              ? "border-green-200 bg-green-50 text-green-700"
              : "border-red-200 bg-red-50 text-red-700"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold">Acciones</div>
          <div className="text-sm text-zinc-600">
            {voided ? "Esta venta ya está anulada." : "Puedes anular esta venta y revertir stock."}
          </div>
        </div>

        <button
          type="button"
          className="rounded bg-red-600 text-white px-4 py-2 hover:opacity-90 disabled:opacity-50"
          disabled={voided}
          onClick={() => setOpen(true)}
        >
          Anular venta
        </button>
      </div>

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="card w-full max-w-md">
            <div className="text-lg font-bold">Confirmar anulación</div>
            <p className="text-sm text-zinc-600 mt-1">
              Esto creará movimientos <b>IN (sale_void)</b> y marcará la venta como anulada.
            </p>

            <label className="grid gap-1 mt-4">
              <span className="text-sm font-medium">Motivo (obligatorio)</span>
              <input
                className="border rounded px-3 py-2"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej: Cliente canceló la compra"
              />
            </label>

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                className="border rounded px-4 py-2 hover:bg-zinc-50"
                disabled={loading}
                onClick={() => setOpen(false)}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="rounded bg-red-600 text-white px-4 py-2 hover:opacity-90 disabled:opacity-50"
                disabled={!canVoid}
                onClick={onConfirmVoid}
              >
                {loading ? "Anulando..." : "Confirmar anulación"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
