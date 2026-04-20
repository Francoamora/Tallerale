"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { getTrabajos, actualizarEstadoTrabajo, eliminarTrabajo } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { Trabajo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { HintBubble } from "@/components/hint-bubble";

// Opciones de estado (sincronizadas con Django)
const ESTADOS_OPCIONES = [
  { value: "INGRESADO", label: "Ingresado" },
  { value: "EN_PROCESO", label: "En Proceso" },
  { value: "FINALIZADO", label: "Finalizado" },
  { value: "ENTREGADO", label: "Entregado" },
  { value: "ANULADO", label: "Anulado" }
];

const FILTROS_ESTADO = [
  { value: "TODOS",      label: "Todos" },
  { value: "INGRESADO",  label: "Ingresado",  color: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-600" },
  { value: "EN_PROCESO", label: "En Proceso", color: "bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/40 dark:text-amber-400 dark:border-amber-700/50" },
  { value: "FINALIZADO", label: "Finalizado", color: "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/40 dark:text-emerald-400 dark:border-emerald-700/50" },
  { value: "ENTREGADO",  label: "Entregado",  color: "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/40 dark:text-blue-400 dark:border-blue-700/50" },
  { value: "ANULADO",    label: "Anulado",    color: "bg-red-100 text-red-700 border-red-300 dark:bg-red-900/40 dark:text-red-400 dark:border-red-700/50" },
];

export default function ListadoTrabajos() {
  const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState("TODOS");
  const [notificacion, setNotificacion] = useState({ msg: "", isError: false });

  // ESTADO PARA EL MODAL DE BORRADO
  const [idABorrar, setIdABorrar] = useState<number | null>(null);

  useEffect(() => {
    async function cargar() {
      try {
        setLoading(true);
        const data = await getTrabajos(busqueda);
        setTrabajos(data);
      } catch (e) {
        mostrarNotificacion("Error al conectar con el servidor", true);
      } finally {
        setLoading(false);
      }
    }
    const timer = setTimeout(cargar, 300);
    return () => clearTimeout(timer);
  }, [busqueda]);

  // 1. ACTUALIZAR ESTADO (Optimistic UI)
  async function cambiarEstadoRapido(id: number, nuevoEstado: string) {
    const backup = [...trabajos];
    setTrabajos(trabajos.map(t => t.id === id ? { ...t, estado: nuevoEstado } : t));
    
    try {
      await actualizarEstadoTrabajo(id, nuevoEstado);
      mostrarNotificacion(`Orden #${id} actualizada a ${nuevoEstado.replace('_', ' ')}`);
    } catch (error) {
      setTrabajos(backup);
      mostrarNotificacion("Error al actualizar el estado.", true);
    }
  }

  // 2. ELIMINAR TRABAJO (Soft Delete con Modal)
  async function confirmarBorrado() {
    if (!idABorrar) return;
    
    const backup = [...trabajos];
    // Lo sacamos de la UI al instante
    setTrabajos(trabajos.filter(t => t.id !== idABorrar));
    
    try {
      await eliminarTrabajo(idABorrar);
      mostrarNotificacion(`Orden #${idABorrar} enviada a la papelera.`);
    } catch (e) {
      // Si falla, lo devolvemos a la lista
      setTrabajos(backup);
      mostrarNotificacion("Error al eliminar la orden.", true);
    } finally {
      setIdABorrar(null); // Cerramos el modal
    }
  }

  function mostrarNotificacion(msg: string, isError = false) {
    setNotificacion({ msg, isError });
    setTimeout(() => setNotificacion({ msg: "", isError: false }), 3000);
  }

  // Filtro cliente-side por estado
  const trabajosFiltrados = estadoFiltro === "TODOS"
    ? trabajos
    : trabajos.filter(t => t.estado === estadoFiltro);

  // Helper de colores para el select inline
  const getBadgeColor = (estado: string) => {
    switch (estado) {
      case "INGRESADO": return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";
      case "EN_PROCESO": return "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/50";
      case "FINALIZADO": return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50";
      case "ENTREGADO": return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50";
      case "ANULADO": return "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50 opacity-70";
      default: return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <AppShell
      currentPath="/trabajos"
      title="Gestión de Órdenes"
      description="Historial completo. Editá, eliminá o cambiá el estado de los trabajos al vuelo."
      actions={
        <div className="flex items-center gap-3">
          <Link
            href="/trabajos/tablero"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-brand-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            <svg className="mr-2 h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
            </svg>
            Vista Tablero
          </Link>
          <Link
            href="/trabajos/nuevo"
            className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700"
          >
            + Nueva Orden
          </Link>
        </div>
      }
    >
      <div className="space-y-6">

        {/* HINT — primera visita */}
        <HintBubble
          id="hint-trabajos-v1"
          variant="banner"
          emoji="🔧"
          title="Creá tu primera orden de trabajo"
          desc="Tocá '+ Nueva Orden' arriba a la derecha. Necesitás tener al menos un cliente y un vehículo cargados."
          action={{ label: "Nueva orden de trabajo", href: "/trabajos/nuevo" }}
        />

        {/* NOTIFICACIÓN FLOTANTE (TOAST) */}
        {notificacion.msg && (
          <div className={cn("fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-5 fade-in rounded-lg px-5 py-3 text-sm font-bold text-white shadow-2xl sm:bottom-6 sm:left-auto sm:right-6 sm:w-auto", notificacion.isError ? "bg-red-600" : "bg-slate-900 dark:bg-brand-600")}>
            {notificacion.msg}
          </div>
        )}

        {/* MODAL DE CONFIRMACIÓN DE BORRADO (NIVEL ENTERPRISE) */}
        {idABorrar && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md scale-100 rounded-3xl bg-white p-8 shadow-2xl animate-in zoom-in-95 dark:bg-slate-800">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">¿Eliminar Orden #{idABorrar}?</h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Esta acción enviará la orden a la papelera. Las cuentas corrientes y el historial de la caja no se verán afectados, pero el trabajo desaparecerá de las listas activas.
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
              placeholder="Buscar por patente, cliente o ID..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-11 pr-4 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              {trabajosFiltrados.length} {trabajosFiltrados.length === 1 ? "orden" : "órdenes"}
            </p>
          </div>
        </div>

        {/* FILTROS POR ESTADO */}
        <div className="flex flex-wrap items-center gap-2">
          {FILTROS_ESTADO.map((f) => {
            const isActive = estadoFiltro === f.value;
            if (f.value === "TODOS") {
              return (
                <button
                  key={f.value}
                  onClick={() => setEstadoFiltro("TODOS")}
                  className={cn(
                    "rounded-full border px-4 py-1.5 text-xs font-bold uppercase tracking-wider transition-all",
                    isActive
                      ? "border-brand-500 bg-brand-500 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800"
                  )}
                >
                  Todos · {trabajos.length}
                </button>
              );
            }
            const count = trabajos.filter(t => t.estado === f.value).length;
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

        {/* LISTADO / TABLA */}
        <SectionCard title="Órdenes Activas e Históricas" description="Cambiá el estado usando el menú o las acciones rápidas.">

          {/* ── VISTA MOBILE (cards) — oculta en md+ ── */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800/60">
            {loading ? (
              [1,2,3].map(i => (
                <div key={i} className="animate-pulse space-y-3 py-4">
                  <div className="flex justify-between">
                    <div className="h-4 w-24 rounded bg-slate-100 dark:bg-slate-800" />
                    <div className="h-4 w-16 rounded bg-slate-100 dark:bg-slate-800" />
                  </div>
                  <div className="h-3 w-32 rounded bg-slate-100 dark:bg-slate-800" />
                  <div className="h-8 w-full rounded-lg bg-slate-100 dark:bg-slate-800" />
                </div>
              ))
            ) : trabajosFiltrados.length > 0 ? (
              trabajosFiltrados.map((t) => (
                <div key={t.id} className="py-4 space-y-3">
                  {/* Fila 1: Patente + Total */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-black text-slate-900 dark:text-white">{t.patente}</span>
                        <span className="font-mono text-[10px] font-bold text-slate-400">#{t.id}</span>
                      </div>
                      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{t.vehiculo}</p>
                    </div>
                    <span className="font-mono text-base font-black text-brand-600 dark:text-brand-400 shrink-0">{formatCurrency(t.total)}</span>
                  </div>
                  {/* Fila 2: Cliente */}
                  <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{t.cliente_nombre}</p>
                  {/* Fila 3: Estado + acciones */}
                  <div className="flex items-center gap-2">
                    <select
                      value={t.estado}
                      onChange={(e) => cambiarEstadoRapido(t.id, e.target.value)}
                      className={cn("cursor-pointer appearance-none rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider outline-none flex-1 min-w-0", getBadgeColor(t.estado))}
                    >
                      {ESTADOS_OPCIONES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Link href={`/trabajos/${t.id}`} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 dark:border-slate-700">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                      </Link>
                      <Link href={`/trabajos/nuevo?id=${t.id}`} className="flex h-9 w-9 items-center justify-center rounded-xl border border-brand-200 bg-brand-50 text-brand-600 dark:border-brand-900/50 dark:bg-brand-900/20 dark:text-brand-400">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                      </Link>
                      {t.total > 0 && t.estado !== "ANULADO" && (
                        <Link href={`/pagos/registrar?cliente=${t.cliente_id}`} className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-400">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </Link>
                      )}
                      <button onClick={() => setIdABorrar(t.id)} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 dark:border-slate-700">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="py-12 text-center text-sm text-slate-400">
                {estadoFiltro !== "TODOS" ? `No hay órdenes con estado "${FILTROS_ESTADO.find(f => f.value === estadoFiltro)?.label}".` : "No se encontraron órdenes."}
              </p>
            )}
          </div>

          {/* ── VISTA DESKTOP (tabla) — oculta en mobile ── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[900px]">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:border-slate-800">
                  <th className="py-4 pl-4 text-center w-16">OT</th>
                  <th className="py-4">Vehículo</th>
                  <th className="py-4">Cliente</th>
                  <th className="py-4">Estado (Editable)</th>
                  <th className="py-4 text-right">Total</th>
                  <th className="py-4 pr-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {loading ? (
                  <SkeletonRows />
                ) : trabajosFiltrados.length > 0 ? (
                  trabajosFiltrados.map((t) => (
                    <tr key={t.id} className="group transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                      <td className="py-4 pl-4 text-center font-mono text-xs font-bold text-slate-400">#{t.id}</td>
                      <td className="py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-white">{t.patente}</span>
                          <span className="text-[11px] font-semibold uppercase text-slate-500">{t.vehiculo}</span>
                        </div>
                      </td>
                      <td className="py-4">
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{t.cliente_nombre}</span>
                      </td>
                      <td className="py-4">
                        <select
                          value={t.estado}
                          onChange={(e) => cambiarEstadoRapido(t.id, e.target.value)}
                          className={cn("cursor-pointer appearance-none rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider outline-none transition-all hover:brightness-95 focus:ring-2 focus:ring-brand-500/50", getBadgeColor(t.estado))}
                        >
                          {ESTADOS_OPCIONES.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                        </select>
                      </td>
                      <td className="py-4 text-right">
                        <span className="font-mono text-sm font-black text-slate-900 dark:text-brand-400">{formatCurrency(t.total)}</span>
                      </td>
                      <td className="py-4 pr-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 opacity-80 transition-opacity group-hover:opacity-100">
                          <Link href={`/trabajos/${t.id}`} title="Ver expediente" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-600 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                          </Link>
                          <Link href={`/trabajos/nuevo?id=${t.id}`} title="Editar" className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand-200 bg-brand-50/50 text-brand-600 transition hover:border-brand-500 hover:bg-brand-500 hover:text-white dark:border-brand-900/50 dark:bg-brand-900/20 dark:text-brand-400 dark:hover:bg-brand-600 dark:hover:text-white">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                          </Link>
                          {t.total > 0 && t.estado !== "ANULADO" && (
                            <Link href={`/pagos/registrar?cliente=${t.cliente_id}`} title="Cobrar" className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50/50 text-emerald-600 transition hover:border-emerald-500 hover:bg-emerald-500 hover:text-white dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-600 dark:hover:text-white">
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                            </Link>
                          )}
                          <button onClick={() => setIdABorrar(t.id)} title="Eliminar" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-500 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:hover:bg-red-900/20 dark:hover:text-red-400">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="py-20 text-center text-sm text-slate-400">
                      {estadoFiltro !== "TODOS" ? `No hay órdenes con estado "${FILTROS_ESTADO.find(f => f.value === estadoFiltro)?.label}".` : "No se encontraron órdenes."}
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

function SkeletonRows() {
  return (
    <>
      {[1, 2, 3, 4, 5].map((i) => (
        <tr key={i} className="animate-pulse border-b border-slate-50 dark:border-slate-800/50">
          <td className="py-6 px-4"><div className="h-4 w-8 rounded bg-slate-100 dark:bg-slate-800 mx-auto" /></td>
          <td className="py-6 px-4"><div className="h-4 w-24 rounded bg-slate-100 dark:bg-slate-800" /></td>
          <td className="py-6 px-4"><div className="h-4 w-32 rounded bg-slate-100 dark:bg-slate-800" /></td>
          <td className="py-6 px-4"><div className="h-6 w-24 rounded-full bg-slate-100 dark:bg-slate-800" /></td>
          <td className="py-6 px-4"><div className="h-4 w-16 rounded bg-slate-100 dark:bg-slate-800 ml-auto" /></td>
          <td className="py-6 px-4 pr-4"><div className="h-8 w-32 rounded bg-slate-100 dark:bg-slate-800 ml-auto" /></td>
        </tr>
      ))}
    </>
  );
}