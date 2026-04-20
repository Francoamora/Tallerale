"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { buildPublicApiUrl } from "@/lib/api";
import { cn } from "@/lib/utils";

export default function NuevaCompra() {
  const router = useRouter();
  
  const [tipo, setTipo] = useState("REPUESTOS");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [comprobante, setComprobante] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState({ tone: "idle", message: "" });

  async function procesarGasto(e: React.FormEvent) {
    e.preventDefault();
    const valorMonto = parseFloat(monto);
    if (isNaN(valorMonto) || valorMonto <= 0) return setFeedback({ tone: "error", message: "El monto es inválido." });
    if (!descripcion.trim()) return setFeedback({ tone: "error", message: "Añade una descripción." });

    setIsSaving(true);
    setFeedback({ tone: "idle", message: "" });

    try {
      const response = await fetch(buildPublicApiUrl("/compras/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo, descripcion, monto: valorMonto, comprobante }),
      });

      if (!response.ok) throw new Error("Falla al registrar el gasto en el servidor.");

      setFeedback({ tone: "success", message: "Compra registrada en la caja." });
      setTimeout(() => { router.push("/"); router.refresh(); }, 1500);
    } catch (error) {
      setFeedback({ tone: "error", message: "No se pudo procesar la transacción." });
      setIsSaving(false);
    }
  }

  return (
    <AppShell currentPath="/compras" badge="Caja Diaria" title="Registrar Compra / Gasto" description="Declaración de salidas de dinero para insumos, repuestos y servicios.">
      <div className="max-w-3xl">
        <form onSubmit={procesarGasto} className="space-y-6">
          
          {feedback.message && (
            <div className={cn("rounded-xl border p-4 text-sm font-medium", feedback.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800")}>
              {feedback.message}
            </div>
          )}

          <SectionCard title="Detalle del Egreso">
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Tipo de Gasto</span>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500">
                  <option value="REPUESTOS">Compra de Repuestos (Para clientes)</option>
                  <option value="INSUMOS">Insumos (Aceite, líquido, trapos)</option>
                  <option value="SERVICIOS">Servicios (Luz, Alquiler, Internet)</option>
                  <option value="OTROS">Otros Gastos Varios</option>
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700">Monto Gastado ($)</span>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                  <input required type="number" step="0.01" min="0.01" placeholder="0.00" value={monto} onChange={(e) => setMonto(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2.5 pl-8 pr-4 font-mono text-lg font-bold text-red-600 outline-none focus:border-brand-500" />
                </div>
              </label>

              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium text-slate-700">Descripción / Concepto</span>
                <input required type="text" placeholder="Ej. Filtro de aceite y 4 bujías en Repuestos Pepe" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500" />
              </label>

              <label className="space-y-1.5 sm:col-span-2">
                <span className="text-sm font-medium text-slate-700">N° Comprobante / Factura (Opcional)</span>
                <input type="text" placeholder="Ej. Factura C 0001-000045" value={comprobante} onChange={(e) => setComprobante(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500" />
              </label>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <Link href="/" className="inline-flex justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">Cancelar</Link>
              <button type="submit" disabled={isSaving} className="inline-flex justify-center rounded-xl bg-slate-900 px-8 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500">
                {isSaving ? "Registrando..." : "Confirmar Salida de Dinero"}
              </button>
            </div>
          </SectionCard>
        </form>
      </div>
    </AppShell>
  );
}