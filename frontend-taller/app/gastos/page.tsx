"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { getGastos, crearGasto } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { Gasto } from "@/lib/types";
import { cn } from "@/lib/utils";

const TIPOS_GASTO = [
  { value: "REPUESTOS", label: "Compra de Repuestos" },
  { value: "INSUMOS", label: "Insumos (Aceite, trapos...)" },
  { value: "SERVICIOS", label: "Servicios (Luz, Alquiler...)" },
  { value: "OTROS", label: "Otros Gastos" },
];

const TIPO_BADGE: Record<string, string> = {
  REPUESTOS: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800/50",
  INSUMOS: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800/50",
  SERVICIOS: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/20 dark:text-purple-400 dark:border-purple-800/50",
  OTROS: "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700",
};

const inputBase = "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 transition-all focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-900/50 dark:text-white dark:focus:border-brand-500 dark:focus:bg-slate-900";

export default function GastosPage() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [notificacion, setNotificacion] = useState({ msg: "", isError: false });

  // Form state
  const [tipo, setTipo] = useState("REPUESTOS");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [comprobante, setComprobante] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  async function cargar() {
    try {
      setLoading(true);
      const data = await getGastos();
      setGastos(data);
    } catch {
      mostrarNotificacion("Error cargando gastos", true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { cargar(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!descripcion.trim() || !monto || Number(monto) <= 0) {
      return mostrarNotificacion("Descripción y monto son obligatorios.", true);
    }

    setIsSaving(true);
    try {
      await crearGasto({
        tipo,
        descripcion: descripcion.trim(),
        monto: Number(monto),
        comprobante: comprobante.trim(),
      });

      mostrarNotificacion("Gasto registrado correctamente");
      setDescripcion("");
      setMonto("");
      setComprobante("");
      setShowForm(false);
      cargar();
    } catch (e: any) {
      mostrarNotificacion(e.message || "Error al registrar", true);
    } finally {
      setIsSaving(false);
    }
  }

  function mostrarNotificacion(msg: string, isError = false) {
    setNotificacion({ msg, isError });
    setTimeout(() => setNotificacion({ msg: "", isError: false }), 3000);
  }

  const totalMes = gastos
    .filter(g => {
      const fecha = new Date(g.fecha);
      const ahora = new Date();
      return fecha.getMonth() === ahora.getMonth() && fecha.getFullYear() === ahora.getFullYear();
    })
    .reduce((acc, g) => acc + g.monto, 0);

  const totalGeneral = gastos.reduce((acc, g) => acc + g.monto, 0);

  const porTipo = TIPOS_GASTO.map(t => ({
    ...t,
    total: gastos.filter(g => g.tipo === t.value).reduce((acc, g) => acc + g.monto, 0),
  }));

  return (
    <AppShell
      currentPath="/gastos"
      badge="Finanzas"
      title="Gastos y Compras"
      description="Registrá todos los egresos del taller: repuestos, insumos y servicios."
      actions={
        <button
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          {showForm ? "✕ Cancelar" : "+ Registrar Gasto"}
        </button>
      }
    >
      <div className="space-y-6">

        {/* TOAST */}
        {notificacion.msg && (
          <div className={cn("fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in rounded-lg px-5 py-3 text-sm font-bold text-white shadow-2xl", notificacion.isError ? "bg-red-600" : "bg-slate-900 dark:bg-brand-600")}>
            {notificacion.msg}
          </div>
        )}

        {/* KPI CARDS */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Mes Actual</p>
            <p className="mt-2 font-mono text-3xl font-black text-red-600 dark:text-red-400">{formatCurrency(totalMes)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Total Registrado</p>
            <p className="mt-2 font-mono text-3xl font-black text-slate-900 dark:text-white">{formatCurrency(totalGeneral)}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Cantidad Registros</p>
            <p className="mt-2 font-mono text-3xl font-black text-slate-900 dark:text-white">{gastos.length}</p>
          </div>
        </div>

        {/* FORM DE ALTA */}
        {showForm && (
          <SectionCard title="Nuevo Gasto">
            <form onSubmit={handleSubmit} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Categoría</span>
                <select value={tipo} onChange={(e) => setTipo(e.target.value)} className={inputBase}>
                  {TIPOS_GASTO.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Monto *</span>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                  <input required type="number" min="0.01" step="0.01" placeholder="0,00" value={monto} onChange={(e) => setMonto(e.target.value)} className={cn(inputBase, "pl-8 font-mono")} />
                </div>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Descripción *</span>
                <input required type="text" placeholder="Ej: Filtro de aceite para Toyota Corolla" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={inputBase} />
              </div>
              <div className="space-y-1.5">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Nro. Comprobante</span>
                <input type="text" placeholder="Ej: FAC-0001-00001234" value={comprobante} onChange={(e) => setComprobante(e.target.value)} className={inputBase} />
              </div>
              <div className="flex items-end">
                <button type="submit" disabled={isSaving} className="w-full rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500">
                  {isSaving ? "Registrando..." : "Guardar Gasto"}
                </button>
              </div>
            </form>
          </SectionCard>
        )}

        {/* BREAKDOWN POR TIPO */}
        <div className="grid gap-3 sm:grid-cols-4">
          {porTipo.map(t => (
            <div key={t.value} className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
              <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider", TIPO_BADGE[t.value])}>
                {t.label.split(" ")[0]}
              </span>
              <p className="mt-2 font-mono text-lg font-black text-slate-900 dark:text-white">{formatCurrency(t.total)}</p>
            </div>
          ))}
        </div>

        {/* TABLA DE GASTOS */}
        <SectionCard title="Registro Completo">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-[600px]">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400 dark:border-slate-800">
                  <th className="py-4 pl-4">Fecha</th>
                  <th className="py-4">Categoría</th>
                  <th className="py-4">Descripción</th>
                  <th className="py-4">Comprobante</th>
                  <th className="py-4 pr-4 text-right">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {loading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td className="py-4 pl-4"><div className="h-4 w-24 rounded bg-slate-100 dark:bg-slate-800" /></td>
                      <td className="py-4"><div className="h-5 w-20 rounded-full bg-slate-100 dark:bg-slate-800" /></td>
                      <td className="py-4"><div className="h-4 w-48 rounded bg-slate-100 dark:bg-slate-800" /></td>
                      <td className="py-4"><div className="h-4 w-24 rounded bg-slate-100 dark:bg-slate-800" /></td>
                      <td className="py-4 pr-4"><div className="ml-auto h-4 w-20 rounded bg-slate-100 dark:bg-slate-800" /></td>
                    </tr>
                  ))
                ) : gastos.length > 0 ? (
                  gastos.map((g) => (
                    <tr key={g.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                      <td className="py-4 pl-4 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">
                        {formatDateTime(g.fecha).split(",")[0]}
                      </td>
                      <td className="py-4">
                        <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider", TIPO_BADGE[g.tipo] || TIPO_BADGE.OTROS)}>
                          {TIPOS_GASTO.find(t => t.value === g.tipo)?.label.split(" ")[0] || g.tipo}
                        </span>
                      </td>
                      <td className="py-4 font-medium text-slate-800 dark:text-slate-200">{g.descripcion}</td>
                      <td className="py-4 font-mono text-xs text-slate-400">{g.comprobante || "—"}</td>
                      <td className="py-4 pr-4 text-right font-mono font-bold text-red-600 dark:text-red-400">
                        {formatCurrency(g.monto)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-sm text-slate-400">
                      Sin gastos registrados. Usá el botón de arriba para agregar el primero.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}
