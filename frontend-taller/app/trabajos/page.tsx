"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Patente } from "@/components/patente";
import { StatusBadge } from "@/components/status-badge";
import { AppShell } from "@/components/app-shell";
import { actualizarEstadoTrabajo, actualizarItemTrabajo, eliminarTrabajo, getTrabajoById, getTrabajos } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { getSession, type SessionData } from "@/lib/trial";
import type { Trabajo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ESTADO_TRABAJO_LABEL, numeroOrden } from "@/lib/documentos";

type UserRole = NonNullable<SessionData["rol"]>;

const ESTADOS = {
  INGRESADO: {
    label: ESTADO_TRABAJO_LABEL.INGRESADO,
    badge: "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200",
  },
  EN_PROCESO: {
    label: ESTADO_TRABAJO_LABEL.EN_PROCESO,
    badge: "border-amber-300 bg-amber-100 text-amber-800 dark:border-amber-700/60 dark:bg-amber-900/30 dark:text-amber-300",
  },
  FINALIZADO: {
    label: ESTADO_TRABAJO_LABEL.FINALIZADO,
    badge: "border-emerald-300 bg-emerald-100 text-emerald-800 dark:border-emerald-700/60 dark:bg-emerald-900/30 dark:text-emerald-300",
  },
  ENTREGADO: {
    label: ESTADO_TRABAJO_LABEL.ENTREGADO,
    badge: "border-blue-300 bg-blue-100 text-blue-800 dark:border-blue-700/60 dark:bg-blue-900/30 dark:text-blue-300",
  },
  ANULADO: {
    label: ESTADO_TRABAJO_LABEL.ANULADO,
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
  const [tareasPendientes, setTareasPendientes] = useState<{ id: number; destino: Estado; cantidad: number | null } | null>(null);
  const [idABorrar, setIdABorrar] = useState<number | null>(null);
  const [actualizandoId, setActualizandoId] = useState<number | null>(null);
  const [menu, setMenu] = useState<{ id: number; tipo: "estado" | "mas" } | null>(null);

  const canManage = role === "ADMIN" || role === "RECEPCION";
  const showAmounts = canManage;

  useEffect(() => {
    setRole(getSession()?.rol ?? null);
    // El panel principal enlaza cada etapa como /trabajos?estado=EN_PROCESO.
    // Se lee de window.location: useSearchParams obligaría a envolver toda la
    // página en un Suspense.
    const estado = new URLSearchParams(window.location.search).get("estado");
    if (estado && (FILTROS as string[]).includes(estado)) setEstadoFiltro(estado as Filtro);
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
    const timer = setTimeout(cargar, busqueda ? 250 : 0);
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
      mostrarNotificacion(`${numeroOrden(id)}: ${ESTADOS[nuevoEstado].label}.`);
    } catch (error) {
      setTrabajos(backup);
      const mensaje = error instanceof Error ? error.message : "";
      // El servidor no deja cerrar una etapa con tareas sin tildar: en vez de
      // un error, se ofrece tildarlas.
      if (/checklist/i.test(mensaje)) {
        setTareasPendientes({ id, destino: nuevoEstado, cantidad: null });
        void getTrabajoById(id)
          .then((detalle) => setTareasPendientes((actual) => actual && actual.id === id ? { ...actual, cantidad: detalle.items.filter((i) => !i.completado).length } : actual))
          .catch(() => {});
      } else {
        mostrarNotificacion(mensaje || "No se pudo cambiar el estado.", true);
      }
    } finally {
      setActualizandoId(null);
    }
  }

  async function tildarYAvanzar() {
    if (!tareasPendientes) return;
    const { id, destino } = tareasPendientes;
    setTareasPendientes(null);
    setActualizandoId(id);
    try {
      const detalle = await getTrabajoById(id);
      await Promise.all(detalle.items.filter((i) => !i.completado).map((i) => actualizarItemTrabajo(id, i.id, true)));
      await actualizarEstadoTrabajo(id, destino);
      setTrabajos((actuales) => actuales.map((item) => item.id === id ? { ...item, estado: destino } : item));
      mostrarNotificacion(`${numeroOrden(id)}: tareas tildadas y ${ESTADOS[destino].label.toLowerCase()}.`);
    } catch (error) {
      mostrarNotificacion(error instanceof Error ? error.message : "No se pudo completar el cambio.", true);
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
      mostrarNotificacion(`${numeroOrden(id)} enviada a la papelera.`);
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
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 shadow-sm transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15M4.125 19.5h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z" /></svg>
            Vista tablero
          </Link>
          {canManage && (
            <Link href="/trabajos/nuevo" className="inline-flex h-9 items-center rounded-xl bg-brand-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700">
              + Nueva orden
            </Link>
          )}
        </div>
      }
    >
      {notificacion.msg && (
        <div role="status" className={cn(
          "fixed bottom-6 right-6 z-[80] max-w-sm rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-2xl",
          notificacion.isError ? "bg-red-600" : "bg-slate-900 dark:bg-slate-700",
        )}>
          {notificacion.msg}
        </div>
      )}

      {tareasPendientes && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              {tareasPendientes.cantidad === null
                ? `La ${numeroOrden(tareasPendientes.id)} tiene tareas sin tildar`
                : `${tareasPendientes.cantidad === 1 ? "Queda 1 tarea" : `Quedan ${tareasPendientes.cantidad} tareas`} sin tildar en la ${numeroOrden(tareasPendientes.id)}`}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Para pasarla a &quot;{ESTADOS[tareasPendientes.destino].label}&quot; tienen que estar todas hechas. Si ya lo están, las tildamos de una.
            </p>
            <div className="mt-6 flex flex-col gap-2 sm:flex-row">
              <Link href={`/trabajos/${tareasPendientes.id}`} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-center text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700">
                Ver tareas
              </Link>
              <button onClick={() => setTareasPendientes(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700">
                Cancelar
              </button>
              <button onClick={() => void tildarYAvanzar()} className="flex-1 rounded-xl bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
                Tildar y avanzar
              </button>
            </div>
          </div>
        </div>
      )}

      {idABorrar !== null && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">¿Eliminar la {numeroOrden(idABorrar)}?</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
              Desaparece de la operación activa. Los movimientos de caja ya registrados se conservan.
            </p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setIdABorrar(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700">
                Cancelar
              </button>
              <button onClick={confirmarBorrado} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700">
                Eliminar orden
              </button>
            </div>
          </div>
        </div>
      )}

      {!loading && trabajos.length === 0 && !busqueda && (
        <div className="mb-4 flex flex-col gap-4 rounded-2xl border border-brand-200 bg-brand-50 p-5 dark:border-brand-900/50 dark:bg-brand-950/20 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-bold text-slate-900 dark:text-white">Tu operación empieza con una orden</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Elegí cliente, vehículo y tareas para comenzar el seguimiento.</p>
          </div>
          {canManage && <Link href="/trabajos/nuevo" className="rounded-xl bg-brand-600 px-4 py-2.5 text-center text-sm font-bold text-white">Crear primera orden</Link>}
        </div>
      )}

      {/* Franja de números: una sola tarjeta dividida, no cuatro sueltas. */}
      <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 xl:grid-cols-4">
        <Cifra label="Órdenes" value={String(trabajos.length)} helper={busqueda ? "Según la búsqueda" : "En el sistema"} />
        <Cifra label="En trabajo" value={String(conteos.EN_PROCESO)} helper="Autos en reparación" />
        <Cifra label="Listos para retirar" value={String(conteos.FINALIZADO)} helper="Esperando al cliente" />
        {showAmounts
          ? <Cifra label="En curso" value={formatCurrency(totalActivo)} helper="Órdenes sin cerrar" />
          : <Cifra label="Por revisar" value={String(conteos.INGRESADO)} helper="Ingresos nuevos" />}
      </div>

      {/* Búsqueda y filtros */}
      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={busqueda}
            onChange={(event) => setBusqueda(event.target.value)}
            placeholder="Buscar patente, cliente u orden…"
            aria-label="Buscar órdenes"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <div className="-mx-1 flex min-w-0 gap-1 overflow-x-auto px-1 pb-1 lg:pb-0" role="toolbar" aria-label="Filtrar por estado">
          {FILTROS.map((filtro) => {
            const active = filtro === estadoFiltro;
            const count = filtro === "TODOS" ? trabajos.length : conteos[filtro];
            return (
              <button
                key={filtro}
                onClick={() => setEstadoFiltro(filtro)}
                aria-pressed={active}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-xs font-semibold transition",
                  active
                    ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                    : "text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white",
                )}
              >
                {filtro === "TODOS" ? "Todas" : ESTADOS[filtro].label}
                <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", active ? "bg-white/20 dark:bg-slate-900/10" : "bg-slate-200/70 text-slate-600 dark:bg-slate-700 dark:text-slate-300")}>{count}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabla */}
      <section className="mt-3 overflow-visible rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className={cn(COLUMNAS, "hidden rounded-t-2xl border-b border-slate-100 bg-slate-50/80 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400 xl:grid")}>
          <span>Orden</span>
          <span>Vehículo</span>
          <span>Cliente</span>
          <span>Trabajo</span>
          <span className="text-right">{showAmounts ? "Importe" : ""}</span>
          <span>Estado</span>
          <span className="sr-only">Acciones</span>
        </div>

        {loading ? (
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {[1, 2, 3, 4].map((item) => <Skeleton key={item} />)}
          </div>
        ) : trabajosFiltrados.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="font-semibold text-slate-700 dark:text-slate-300">No hay órdenes en esta vista.</p>
            <p className="mt-1 text-sm text-slate-500">Probá con otro filtro o con otra búsqueda.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700/70">
            {trabajosFiltrados.map((trabajo) => (
              <FilaTrabajo
                key={trabajo.id}
                trabajo={trabajo}
                canManage={canManage}
                showAmounts={showAmounts}
                loading={actualizandoId === trabajo.id}
                menuAbierto={menu?.id === trabajo.id ? menu.tipo : null}
                onMenu={(tipo) => setMenu(tipo ? { id: trabajo.id, tipo } : null)}
                estadosPosibles={TRANSICIONES[trabajo.estado as Estado]?.filter((destino) => puedeEjecutarTransicion(trabajo.estado as Estado, destino)) ?? []}
                onEstado={cambiarEstado}
                onDelete={() => setIdABorrar(trabajo.id)}
              />
            ))}
          </ul>
        )}
        {!loading && trabajosFiltrados.length > 0 && (
          <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
            {trabajosFiltrados.length} {trabajosFiltrados.length === 1 ? "orden" : "órdenes"}
            {estadoFiltro !== "TODOS" && ` · ${ESTADOS[estadoFiltro].label}`}
          </p>
        )}
      </section>
    </AppShell>
  );
}

/** Columnas de la tabla (encabezado y filas usan las mismas). */
const COLUMNAS = "xl:grid-cols-[104px_minmax(170px,1.1fr)_minmax(140px,1fr)_minmax(160px,1.4fr)_110px_172px_180px] xl:items-center xl:gap-4";

function Cifra({ label, value, helper }: { label: string; value: string; helper: string }) {
  return (
    <div className="border-slate-100 px-5 py-4 [&:not(:first-child)]:border-l dark:border-slate-700 max-xl:[&:nth-child(3)]:border-l-0 max-xl:[&:nth-child(n+3)]:border-t">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 font-display text-3xl font-extrabold leading-none tabular-nums text-slate-900 dark:text-white">{value}</p>
      <p className="mt-1 text-[11px] text-slate-400">{helper}</p>
    </div>
  );
}

function FilaTrabajo({
  trabajo,
  canManage,
  showAmounts,
  loading,
  menuAbierto,
  onMenu,
  estadosPosibles,
  onEstado,
  onDelete,
}: {
  estadosPosibles: Estado[];
  trabajo: Trabajo;
  canManage: boolean;
  showAmounts: boolean;
  loading: boolean;
  menuAbierto: "estado" | "mas" | null;
  onMenu: (menu: "estado" | "mas" | null) => void;
  onEstado: (id: number, estado: Estado) => void;
  onDelete: () => void;
}) {
  const router = useRouter();
  const estado = trabajo.estado as Estado;
  const accion = ACCION_PRINCIPAL[estado];
  const canUsePrimary = Boolean(accion && (accion.estado !== "ENTREGADO" || canManage));
  const fecha = new Date(trabajo.fecha_ingreso);
  const href = `/trabajos/${trabajo.id}`;

  return (
    <li
      // Toda la fila abre la orden; los botones de la derecha frenan el clic.
      onClick={() => router.push(href)}
      className={cn(COLUMNAS, "group relative grid cursor-pointer grid-cols-[1fr_auto] gap-x-3 gap-y-2 px-5 py-3.5 transition hover:bg-slate-50 dark:hover:bg-slate-700/30", menuAbierto && "z-20")}
    >
      <div className="flex min-w-0 items-center gap-2 xl:block">
        <Link href={href} onClick={(e) => e.stopPropagation()} className="whitespace-nowrap font-mono text-xs font-semibold text-slate-900 hover:text-brand-600 dark:text-white">
          {numeroOrden(trabajo.id)}
        </Link>
        <p className="truncate text-[11px] text-slate-500 dark:text-slate-400 xl:mt-0.5">
          {fecha.toLocaleDateString("es-AR", { day: "numeric", month: "short" })} · {fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
        </p>
      </div>

      <div className="col-span-2 flex min-w-0 items-center gap-2.5 xl:col-span-1">
        <Patente valor={trabajo.patente} />
        <span className="truncate text-sm text-slate-600 dark:text-slate-300">{trabajo.vehiculo}</span>
      </div>

      <p className="hidden truncate text-sm font-medium text-slate-900 dark:text-white xl:block">{trabajo.cliente_nombre}</p>

      <p className="col-span-2 truncate text-sm text-slate-500 dark:text-slate-400 xl:col-span-1" title={trabajo.resumen || undefined}>
        <span className="font-medium text-slate-900 dark:text-white xl:hidden">{trabajo.cliente_nombre} · </span>
        {trabajo.resumen || "Sin diagnóstico cargado"}
      </p>

      <p className="hidden text-right font-display text-lg font-extrabold tabular-nums text-slate-900 dark:text-white xl:block">
        {showAmounts ? formatCurrency(trabajo.total) : ""}
      </p>

      <div className="row-start-1 col-start-2 justify-self-end xl:col-start-auto xl:row-start-auto xl:justify-self-start">
        <div onClick={(e) => e.stopPropagation()}>
          <SelectorEstado
            actual={estado}
            posibles={estadosPosibles}
            abierto={menuAbierto === "estado"}
            onAbrir={(abrir) => onMenu(abrir ? "estado" : null)}
            onElegir={(destino) => onEstado(trabajo.id, destino)}
          />
        </div>
      </div>

      <div className="col-span-2 flex items-center justify-end gap-1.5 xl:col-span-1" onClick={(e) => e.stopPropagation()}>
        {canUsePrimary && accion && (
          <button
            onClick={() => onEstado(trabajo.id, accion.estado)}
            disabled={loading}
            className="inline-flex h-8 items-center whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-800 transition hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-brand-950/40"
          >
            {loading ? "Guardando…" : `${accion.label} →`}
          </button>
        )}
        <MenuMas
          abierto={menuAbierto === "mas"}
          onAbrir={(abrir) => onMenu(abrir ? "mas" : null)}
          items={[
            { texto: "Abrir", href },
            ...(canManage
              ? [
                  { texto: "Editar", href: `/trabajos/nuevo?id=${trabajo.id}` },
                  ...(trabajo.total > 0 && estado !== "ANULADO" ? [{ texto: "Cobrar", href: `/pagos/registrar?cliente=${trabajo.cliente_id}` }] : []),
                  { texto: "Eliminar", onClick: onDelete, peligro: true },
                ]
              : []),
          ]}
        />
      </div>
    </li>
  );
}

/** El flujo del taller, en orden. */
const FLUJO: { estado: Estado; ayuda: string; loVeElCliente?: boolean }[] = [
  { estado: "INGRESADO", ayuda: "Esperando diagnóstico" },
  { estado: "EN_PROCESO", ayuda: "En reparación" },
  { estado: "FINALIZADO", ayuda: "Avisar al cliente", loVeElCliente: true },
  { estado: "ENTREGADO", ayuda: "Orden cerrada", loVeElCliente: true },
];

/**
 * Selector de estado: se abre tocando la etiqueta de la fila. Muestra el
 * flujo completo en orden, marca dónde está la orden y sólo deja tocar los
 * pasos permitidos. Volver atrás y anular piden un segundo toque.
 */
function SelectorEstado({
  actual,
  posibles,
  abierto,
  onAbrir,
  onElegir,
}: {
  actual: Estado;
  posibles: Estado[];
  abierto: boolean;
  onAbrir: (abrir: boolean) => void;
  onElegir: (estado: Estado) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [porConfirmar, setPorConfirmar] = useState<Estado | null>(null);
  useCerrarAfuera(ref, abierto, onAbrir);

  const indiceActual = FLUJO.findIndex((p) => p.estado === actual);
  const editable = posibles.length > 0;

  function tocar(destino: Estado, esRetroceso: boolean) {
    if ((esRetroceso || destino === "ANULADO") && porConfirmar !== destino) {
      setPorConfirmar(destino);
      return;
    }
    onAbrir(false);
    onElegir(destino);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => { if (!editable) return; setPorConfirmar(null); onAbrir(!abierto); }}
        aria-haspopup={editable ? "menu" : undefined}
        aria-expanded={editable ? abierto : undefined}
        aria-label={editable ? `Estado: ${ESTADOS[actual].label}. Cambiar estado` : `Estado: ${ESTADOS[actual].label}`}
        className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-full", editable ? "cursor-pointer" : "cursor-default")}
      >
        <StatusBadge status={actual} />
        {editable && (
          <svg className={cn("h-3.5 w-3.5 text-slate-400 transition-transform", abierto && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
        )}
      </button>

      {abierto && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1.5 w-64 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl motion-safe:animate-[aparecer_140ms_ease-out] dark:border-slate-700 dark:bg-slate-800 xl:left-0 xl:right-auto">
          <p className="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Cambiar estado</p>
          <ol className="relative">
            {FLUJO.map((paso, i) => {
              const esActual = paso.estado === actual;
              const permitido = posibles.includes(paso.estado);
              const esRetroceso = i < indiceActual;
              const confirmando = porConfirmar === paso.estado;
              return (
                <li key={paso.estado}>
                  <button
                    type="button"
                    role="menuitem"
                    disabled={!permitido}
                    onClick={() => tocar(paso.estado, esRetroceso)}
                    className={cn(
                      "flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left transition",
                      esActual && "bg-slate-100 dark:bg-slate-700/60",
                      permitido && !confirmando && "hover:bg-brand-50 dark:hover:bg-brand-950/30",
                      confirmando && "bg-amber-50 ring-1 ring-amber-300 dark:bg-amber-950/30 dark:ring-amber-800",
                      !permitido && !esActual && "opacity-40",
                    )}
                  >
                    {/* Línea del flujo con el punto de cada paso */}
                    <span className="relative mt-0.5 flex flex-col items-center">
                      <span className={cn("grid h-4 w-4 place-items-center rounded-full ring-2", esActual ? "bg-slate-900 ring-slate-900 dark:bg-white dark:ring-white" : i < indiceActual ? "bg-slate-300 ring-slate-300 dark:bg-slate-500 dark:ring-slate-500" : "bg-white ring-slate-300 dark:bg-slate-800 dark:ring-slate-500")}>
                        {i < indiceActual && <svg className="h-2.5 w-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center justify-between gap-2">
                        <span className={cn("text-sm font-semibold", esActual ? "text-slate-900 dark:text-white" : "text-slate-700 dark:text-slate-200")}>{ESTADOS[paso.estado].label}</span>
                        {esActual && <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">Actual</span>}
                        {permitido && esRetroceso && !confirmando && <span className="text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">Volver</span>}
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">
                        {confirmando ? `¿Volver a ${ESTADOS[paso.estado].label.toLowerCase()}? Tocá de nuevo` : paso.ayuda}
                      </span>
                      {paso.loVeElCliente && permitido && !esActual && (
                        <span className="mt-0.5 block text-[11px] font-medium text-emerald-700 dark:text-emerald-400">El cliente lo ve en su portal</span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
          {posibles.includes("ANULADO") && (
            <div className="mt-1 border-t border-slate-100 pt-1 dark:border-slate-700">
              <button
                type="button"
                role="menuitem"
                onClick={() => tocar("ANULADO", false)}
                className={cn("w-full rounded-xl px-2 py-2 text-left text-sm font-semibold transition", porConfirmar === "ANULADO" ? "bg-red-600 text-white" : "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30")}
              >
                {porConfirmar === "ANULADO" ? "¿Anular la orden? Tocá de nuevo" : "Anular orden"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/** Menú "Más": sólo acciones (abrir, editar, cobrar, eliminar). */
function MenuMas({
  abierto,
  onAbrir,
  items,
}: {
  abierto: boolean;
  onAbrir: (abrir: boolean) => void;
  items: { texto: string; href?: string; onClick?: () => void; peligro?: boolean }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  useCerrarAfuera(ref, abierto, onAbrir);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => onAbrir(!abierto)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        className={cn(
          "inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition",
          abierto ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white",
        )}
      >
        Más
        <svg className={cn("h-3.5 w-3.5 transition-transform", abierto && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
      </button>
      {abierto && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1.5 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl motion-safe:animate-[aparecer_140ms_ease-out] dark:border-slate-700 dark:bg-slate-800">
          {items.map((item) => {
            const clase = cn("block w-full px-3.5 py-2 text-left text-sm transition", item.peligro ? "border-t border-slate-100 text-red-600 hover:bg-red-50 dark:border-slate-700 dark:text-red-400 dark:hover:bg-red-950/30" : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/60");
            return item.href ? (
              <Link key={item.texto} href={item.href} role="menuitem" className={clase}>{item.texto}</Link>
            ) : (
              <button key={item.texto} type="button" role="menuitem" onClick={() => { onAbrir(false); item.onClick?.(); }} className={clase}>{item.texto}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/** Cierra un menú con Escape o con un clic fuera de `ref`. */
function useCerrarAfuera(ref: React.RefObject<HTMLDivElement | null>, abierto: boolean, onAbrir: (abrir: boolean) => void) {
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onAbrir(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") onAbrir(false); };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [ref, abierto, onAbrir]);
}

function Skeleton() {
  return (
    <div className="grid animate-pulse gap-4 px-5 py-5 xl:grid-cols-5">
      {[16, 28, 24, 36, 24].map((width, index) => (
        <div key={index} className="h-4 rounded bg-slate-100 dark:bg-slate-700" style={{ width: `${width * 4}px`, maxWidth: "100%" }} />
      ))}
    </div>
  );
}
