"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import {
  actualizarEstadoTrabajo,
  actualizarItemTrabajo,
  getTableroTrabajos,
  getTrabajoById,
  type TableroData,
  type TrabajoKanban,
} from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { getSession, type SessionData } from "@/lib/trial";
import type { TrabajoDetalle } from "@/lib/types";
import { cn } from "@/lib/utils";

const REFRESH_INTERVAL_MS = 60_000;
type EstadoTrabajo = "INGRESADO" | "EN_PROCESO" | "FINALIZADO" | "ENTREGADO";
type UserRole = NonNullable<SessionData["rol"]>;

const FLUJO: Array<{
  estado: EstadoTrabajo;
  numero: number;
  titulo: string;
  corto: string;
  descripcion: string;
  siguiente?: EstadoTrabajo;
  accion?: string;
  colorBorde: string;
  colorFondo: string;
}> = [
  {
    estado: "INGRESADO",
    numero: 1,
    titulo: "Por revisar",
    corto: "Ingreso",
    descripcion: "Confirmar diagnóstico y tareas.",
    siguiente: "EN_PROCESO",
    accion: "Iniciar trabajo",
    colorBorde: "border-slate-400 dark:border-slate-500",
    colorFondo: "bg-slate-100/50 dark:bg-slate-900/30",
  },
  {
    estado: "EN_PROCESO",
    numero: 2,
    titulo: "En trabajo",
    corto: "Ejecución",
    descripcion: "Completar tareas y repuestos.",
    siguiente: "FINALIZADO",
    accion: "Marcar listo",
    colorBorde: "border-amber-400 dark:border-amber-500/60",
    colorFondo: "bg-amber-50/50 dark:bg-amber-950/10",
  },
  {
    estado: "FINALIZADO",
    numero: 3,
    titulo: "Listo para retirar",
    corto: "Control final",
    descripcion: "Avisar y preparar la entrega.",
    siguiente: "ENTREGADO",
    accion: "Registrar entrega",
    colorBorde: "border-emerald-400 dark:border-emerald-500/60",
    colorFondo: "bg-emerald-50/50 dark:bg-emerald-950/10",
  },
  {
    estado: "ENTREGADO",
    numero: 4,
    titulo: "Entregados recientes",
    corto: "Cierre",
    descripcion: "Se conservan aquí durante 48 h.",
    colorBorde: "border-blue-400 dark:border-blue-500/60",
    colorFondo: "bg-blue-50/50 dark:bg-blue-950/10",
  },
];

export default function TableroTrabajos() {
  const [tablero, setTablero] = useState<TableroData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [seleccionado, setSeleccionado] = useState<TrabajoDetalle | null>(null);
  const [detalleLoading, setDetalleLoading] = useState(false);
  const [accionando, setAccionando] = useState(false);
  const [feedback, setFeedback] = useState<{ message: string; error: boolean } | null>(null);
  const requestInFlight = useRef(false);

  const showAmounts = role === "ADMIN" || role === "RECEPCION";
  const canCreate = role === "ADMIN" || role === "RECEPCION";

  const cargarTablero = useCallback(async (silencioso = false) => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    try {
      if (silencioso) setRefreshing(true);
      else setLoading(true);
      const data = await getTableroTrabajos();
      setTablero(data);
      setUltimaActualizacion(new Date());
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : "No se pudo actualizar el tablero.", error: true });
    } finally {
      requestInFlight.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    setRole(getSession()?.rol ?? null);
    cargarTablero(false);
  }, [cargarTablero]);

  useEffect(() => {
    const interval = setInterval(() => cargarTablero(true), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [cargarTablero]);

  useEffect(() => {
    if (!feedback) return;
    const timeout = setTimeout(() => setFeedback(null), 3500);
    return () => clearTimeout(timeout);
  }, [feedback]);

  async function abrirDetalle(id: number) {
    setDetalleLoading(true);
    setSeleccionado(null);
    try {
      setSeleccionado(await getTrabajoById(id));
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : "No se pudo abrir la orden.", error: true });
    } finally {
      setDetalleLoading(false);
    }
  }

  async function avanzarTrabajo(trabajo: TrabajoKanban | TrabajoDetalle) {
    const paso = FLUJO.find((item) => item.estado === trabajo.estado);
    if (!paso?.siguiente) return;
    const pendientes = "items" in trabajo
      ? trabajo.items.filter((item) => !item.completado).length
      : Math.max(0, trabajo.items_total - trabajo.items_completados);
    if (trabajo.estado === "EN_PROCESO" && pendientes > 0) {
      setFeedback({ message: `Faltan ${pendientes} tareas por completar.`, error: true });
      if (!("items" in trabajo)) await abrirDetalle(trabajo.id);
      return;
    }

    setAccionando(true);
    try {
      await actualizarEstadoTrabajo(trabajo.id, paso.siguiente);
      setFeedback({ message: `${paso.accion}: estado actualizado.`, error: false });
      if (seleccionado?.id === trabajo.id) {
        setSeleccionado({ ...seleccionado, estado: paso.siguiente });
      }
      await cargarTablero(true);
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : "No se pudo avanzar la orden.", error: true });
    } finally {
      setAccionando(false);
    }
  }

  async function toggleItem(itemId: number, completado: boolean) {
    if (!seleccionado) return;
    const previo = seleccionado;
    setSeleccionado({
      ...seleccionado,
      items: seleccionado.items.map((item) =>
        item.id === itemId ? { ...item, completado, completado_en: completado ? new Date().toISOString() : null } : item
      ),
    });
    try {
      await actualizarItemTrabajo(seleccionado.id, itemId, completado);
      await cargarTablero(true);
    } catch (error) {
      setSeleccionado(previo);
      setFeedback({ message: error instanceof Error ? error.message : "No se pudo actualizar la tarea.", error: true });
    }
  }

  if (loading) {
    return (
      <AppShell compact currentPath="/trabajos/tablero" title="Estado del Taller" description="Sincronizando el flujo operativo...">
        <div className="flex h-[60vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
        </div>
      </AppShell>
    );
  }

  if (!tablero) return null;

  return (
    <AppShell
      compact
      currentPath="/trabajos/tablero"
      badge="Flujo operativo"
      title="Trabajo del taller"
      description="Cada tarjeta indica qué falta y cuál es el próximo paso."
      actions={
        <div className="flex items-center gap-2">
          <div className="hidden text-right lg:block">
            <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">
              {ultimaActualizacion
                ? `Actualizado ${ultimaActualizacion.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`
                : "Sincronizando"}
            </p>
            <p className="text-[9px] text-slate-400">Automático cada 60 s</p>
          </div>
          <button
            onClick={() => cargarTablero(true)}
            disabled={refreshing}
            title="Actualizar ahora"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-brand-500 hover:text-brand-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800"
          >
            <svg className={cn("h-4 w-4", refreshing && "animate-spin")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8 8 0 004.582 9M20 20v-5h-.581m0 0A8 8 0 014.062 13" />
            </svg>
          </button>
          <Link href="/trabajos" className="hidden rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 sm:inline-flex">
            Ver lista
          </Link>
          {canCreate && (
            <Link href="/trabajos/nuevo" className="inline-flex items-center rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700">
              + Nuevo ingreso
            </Link>
          )}
        </div>
      }
    >
      {feedback && (
        <div className={cn(
          "fixed bottom-6 right-6 z-[80] max-w-sm rounded-xl px-4 py-3 text-sm font-bold text-white shadow-2xl",
          feedback.error ? "bg-red-600" : "bg-emerald-600",
        )}>
          {feedback.message}
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-800 lg:grid-cols-4">
        {FLUJO.map((paso, index) => (
          <div key={paso.estado} className="relative flex items-center gap-3 rounded-xl px-3 py-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-900 text-[11px] font-black text-white dark:bg-white dark:text-slate-900">
              {paso.numero}
            </div>
            <div className="min-w-0">
              <p className="truncate text-xs font-black text-slate-900 dark:text-white">{paso.corto}</p>
              <p className="hidden truncate text-[10px] text-slate-400 sm:block">{paso.descripcion}</p>
            </div>
            {index < FLUJO.length - 1 && <span className="absolute -right-1.5 hidden text-slate-300 lg:block">→</span>}
          </div>
        ))}
      </div>

      <div className="grid items-start gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        {FLUJO.map((paso) => (
          <ColumnaKanban
            key={paso.estado}
            paso={paso}
            datos={tablero[paso.estado]}
            showAmounts={showAmounts}
            onOpen={abrirDetalle}
            onAdvance={avanzarTrabajo}
            actionLoading={accionando}
          />
        ))}
      </div>

      {(detalleLoading || seleccionado) && (
        <div className="fixed inset-0 z-[70] flex justify-end bg-slate-950/45 backdrop-blur-[2px]" onMouseDown={() => !detalleLoading && setSeleccionado(null)}>
          <aside
            className="h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-slate-50 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
            onMouseDown={(event) => event.stopPropagation()}
          >
            {detalleLoading ? (
              <div className="flex h-full items-center justify-center">
                <div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
              </div>
            ) : seleccionado ? (
              <PanelOperativo
                trabajo={seleccionado}
                showAmounts={showAmounts}
                actionLoading={accionando}
                onClose={() => setSeleccionado(null)}
                onToggleItem={toggleItem}
                onAdvance={() => avanzarTrabajo(seleccionado)}
              />
            ) : null}
          </aside>
        </div>
      )}
    </AppShell>
  );
}

function ColumnaKanban({
  paso,
  datos,
  showAmounts,
  onOpen,
  onAdvance,
  actionLoading,
}: {
  paso: (typeof FLUJO)[number];
  datos: { trabajos: TrabajoKanban[]; total_plata: number };
  showAmounts: boolean;
  onOpen: (id: number) => void;
  onAdvance: (trabajo: TrabajoKanban) => void;
  actionLoading: boolean;
}) {
  return (
    <section className={cn("min-w-0 rounded-2xl border-t-4 bg-white p-3 shadow-sm dark:bg-slate-800", paso.colorBorde)}>
      <div className="mb-3 flex items-start justify-between gap-2 px-1">
        <div>
          <h2 className="text-sm font-black text-slate-900 dark:text-white">{paso.numero}. {paso.titulo}</h2>
          <p className="mt-0.5 text-[10px] text-slate-400">{paso.descripcion}</p>
        </div>
        <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-slate-100 px-2 text-[10px] font-black text-slate-600 dark:bg-slate-700 dark:text-slate-300">
          {datos.trabajos.length}
        </span>
      </div>

      {showAmounts && (
        <div className="mb-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-900/50">
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Capital retenido</span>
          <span className="font-mono text-sm font-black text-slate-700 dark:text-slate-300">{formatCurrency(datos.total_plata)}</span>
        </div>
      )}

      <div className={cn("flex min-h-32 flex-col gap-3 rounded-xl p-2", paso.colorFondo)}>
        {datos.trabajos.length > 0 ? (
          datos.trabajos.map((trabajo) => (
            <TarjetaTrabajo
              key={trabajo.id}
              trabajo={trabajo}
              paso={paso}
              showAmounts={showAmounts}
              onOpen={() => onOpen(trabajo.id)}
              onAdvance={() => onAdvance(trabajo)}
              actionLoading={actionLoading}
            />
          ))
        ) : (
          <div className="flex min-h-28 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300/70 px-4 text-center dark:border-slate-700">
            <span className="text-lg text-slate-300">✓</span>
            <p className="mt-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Sin vehículos</p>
            <p className="mt-1 text-[10px] text-slate-400">No hay acciones pendientes en esta etapa.</p>
          </div>
        )}
      </div>
    </section>
  );
}

function TarjetaTrabajo({
  trabajo,
  paso,
  showAmounts,
  onOpen,
  onAdvance,
  actionLoading,
}: {
  trabajo: TrabajoKanban;
  paso: (typeof FLUJO)[number];
  showAmounts: boolean;
  onOpen: () => void;
  onAdvance: () => void;
  actionLoading: boolean;
}) {
  const demorado = trabajo.dias_en_taller >= 7;
  const progreso = trabajo.items_total > 0
    ? Math.round((trabajo.items_completados / trabajo.items_total) * 100)
    : 0;
  const checklistPendiente = ["EN_PROCESO", "FINALIZADO"].includes(trabajo.estado) && trabajo.items_total > trabajo.items_completados;

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-brand-400 hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
      <button type="button" onClick={onOpen} className="block w-full text-left">
        <div className="flex items-center justify-between gap-2">
          <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-500 dark:bg-slate-700/60 dark:text-slate-300">
            OT-{trabajo.id}
          </span>
          <span className={cn("text-[9px] font-black uppercase tracking-wider", demorado ? "text-red-500" : "text-slate-400")}>
            {trabajo.dias_en_taller === 0 ? "Ingresó hoy" : demorado ? `Demorado · ${trabajo.dias_en_taller} d` : `${trabajo.dias_en_taller} días`}
          </span>
        </div>
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="font-mono text-base font-black text-slate-900 dark:text-white">{trabajo.patente}</h3>
            <p className="truncate text-[10px] font-bold uppercase tracking-wide text-slate-500">{trabajo.vehiculo}</p>
          </div>
          {showAmounts && <p className="shrink-0 font-mono text-sm font-black text-slate-900 dark:text-white">{formatCurrency(trabajo.total)}</p>}
        </div>
        <p className="mt-2 line-clamp-2 min-h-8 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{trabajo.resumen_corto}</p>
        {trabajo.responsable_nombre && (
          <p className="mt-2 truncate text-[10px] font-semibold text-slate-400">
            Responsable: <span className="text-slate-600 dark:text-slate-300">{trabajo.responsable_nombre}</span>
          </p>
        )}

        <div className="mt-3">
          <div className="flex items-center justify-between text-[9px] font-bold uppercase tracking-wider text-slate-400">
            <span>Checklist</span>
            <span>{trabajo.items_completados}/{trabajo.items_total}</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progreso}%` }} />
          </div>
        </div>
      </button>

      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3 dark:border-slate-700">
        <button type="button" onClick={onOpen} className="shrink-0 whitespace-nowrap text-[10px] font-bold text-slate-500 hover:text-brand-600">
          Ver tareas
        </button>
        {paso.accion && (
          <button
            type="button"
            onClick={onAdvance}
            disabled={actionLoading}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-lg px-3 py-1.5 text-[10px] font-black transition active:scale-95 disabled:opacity-50",
              checklistPendiente
                ? "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400"
                : "bg-slate-900 text-white hover:bg-brand-600 dark:bg-white dark:text-slate-900",
            )}
          >
            {checklistPendiente ? `Faltan ${trabajo.items_total - trabajo.items_completados}` : `${paso.accion} →`}
          </button>
        )}
      </div>
    </article>
  );
}

function PanelOperativo({
  trabajo,
  showAmounts,
  actionLoading,
  onClose,
  onToggleItem,
  onAdvance,
}: {
  trabajo: TrabajoDetalle;
  showAmounts: boolean;
  actionLoading: boolean;
  onClose: () => void;
  onToggleItem: (itemId: number, completado: boolean) => void;
  onAdvance: () => void;
}) {
  const paso = FLUJO.find((item) => item.estado === trabajo.estado);
  const completados = trabajo.items.filter((item) => item.completado).length;
  const progreso = trabajo.items.length > 0 ? Math.round((completados / trabajo.items.length) * 100) : 0;
  const requiereChecklist = ["EN_PROCESO", "FINALIZADO"].includes(trabajo.estado);
  const puedeAvanzar = !requiereChecklist || completados === trabajo.items.length;

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-brand-500">OT-{trabajo.id} · {paso?.titulo}</p>
            <h2 className="mt-1 font-mono text-2xl font-black text-slate-900 dark:text-white">{trabajo.vehiculo.patente}</h2>
            <p className="text-xs text-slate-500">{trabajo.vehiculo.marca} {trabajo.vehiculo.modelo} · {trabajo.cliente.nombre_completo}</p>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">×</button>
        </div>
      </header>

      <div className="space-y-5 p-5">
        <div className="grid grid-cols-4 gap-1.5">
          {FLUJO.map((item, index) => {
            const actual = FLUJO.findIndex((flow) => flow.estado === trabajo.estado);
            const done = index <= actual;
            return (
              <div key={item.estado}>
                <div className={cn("h-1.5 rounded-full", done ? "bg-brand-500" : "bg-slate-200 dark:bg-slate-700")} />
                <p className={cn("mt-1 truncate text-[9px] font-bold", index === actual ? "text-brand-500" : "text-slate-400")}>{item.corto}</p>
              </div>
            );
          })}
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Trabajo solicitado</h3>
              <p className="mt-1 text-xs leading-relaxed text-slate-600 dark:text-slate-300">{trabajo.resumen_trabajos || "Sin diagnóstico inicial."}</p>
            </div>
            {showAmounts && <p className="shrink-0 font-mono text-lg font-black text-slate-900 dark:text-white">{formatCurrency(trabajo.total)}</p>}
          </div>
          <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-slate-500">
            <span className="rounded-lg bg-slate-100 px-2 py-1 dark:bg-slate-700">Ingreso: {formatDateTime(trabajo.fecha_ingreso)}</span>
            <span className="rounded-lg bg-slate-100 px-2 py-1 dark:bg-slate-700">{trabajo.kilometraje.toLocaleString("es-AR")} km</span>
            {trabajo.responsable_nombre && <span className="rounded-lg bg-slate-100 px-2 py-1 dark:bg-slate-700">Responsable: {trabajo.responsable_nombre}</span>}
            {trabajo.iniciado_en && <span className="rounded-lg bg-slate-100 px-2 py-1 dark:bg-slate-700">Inicio real: {formatDateTime(trabajo.iniciado_en)}</span>}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h3 className="text-sm font-black text-slate-900 dark:text-white">Checklist operativo</h3>
              <p className="mt-0.5 text-xs text-slate-500">Marcá cada tarea o repuesto al completarlo.</p>
            </div>
            <p className="font-mono text-sm font-black text-slate-700 dark:text-slate-200">{completados}/{trabajo.items.length}</p>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progreso}%` }} />
          </div>

          <div className="mt-4 space-y-2">
            {trabajo.items.length > 0 ? trabajo.items.map((item) => (
              <label key={item.id} className={cn(
                "flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition",
                item.completado
                  ? "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900/40 dark:bg-emerald-950/20"
                  : "border-slate-200 hover:border-brand-300 dark:border-slate-700",
              )}>
                <input
                  type="checkbox"
                  checked={item.completado}
                  disabled={trabajo.estado === "ENTREGADO"}
                  onChange={(event) => onToggleItem(item.id, event.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-emerald-600"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-3">
                    <p className={cn("text-sm font-bold text-slate-800 dark:text-slate-100", item.completado && "line-through opacity-60")}>{item.descripcion}</p>
                    {showAmounts && <span className="shrink-0 font-mono text-xs font-bold text-slate-500">{formatCurrency(item.subtotal)}</span>}
                  </div>
                  <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {{ MANO_OBRA: "Tarea", REPUESTO: "Repuesto", INSUMO: "Insumo", OTRO: "Otro" }[item.tipo]} · Cant. {item.cantidad}
                  </p>
                </div>
              </label>
            )) : (
              <div className="rounded-xl border border-dashed border-slate-300 p-5 text-center dark:border-slate-700">
                <p className="text-xs font-bold text-slate-500">Esta orden no tiene tareas cargadas.</p>
                <Link href={`/trabajos/nuevo?id=${trabajo.id}`} className="mt-2 inline-block text-xs font-bold text-brand-600">Agregar tareas →</Link>
              </div>
            )}
          </div>
        </section>

        {trabajo.observaciones_internas && (
          <section className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900/40 dark:bg-violet-950/20">
            <h3 className="text-xs font-black uppercase tracking-wider text-violet-700 dark:text-violet-400">Nota interna</h3>
            <p className="mt-1 text-xs leading-relaxed text-violet-900/80 dark:text-violet-200/80">{trabajo.observaciones_internas}</p>
          </section>
        )}
      </div>

      <footer className="sticky bottom-0 border-t border-slate-200 bg-white/95 p-4 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
        {!puedeAvanzar && <p className="mb-2 text-center text-xs font-bold text-amber-600">Completá las {trabajo.items.length - completados} tareas pendientes para avanzar.</p>}
        <div className="flex gap-2">
          <Link href={`/trabajos/${trabajo.id}`} className="flex-1 rounded-xl border border-slate-200 px-4 py-3 text-center text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            Abrir expediente
          </Link>
          {paso?.accion && (
            <button
              onClick={onAdvance}
              disabled={actionLoading || !puedeAvanzar}
              className="flex-1 rounded-xl bg-brand-600 px-4 py-3 text-xs font-black text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {paso.accion} →
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
