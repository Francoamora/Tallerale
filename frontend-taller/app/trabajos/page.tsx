"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { actualizarEstadoTrabajo, eliminarTrabajo, getTrabajos } from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { getSession, type SessionData } from "@/lib/trial";
import type { Trabajo } from "@/lib/types";
import { cn } from "@/lib/utils";

type UserRole = NonNullable<SessionData["rol"]>;

const ESTADOS = {
  INGRESADO: {
    label: "Por revisar",
    short: "Ingresado",
    badge: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200",
  },
  EN_PROCESO: {
    label: "En trabajo",
    short: "En proceso",
    badge: "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-300",
  },
  FINALIZADO: {
    label: "Listo para retirar",
    short: "Finalizado",
    badge: "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700/60 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  ENTREGADO: {
    label: "Entregado",
    short: "Entregado",
    badge: "border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-700/60 dark:bg-blue-900/30 dark:text-blue-300",
  },
  ANULADO: {
    label: "Anulado",
    short: "Anulado",
    badge: "border-red-300 bg-red-100 text-red-700 dark:border-red-800/60 dark:bg-red-900/25 dark:text-red-300",
  },
} as const;

type Estado = keyof typeof ESTADOS;
type Filtro = "TODOS" | Estado;

const TRANSICIONES: Record<Estado, Estado[]> = {
  INGRESADO: ["EN_PROCESO", "ANULADO"],
  EN_PROCESO: ["INGRESADO", "FINALIZADO", "ANULADO"],
  FINALIZADO: ["EN_PROCESO", "ENTREGADO", "ANULADO"],
  ENTREGADO: [],
  ANULADO: [],
};

const ACCION_PRINCIPAL: Partial<Record<Estado, { estado: Estado; label: string }>> = {
  INGRESADO: { estado: "EN_PROCESO", label: "Iniciar" },
  EN_PROCESO: { estado: "FINALIZADO", label: "Marcar listo" },
  FINALIZADO: { estado: "ENTREGADO", label: "Entregar" },
};

const FILTROS: Filtro[] = ["TODOS", "INGRESADO", "EN_PROCESO", "FINALIZADO", "ENTREGADO", "ANULADO"];

export default function ListadoTrabajos() {
  const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [estadoFiltro, setEstadoFiltro] = useState<Filtro>("TODOS");
  const [role, setRole] = useState<UserRole | null>(null);
  const [notificacion, setNotificacion] = useState({ msg: "", isError: false });
  const [idABorrar, setIdABorrar] = useState<number | null>(null);
  const [actualizandoId, setActualizandoId] = useState<number | null>(null);

  const canManage = role === "ADMIN" || role === "RECEPCION";
  const showAmounts = canManage;

  useEffect(() => {
    setRole(getSession()?.rol ?? null);
  }, []);

  useEffect(() => {
    async function cargar() {
      try {
        setLoading(true);
        setTrabajos(await getTrabajos(busqueda));
      } catch (error) {
        mostrarNotificacion(error instanceof Error ? error.message : "No se pudieron cargar las órdenes.", true);
      } finally {
        setLoading(false);
      }
    }
    const timer = setTimeout(cargar, 250);
    return () => clearTimeout(timer);
  }, [busqueda]);

  const conteos = useMemo(
    () => Object.fromEntries(Object.keys(ESTADOS).map((estado) => [
      estado,
      trabajos.filter((trabajo) => trabajo.estado === estado).length,
    ])) as Record<Estado, number>,
    [trabajos],
  );

  const trabajosFiltrados = useMemo(
    () => estadoFiltro === "TODOS" ? trabajos : trabajos.filter((trabajo) => trabajo.estado === estadoFiltro),
    [estadoFiltro, trabajos],
  );

  const totalActivo = useMemo(
    () => trabajos
      .filter((trabajo) => !["ENTREGADO", "ANULADO"].includes(trabajo.estado))
      .reduce((total, trabajo) => total + Number(trabajo.total), 0),
    [trabajos],
  );

  function mostrarNotificacion(msg: string, isError = false) {
    setNotificacion({ msg, isError });
    window.setTimeout(() => setNotificacion({ msg: "", isError: false }), 3500);
  }

  function puedeEjecutarTransicion(actual: Estado, destino: Estado) {
    if (!TRANSICIONES[actual].includes(destino)) return false;
    if ((destino === "ENTREGADO" || destino === "ANULADO") && !canManage) return false;
    return true;
  }

  async function cambiarEstado(id: number, nuevoEstado: Estado) {
    const trabajo = trabajos.find((item) => item.id === id);
    if (!trabajo || !puedeEjecutarTransicion(trabajo.estado as Estado, nuevoEstado)) return;
    const backup = trabajos;
    setActualizandoId(id);
    setTrabajos((actuales) => actuales.map((item) => item.id === id ? { ...item, estado: nuevoEstado } : item));
    try {
      await actualizarEstadoTrabajo(id, nuevoEstado);
      mostrarNotificacion(`OT-${id}: ${ESTADOS[nuevoEstado].label}.`);
    } catch (error) {
      setTrabajos(backup);
      mostrarNotificacion(error instanceof Error ? error.message : "No se pudo cambiar el estado.", true);
    } finally {
      setActualizandoId(null);
    }
  }

  async function confirmarBorrado() {
    if (idABorrar === null) return;
    const id = idABorrar;
    const backup = trabajos;
    setTrabajos((actuales) => actuales.filter((trabajo) => trabajo.id !== id));
    setIdABorrar(null);
    try {
      await eliminarTrabajo(id);
      mostrarNotificacion(`OT-${id} enviada a la papelera.`);
    } catch (error) {
      setTrabajos(backup);
      mostrarNotificacion(error instanceof Error ? error.message : "No se pudo eliminar la orden.", true);
    }
  }

  return (
    <AppShell
      compact
      currentPath="/trabajos"
      badge="Operaciones"
      title="Órdenes de trabajo"
      description="Buscá, controlá y continuá cada trabajo desde un solo lugar."
      actions={
        <div className="flex items-center gap-2">
          <Link
            href="/trabajos/tablero"
            className="inline-flex items-center rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-bold text-slate-700 transition hover:border-brand-400 hover:text-brand-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            Vista tablero
          </Link>
          {canManage && (
            <Link
              href="/trabajos/nuevo"
              className="inline-flex items-center rounded-xl bg-brand-600 px-4 py-2.5 text-xs font-black text-white shadow-sm transition hover:bg-brand-700"
            >
              + Nueva orden
            </Link>
          )}
        </div>
      }
    >
      {notificacion.msg && (
        <div className={cn(
          "fixed bottom-6 right-6 z-[80] max-w-sm rounded-xl px-4 py-3 text-sm font-bold text-white shadow-2xl",
          notificacion.isError ? "bg-red-600" : "bg-emerald-600",
        )}>
          {notificacion.msg}
        </div>
      )}

      {idABorrar !== null && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-2xl dark:border-slate-700 dark:bg-slate-800">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-300">!</div>
            <h2 className="mt-4 text-xl font-black text-slate-900 dark:text-white">¿Eliminar la OT-{idABorrar}?</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Desaparecerá de la operación activa. Los movimientos contables ya registrados se conservan.
            </p>
            <div className="mt-7 flex gap-3">
              <button onClick={() => setIdABorrar(null)} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700">
                Cancelar
              </button>
              <button onClick={confirmarBorrado} className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-700">
                Eliminar orden
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && trabajos.length === 0 && !busqueda && (
        <div className="mb-4 flex flex-col gap-4 rounded-2xl border border-brand-200 bg-brand-50 p-5 dark:border-brand-900/50 dark:bg-brand-950/20 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-black text-slate-900 dark:text-white">Tu operación empieza con una orden</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Elegí cliente, vehículo y tareas para comenzar el seguimiento.</p>
          </div>
          {canManage && <Link href="/trabajos/nuevo" className="rounded-xl bg-brand-600 px-4 py-2.5 text-center text-sm font-bold text-white">Crear primera orden</Link>}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Resumen label="Órdenes visibles" value={String(trabajos.length)} helper="Según la búsqueda actual" />
        <Resumen label="En trabajo" value={String(conteos.EN_PROCESO)} helper="Vehículos en ejecución" accent="amber" />
        <Resumen label="Listos para retirar" value={String(conteos.FINALIZADO)} helper="Esperando entrega" accent="emerald" />
        {showAmounts
          ? <Resumen label="Capital activo" value={formatCurrency(totalActivo)} helper="Órdenes aún no cerradas" accent="brand" />
          : <Resumen label="Pendientes de revisión" value={String(conteos.INGRESADO)} helper="Nuevos ingresos" accent="brand" />}
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative min-w-0 flex-1">
            <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              value={busqueda}
              onChange={(event) => setBusqueda(event.target.value)}
              placeholder="Buscar patente, cliente u orden…"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
            />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
            {FILTROS.map((filtro) => {
              const active = filtro === estadoFiltro;
              const count = filtro === "TODOS" ? trabajos.length : conteos[filtro];
              return (
                <button
                  key={filtro}
                  onClick={() => setEstadoFiltro(filtro)}
                  className={cn(
                    "shrink-0 rounded-xl border px-3 py-2 text-[10px] font-black uppercase tracking-wider transition",
                    active
                      ? "border-brand-500 bg-brand-500 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400",
                  )}
                >
                  {filtro === "TODOS" ? "Todas" : ESTADOS[filtro].short} · {count}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700">
          <div>
            <h2 className="text-base font-black text-slate-900 dark:text-white">Historial operativo</h2>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">La acción principal continúa el flujo sin saltear etapas.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-500 dark:bg-slate-700 dark:text-slate-300">
            {trabajosFiltrados.length} resultados
          </span>
        </div>

        {loading ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {[1, 2, 3, 4].map((item) => <Skeleton key={item} />)}
          </div>
        ) : trabajosFiltrados.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="font-bold text-slate-700 dark:text-slate-300">No encontramos órdenes en esta vista.</p>
            <p className="mt-1 text-sm text-slate-400">Probá cambiando el filtro o la búsqueda.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-700/80">
            {trabajosFiltrados.map((trabajo) => (
              <FilaTrabajo
                key={trabajo.id}
                trabajo={trabajo}
                canManage={canManage}
                showAmounts={showAmounts}
                loading={actualizandoId === trabajo.id}
                onEstado={cambiarEstado}
                onDelete={() => setIdABorrar(trabajo.id)}
              />
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}

function Resumen({ label, value, helper, accent = "slate" }: { label: string; value: string; helper: string; accent?: "slate" | "amber" | "emerald" | "brand" }) {
  const accentClass = {
    slate: "text-slate-900 dark:text-white",
    amber: "text-amber-600 dark:text-amber-400",
    emerald: "text-emerald-600 dark:text-emerald-400",
    brand: "text-brand-600 dark:text-brand-400",
  }[accent];
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className={cn("mt-1 font-mono text-xl font-black", accentClass)}>{value}</p>
      <p className="mt-0.5 text-[10px] text-slate-400">{helper}</p>
    </div>
  );
}

function FilaTrabajo({
  trabajo,
  canManage,
  showAmounts,
  loading,
  onEstado,
  onDelete,
}: {
  trabajo: Trabajo;
  canManage: boolean;
  showAmounts: boolean;
  loading: boolean;
  onEstado: (id: number, estado: Estado) => void;
  onDelete: () => void;
}) {
  const estado = trabajo.estado as Estado;
  const meta = ESTADOS[estado] ?? ESTADOS.INGRESADO;
  const accion = ACCION_PRINCIPAL[estado];
  const canUsePrimary = Boolean(accion && (accion.estado !== "ENTREGADO" || canManage));

  return (
    <article className="group grid gap-4 px-4 py-4 transition hover:bg-slate-50/80 dark:hover:bg-slate-900/30 md:grid-cols-[100px_minmax(170px,1fr)_minmax(150px,1fr)_minmax(180px,1.25fr)_auto] md:items-center md:px-5">
      <div>
        <p className="font-mono text-xs font-black text-slate-700 dark:text-slate-200">OT-{String(trabajo.id).padStart(4, "0")}</p>
        <p className="mt-1 text-[10px] text-slate-400">{formatDateTime(trabajo.fecha_ingreso)}</p>
      </div>

      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-mono text-base font-black tracking-wide text-slate-900 dark:text-white">{trabajo.patente}</span>
          <span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider", meta.badge)}>{meta.label}</span>
        </div>
        <p className="mt-0.5 truncate text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{trabajo.vehiculo}</p>
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-200">{trabajo.cliente_nombre}</p>
        {showAmounts && <p className="mt-1 font-mono text-sm font-black text-slate-900 dark:text-white">{formatCurrency(trabajo.total)}</p>}
      </div>

      <p className="line-clamp-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
        {trabajo.resumen || "Sin diagnóstico inicial cargado."}
      </p>

      <div className="flex flex-wrap items-center gap-2 md:justify-end">
        <Link href={`/trabajos/${trabajo.id}`} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 transition hover:border-brand-400 hover:text-brand-600 dark:border-slate-700 dark:text-slate-200">
          Abrir
        </Link>
        {canUsePrimary && accion && (
          <button
            onClick={() => onEstado(trabajo.id, accion.estado)}
            disabled={loading}
            className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white transition hover:bg-brand-600 disabled:opacity-50 dark:bg-white dark:text-slate-900"
          >
            {loading ? "Guardando…" : `${accion.label} →`}
          </button>
        )}
        {canManage && (
          <>
            <Link href={`/trabajos/nuevo?id=${trabajo.id}`} className="rounded-xl border border-brand-100 bg-brand-50 px-3 py-2 text-xs font-bold text-brand-600 transition hover:bg-brand-100 dark:border-brand-900 dark:bg-brand-900 dark:text-brand-100">
              Editar
            </Link>
            {trabajo.total > 0 && estado !== "ANULADO" && (
              <Link href={`/pagos/registrar?cliente=${trabajo.cliente_id}`} className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 transition hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
                Cobrar
              </Link>
            )}
            <button onClick={onDelete} title="Eliminar orden" className="flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition hover:border-red-400 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:hover:bg-red-950/30">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </>
        )}
      </div>
    </article>
  );
}

function Skeleton() {
  return (
    <div className="grid animate-pulse gap-4 px-5 py-5 md:grid-cols-5">
      {[16, 28, 24, 36, 24].map((width, index) => (
        <div key={index} className="h-4 rounded bg-slate-100 dark:bg-slate-700" style={{ width: `${width * 4}px`, maxWidth: "100%" }} />
      ))}
    </div>
  );
}
