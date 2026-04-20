"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { getPresupuestos, eliminarPresupuesto } from "@/lib/api"; 
import { formatCurrency, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { HintBubble } from "@/components/hint-bubble";

// Opciones de estado para presupuestos
const ESTADOS_PRESUPUESTO = [
  { value: "BORRADOR", label: "Borrador" },
  { value: "ENVIADO", label: "Enviado al Cliente" },
  { value: "APROBADO", label: "Aprobado (¡Ganado!)" },
  { value: "RECHAZADO", label: "Rechazado / Perdido" }
];

const FILTROS_PRESUPUESTO = [
  { value: "TODOS",     label: "Todos" },
  { value: "BORRADOR",  label: "Borrador",  color: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600" },
  { value: "ENVIADO",   label: "Enviado",   color: "bg-sky-100 text-sky-700 border-sky-300 dark:bg-sky-900/40 dark:text-sky-400 dark:border-sky-700/50" },
  { value: "APROBADO",  label: "Aprobado",  color: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-700/50" },
  { value: "RECHAZADO", label: "Rechazado", color: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-400 dark:border-red-700/50" },
];

export default function ListadoPresupuestos() {
  const [presupuestos, setPresupuestos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("TODOS");
  const [notificacion, setNotificacion] = useState({ msg: "", isError: false });
  
  // Estado para el Modal de Borrado
  const [idABorrar, setIdABorrar] = useState<number | null>(null);

  // 1. CARGA REAL DE DATOS (¡Candado liberado!)
  useEffect(() => {
    async function cargar() {
      try {
        setLoading(true);
        const data = await getPresupuestos(busqueda);
        setPresupuestos(data);
      } catch (e) {
        mostrarNotificacion("Error conectando con el servidor", true);
      } finally {
        setLoading(false);
      }
    }
    const timer = setTimeout(cargar, 300);
    return () => clearTimeout(timer);
  }, [busqueda]);

  // 2. ELIMINAR PRESUPUESTO (Soft Delete)
  async function confirmarBorrado() {
    if (!idABorrar) return;
    
    const backup = [...presupuestos];
    setPresupuestos(presupuestos.filter(p => p.id !== idABorrar));
    
    try {
      await eliminarPresupuesto(idABorrar);
      mostrarNotificacion(`Cotización P-${idABorrar} enviada a la papelera.`);
    } catch (e) {
      setPresupuestos(backup);
      mostrarNotificacion("Error al eliminar la cotización.", true);
    } finally {
      setIdABorrar(null); 
    }
  }

  function mostrarNotificacion(msg: string, isError = false) {
    setNotificacion({ msg, isError });
    setTimeout(() => setNotificacion({ msg: "", isError: false }), 3000);
  }

  const presupuestosFiltrados = estadoFiltro === "TODOS"
    ? presupuestos
    : presupuestos.filter(p => p.estado === estadoFiltro);

  // Helper de colores
  const getBadgeColor = (estado: string) => {
    switch (estado) {
      case "BORRADOR": return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
      case "ENVIADO": return "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800/50";
      case "APROBADO": return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50";
      case "RECHAZADO": return "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50 opacity-70";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  return (
    <AppShell
      currentPath="/presupuestos"
      badge="Ventas"
      title="Presupuestos Rápidos"
      description="Cotizá arreglos y convertilos en Órdenes de Trabajo con un solo clic al ser aprobados."
      actions={
        <Link
          href="/presupuestos/nuevo"
          className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700 hover:-translate-y-0.5"
        >
          + Crear Cotización
        </Link>
      }
    >
      <div className="space-y-6">

        {/* HINT — primera visita */}
        <HintBubble
          id="hint-presupuestos-v1"
          variant="banner"
          emoji="📋"
          title="Mandá tu primer presupuesto digital"
          desc="Tocá '+ Crear Cotización'. El cliente lo aprueba desde su celular con un link — y con un click lo convertís en Orden de Trabajo."
          action={{ label: "Crear presupuesto", href: "/presupuestos/nuevo" }}
        />

        {/* NOTIFICACIÓN FLOTANTE */}
        {notificacion.msg && (
          <div className={cn("fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-5 fade-in rounded-lg px-5 py-3 text-sm font-bold text-white shadow-2xl sm:bottom-6 sm:left-auto sm:right-6 sm:w-auto", notificacion.isError ? "bg-red-600" : "bg-slate-900 dark:bg-sky-600")}>
            {notificacion.msg}
          </div>
        )}

        {/* MODAL DE CONFIRMACIÓN DE BORRADO */}
        {idABorrar && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md scale-100 rounded-3xl bg-white p-8 shadow-2xl animate-in zoom-in-95 dark:bg-slate-800">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">¿Eliminar Presupuesto?</h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Esta acción enviará el presupuesto P-{idABorrar} a la papelera. Podrás recuperarlo desde la base de datos si lo necesitás.
              </p>
              <div className="mt-8 flex gap-3">
                <button onClick={() => setIdABorrar(null)} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 hover:dark:bg-slate-700">
                  Cancelar
                </button>
                <button onClick={confirmarBorrado} className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white transition hover:bg-red-700 shadow-md hover:shadow-lg">
                  Sí, eliminar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* BARRA DE HERRAMIENTAS */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-md">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Buscar por cliente, patente o detalle..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-11 pr-4 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              {presupuestosFiltrados.length} {presupuestosFiltrados.length === 1 ? "cotización" : "cotizaciones"}
            </p>
          </div>
        </div>

        {/* MINI STATS + FILTROS POR ESTADO */}
        <div className="flex flex-wrap items-center gap-2">
          {FILTROS_PRESUPUESTO.map((f) => {
            const isActive = estadoFiltro === f.value;
            if (f.value === "TODOS") {
              return (
                <button
                  key={f.value}
                  onClick={() => setEstadoFiltro("TODOS")}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all",
                    isActive
                      ? "border-sky-500 bg-sky-500 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                  )}
                >
                  Todos · {presupuestos.length}
                </button>
              );
            }
            const count = presupuestos.filter(p => p.estado === f.value).length;
            return (
              <button
                key={f.value}
                onClick={() => setEstadoFiltro(f.value)}
                className={cn(
                  "rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all",
                  isActive
                    ? cn(f.color, "shadow-sm ring-2 ring-offset-1 ring-current")
                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                )}
              >
                {f.label} {count > 0 && <span className="ml-1 opacity-70">· {count}</span>}
              </button>
            );
          })}
        </div>

        {/* HISTORIAL */}
        <SectionCard title="Historial de Cotizaciones">

          {/* ── VISTA MOBILE (cards) ── */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800/60">
            {loading ? (
              [1,2,3].map(i => (
                <div key={i} className="animate-pulse space-y-3 py-4">
                  <div className="flex justify-between">
                    <div className="h-4 w-28 rounded bg-slate-100 dark:bg-slate-800" />
                    <div className="h-4 w-16 rounded bg-slate-100 dark:bg-slate-800" />
                  </div>
                  <div className="h-3 w-40 rounded bg-slate-100 dark:bg-slate-800" />
                  <div className="h-8 w-full rounded-lg bg-slate-100 dark:bg-slate-800" />
                </div>
              ))
            ) : presupuestosFiltrados.length > 0 ? (
              presupuestosFiltrados.map((p) => (
                <div key={p.id} className="py-4 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-sky-600 dark:text-sky-400">P-{p.id}</span>
                        <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider", getBadgeColor(p.estado))}>
                          {ESTADOS_PRESUPUESTO.find(e => e.value === p.estado)?.label || p.estado}
                        </span>
                      </div>
                      <p className="mt-0.5 font-bold text-slate-900 dark:text-white truncate">{p.cliente_nombre}</p>
                      <p className="text-[11px] font-semibold uppercase text-slate-500">{p.vehiculo} · <span className="font-mono">{p.patente}</span></p>
                    </div>
                    <span className="font-mono text-base font-black text-sky-600 dark:text-sky-400 shrink-0">{formatCurrency(p.total)}</span>
                  </div>
                  {p.resumen_corto && <p className="text-xs text-slate-500 line-clamp-2">{p.resumen_corto}</p>}
                  <div className="flex items-center gap-2 pt-1">
                    <Link href={`/presupuestos/${p.id}`} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 dark:border-slate-700">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    </Link>
                    <Link href={`/presupuestos/nuevo?id=${p.id}`} className="flex h-9 w-9 items-center justify-center rounded-xl border border-sky-200 bg-sky-50 text-sky-600 dark:border-sky-900/50 dark:bg-sky-900/20 dark:text-sky-400">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                    </Link>
                    {p.estado !== "RECHAZADO" && (
                      <Link href={`/trabajos/nuevo?presupuesto=${p.id}`} className="flex h-9 items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 text-[10px] font-bold uppercase text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-400">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        A OT
                      </Link>
                    )}
                    <button onClick={() => setIdABorrar(p.id)} className="ml-auto flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 dark:border-slate-700">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center">
                <p className="text-sm text-slate-400">Sin presupuestos para mostrar.</p>
              </div>
            )}
          </div>

          {/* ── VISTA DESKTOP (tabla) ── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:border-slate-800">
                  <th className="py-4 pl-4 w-16 text-center">Nº</th>
                  <th className="py-4">Cliente / Vehículo</th>
                  <th className="py-4">Detalle Principal</th>
                  <th className="py-4">Estado</th>
                  <th className="py-4 text-right">Total</th>
                  <th className="py-4 pr-4 text-right">Acciones Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {loading ? (
                  <tr><td colSpan={6} className="py-12 text-center animate-pulse text-slate-400">Cargando cotizaciones...</td></tr>
                ) : presupuestosFiltrados.length > 0 ? (
                  presupuestosFiltrados.map((p) => (
                    <tr key={p.id} className="group transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                      <td className="py-4 pl-4 text-center">
                        <Link href={`/presupuestos/${p.id}`} className="font-mono text-xs font-bold text-sky-600 hover:underline dark:text-sky-400">P-{p.id}</Link>
                      </td>
                      <td className="py-4">
                        <Link href={`/presupuestos/${p.id}`} className="flex flex-col hover:opacity-80 transition-opacity">
                          <span className="font-bold text-slate-900 dark:text-white">{p.cliente_nombre}</span>
                          <span className="text-[11px] font-semibold uppercase text-slate-500">{p.vehiculo} - <span className="font-mono">{p.patente}</span></span>
                        </Link>
                      </td>
                      <td className="py-4 text-sm text-slate-600 dark:text-slate-400">
                        <Link href={`/presupuestos/${p.id}`} className="hover:text-sky-600 dark:hover:text-sky-400 transition-colors">{p.resumen_corto || "Sin detalle."}</Link>
                      </td>
                      <td className="py-4">
                        <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider", getBadgeColor(p.estado))}>
                          {ESTADOS_PRESUPUESTO.find(e => e.value === p.estado)?.label || p.estado}
                        </span>
                      </td>
                      <td className="py-4 text-right font-mono text-sm font-black text-sky-600 dark:text-sky-400">{formatCurrency(p.total)}</td>
                      <td className="py-4 pr-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-80 transition-opacity group-hover:opacity-100">
                          <Link href={`/presupuestos/${p.id}`} title="Ver" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-500 transition hover:border-slate-400 hover:bg-slate-100 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-slate-700">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          </Link>
                          {p.estado !== "RECHAZADO" && (
                            <Link href={`/trabajos/nuevo?presupuesto=${p.id}`} title="Convertir a OT" className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-emerald-200 bg-emerald-50/50 text-[10px] font-bold uppercase tracking-wider text-emerald-600 transition hover:border-emerald-500 hover:bg-emerald-500 hover:text-white dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-600 dark:hover:text-white">
                              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>A OT
                            </Link>
                          )}
                          <Link href={`/presupuestos/nuevo?id=${p.id}`} title="Editar" className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-200 bg-sky-50/50 text-sky-600 transition hover:border-sky-500 hover:bg-sky-500 hover:text-white dark:border-sky-900/50 dark:bg-sky-900/20 dark:text-sky-400 dark:hover:bg-sky-600 dark:hover:text-white">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </Link>
                          <button onClick={() => setIdABorrar(p.id)} title="Eliminar" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-500 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:hover:bg-red-900/20 dark:hover:text-red-400">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-20 text-center">
                      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-sky-50 dark:bg-slate-800">
                        <svg className="h-6 w-6 text-sky-500 dark:text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                      </div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Sin Presupuestos</h3>
                      <p className="mt-1 text-sm text-slate-500">Todavía no tenés cotizaciones o ninguna coincide con tu búsqueda.</p>
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