"use client";

import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
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
import { ESTADO_TRABAJO_LABEL, numeroOrden } from "@/lib/documentos";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { Patente } from "@/components/patente";

const REFRESH_INTERVAL_MS = 60_000;
/** En el modo pantalla (tele del taller) se actualiza más seguido. */
const REFRESH_PANTALLA_MS = 30_000;
type EstadoTrabajo = "INGRESADO" | "EN_PROCESO" | "FINALIZADO" | "ENTREGADO";
type UserRole = NonNullable<SessionData["rol"]>;

/**
 * Etapas del tablero. "Entregados" ya no es columna (casi siempre estaba
 * vacía y ocupaba un cuarto de la pantalla): se entrega con el botón de la
 * tarjeta y la orden pasa a la lista de Trabajos.
 */
const FLUJO: Array<{
  estado: EstadoTrabajo;
  titulo: string;
  corto: string;
  descripcion: string;
  enEtapa: string;
  siguiente?: EstadoTrabajo;
  accion?: string;
  punto: string;
}> = [
  { estado: "INGRESADO", titulo: ESTADO_TRABAJO_LABEL.INGRESADO, corto: "Ingreso", descripcion: "Confirmar diagnóstico y tareas", enEtapa: "esperando", siguiente: "EN_PROCESO", accion: "Iniciar trabajo", punto: "bg-sky-500 dark:bg-sky-600" },
  { estado: "EN_PROCESO", titulo: ESTADO_TRABAJO_LABEL.EN_PROCESO, corto: "Ejecución", descripcion: "Completar tareas y repuestos", enEtapa: "en trabajo", siguiente: "FINALIZADO", accion: "Marcar listo", punto: "bg-amber-500 dark:bg-amber-600" },
  { estado: "FINALIZADO", titulo: ESTADO_TRABAJO_LABEL.FINALIZADO, corto: "Control final", descripcion: "Avisar al cliente y entregar", enEtapa: "listo", siguiente: "ENTREGADO", accion: "Entregar", punto: "bg-emerald-500 dark:bg-emerald-600" },
];
const PASO_ENTREGADO = { estado: "ENTREGADO" as const, titulo: ESTADO_TRABAJO_LABEL.ENTREGADO, corto: "Cierre" };

/** Movimientos permitidos (los mismos que valida el backend). */
const TRANSICIONES: Record<EstadoTrabajo, EstadoTrabajo[]> = {
  INGRESADO: ["EN_PROCESO"],
  EN_PROCESO: ["INGRESADO", "FINALIZADO"],
  FINALIZADO: ["EN_PROCESO", "ENTREGADO"],
  ENTREGADO: [],
};
const ORDEN_ETAPA: Record<EstadoTrabajo, number> = { INGRESADO: 0, EN_PROCESO: 1, FINALIZADO: 2, ENTREGADO: 3 };

/** Días en la misma etapa a partir de los cuales una orden se marca demorada. */
const DIAS_DEMORA = 7;
const SIN_ASIGNAR = "sin-asignar";

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
  const [mecanico, setMecanico] = useState<string>("todos");
  const [arrastrando, setArrastrando] = useState<TrabajoKanban | null>(null);
  const [destinoHover, setDestinoHover] = useState<EstadoTrabajo | null>(null);
  const [retroceso, setRetroceso] = useState<{ trabajo: TrabajoKanban; destino: EstadoTrabajo } | null>(null);
  const [pantalla, setPantalla] = useState(false);
  const requestInFlight = useRef(false);

  const showAmounts = role === "ADMIN" || role === "RECEPCION";
  const canCreate = role === "ADMIN" || role === "RECEPCION";
  const canDeliver = role === "ADMIN" || role === "RECEPCION";

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
    try {
      const guardado = localStorage.getItem("tablero-mecanico");
      if (guardado) setMecanico(guardado);
    } catch { /* sin almacenamiento */ }
    cargarTablero(false);
  }, [cargarTablero]);

  useEffect(() => {
    const interval = setInterval(() => cargarTablero(true), pantalla ? REFRESH_PANTALLA_MS : REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [cargarTablero, pantalla]);

  useEffect(() => {
    if (!feedback) return;
    const timeout = setTimeout(() => setFeedback(null), 3500);
    return () => clearTimeout(timeout);
  }, [feedback]);

  // Modo pantalla: Escape sale; si el navegador sale de pantalla completa, también.
  useEffect(() => {
    if (!pantalla) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") salirDePantalla(); };
    const cambio = () => { if (!document.fullscreenElement) setPantalla(false); };
    document.addEventListener("keydown", tecla);
    document.addEventListener("fullscreenchange", cambio);
    return () => {
      document.removeEventListener("keydown", tecla);
      document.removeEventListener("fullscreenchange", cambio);
    };
  }, [pantalla]);

  function entrarEnPantalla() {
    setPantalla(true);
    document.documentElement.requestFullscreen?.().catch(() => { /* sin pantalla completa: queda el modo igual */ });
  }
  function salirDePantalla() {
    setPantalla(false);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }

  function elegirMecanico(valor: string) {
    setMecanico(valor);
    try { localStorage.setItem("tablero-mecanico", valor); } catch { /* sin almacenamiento */ }
  }

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

  /** Cambia el estado validando el flujo y el checklist (igual que el backend). */
  async function moverA(trabajo: TrabajoKanban | TrabajoDetalle, destino: EstadoTrabajo) {
    const actual = trabajo.estado as EstadoTrabajo;
    if (!TRANSICIONES[actual]?.includes(destino)) {
      setFeedback({ message: "Ese movimiento saltea pasos: avanzá de a una etapa.", error: true });
      return;
    }
    if (destino === "ENTREGADO" && !canDeliver) {
      setFeedback({ message: "Sólo administración o recepción registran la entrega.", error: true });
      return;
    }
    const pendientes = "items" in trabajo ? trabajo.items.filter((item) => !item.completado).length : 0;
    if ((destino === "FINALIZADO" || destino === "ENTREGADO") && pendientes > 0) {
      setFeedback({ message: `Faltan ${pendientes} ${pendientes === 1 ? "tarea" : "tareas"} por completar.`, error: true });
      return;
    }

    setAccionando(true);
    try {
      await actualizarEstadoTrabajo(trabajo.id, destino);
      const nombre = destino === "ENTREGADO" ? PASO_ENTREGADO.titulo : FLUJO.find((p) => p.estado === destino)?.titulo;
      setFeedback({ message: `${numeroOrden(trabajo.id)}: ${nombre}.`, error: false });
      if (seleccionado?.id === trabajo.id) setSeleccionado({ ...seleccionado, estado: destino });
      await cargarTablero(true);
    } catch (error) {
      setFeedback({ message: error instanceof Error ? error.message : "No se pudo mover la orden.", error: true });
    } finally {
      setAccionando(false);
    }
  }

  function avanzarTrabajo(trabajo: TrabajoKanban | TrabajoDetalle) {
    const paso = FLUJO.find((item) => item.estado === trabajo.estado);
    if (paso?.siguiente) moverA(trabajo, paso.siguiente);
  }

  /** Volver una etapa atrás pide confirmación (con un solo toque se perdía trabajo). */
  function pedirMovimiento(trabajo: TrabajoKanban, destino: EstadoTrabajo) {
    if (destino === trabajo.estado) return;
    if (ORDEN_ETAPA[destino] < ORDEN_ETAPA[trabajo.estado as EstadoTrabajo]) {
      if (TRANSICIONES[trabajo.estado as EstadoTrabajo]?.includes(destino)) setRetroceso({ trabajo, destino });
      else setFeedback({ message: "Sólo se puede volver una etapa por vez.", error: true });
      return;
    }
    moverA(trabajo, destino);
  }

  async function toggleItemDesdeTarjeta(trabajo: TrabajoKanban, itemId: number, completado: boolean) {
    // Actualización optimista: la tarjeta responde al instante.
    setTablero((actual) => actual && marcarItem(actual, trabajo.id, itemId, completado));
    try {
      await actualizarItemTrabajo(trabajo.id, itemId, completado);
    } catch (error) {
      setTablero((actual) => actual && marcarItem(actual, trabajo.id, itemId, !completado));
      setFeedback({ message: error instanceof Error ? error.message : "No se pudo actualizar la tarea.", error: true });
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

  // Mecánicos presentes en el tablero (los que tienen órdenes a cargo).
  const todas = tablero ? FLUJO.flatMap((paso) => tablero[paso.estado].trabajos) : [];
  const mecanicos = Array.from(
    new Map(todas.filter((t) => t.responsable_id).map((t) => [String(t.responsable_id), t.responsable_nombre])).entries(),
  ).sort((a, b) => a[1].localeCompare(b[1]));
  const haySinAsignar = todas.some((t) => !t.responsable_id);
  const filtroValido = mecanico === "todos" || mecanico === SIN_ASIGNAR || mecanicos.some(([id]) => id === mecanico) ? mecanico : "todos";
  const visible = (t: TrabajoKanban) =>
    filtroValido === "todos" || (filtroValido === SIN_ASIGNAR ? !t.responsable_id : String(t.responsable_id) === filtroValido);

  if (loading) {
    return (
      <AppShell compact currentPath="/trabajos/tablero" title="Tablero del taller" description="Cada auto en su etapa. Arrastrá las tarjetas para moverlas.">
        <div className="flex h-[60vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
        </div>
      </AppShell>
    );
  }

  if (!tablero) return null;

  const columnas = (
    <div className={cn("grid items-start gap-4 md:grid-cols-3", pantalla && "gap-5")}>
      {FLUJO.map((paso) => {
        const permitido = arrastrando ? TRANSICIONES[arrastrando.estado as EstadoTrabajo]?.includes(paso.estado) : false;
        return (
          <ColumnaKanban
            key={paso.estado}
            paso={paso}
            trabajos={tablero[paso.estado].trabajos.filter(visible)}
            totalPlata={tablero[paso.estado].total_plata}
            showAmounts={showAmounts && !pantalla}
            pantalla={pantalla}
            arrastrando={arrastrando}
            permitido={permitido}
            hover={destinoHover === paso.estado}
            onDragOverColumna={(over) => setDestinoHover(over ? paso.estado : null)}
            onSoltar={() => {
              if (arrastrando && permitido) pedirMovimiento(arrastrando, paso.estado);
              setArrastrando(null);
              setDestinoHover(null);
            }}
            onDragStart={setArrastrando}
            onDragEnd={() => { setArrastrando(null); setDestinoHover(null); }}
            onOpen={abrirDetalle}
            onAdvance={avanzarTrabajo}
            onToggleItem={toggleItemDesdeTarjeta}
            canDeliver={canDeliver}
            actionLoading={accionando}
          />
        );
      })}
    </div>
  );

  const filtroMecanicos = (mecanicos.length > 0 || haySinAsignar) && (
    <div className="flex flex-wrap items-center gap-1.5" role="toolbar" aria-label="Filtrar por mecánico">
      <span className={cn("mr-1 text-xs font-medium", pantalla ? "text-slate-400" : "text-slate-500 dark:text-slate-400")}>Mecánico</span>
      {[["todos", "Todos"] as const, ...mecanicos, ...(haySinAsignar ? [[SIN_ASIGNAR, "Sin asignar"] as const] : [])].map(([valor, nombre]) => {
        const activo = filtroValido === valor;
        return (
          <button
            key={valor}
            type="button"
            onClick={() => elegirMecanico(valor)}
            aria-pressed={activo}
            className={cn(
              "inline-flex h-8 items-center gap-2 rounded-full pl-1 pr-3 text-xs font-semibold transition",
              valor === "todos" || valor === SIN_ASIGNAR ? "pl-3" : "",
              activo
                ? pantalla ? "bg-white text-slate-900" : "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : pantalla ? "text-slate-300 hover:bg-white/10" : "text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-slate-800",
            )}
          >
            {valor !== "todos" && valor !== SIN_ASIGNAR && (
              <span className={cn("grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold", activo ? "bg-brand-600 text-white" : "bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200")}>
                {iniciales(nombre)}
              </span>
            )}
            {valor === "todos" || valor === SIN_ASIGNAR ? nombre : nombre.split(" ")[0]}
          </button>
        );
      })}
    </div>
  );

  const avisos = (
    <>
      {feedback && (
        <div role="status" className={cn(
          "fixed bottom-6 right-6 z-[90] max-w-sm rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-2xl",
          feedback.error ? "bg-red-600" : "bg-slate-900 dark:bg-slate-700",
        )}>
          {feedback.message}
        </div>
      )}
      {retroceso && (
        <div className="fixed inset-0 z-[85] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              ¿Volver {retroceso.trabajo.patente} a {FLUJO.find((p) => p.estado === retroceso.destino)?.titulo.toLowerCase()}?
            </h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">La orden retrocede una etapa. Las tareas tildadas se conservan.</p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setRetroceso(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700">
                Cancelar
              </button>
              <button
                onClick={() => { const r = retroceso; setRetroceso(null); moverA(r.trabajo, r.destino); }}
                className="flex-1 rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
              >
                Sí, volver
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );

  // ── Modo pantalla del taller: oscuro, sin menú, letra grande ──
  if (pantalla) {
    return (
      <div className="fixed inset-0 z-[60] overflow-y-auto bg-slate-950 p-6 text-white">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="font-display text-4xl font-extrabold uppercase leading-none">Tablero del taller</h1>
            <p className="mt-1 text-sm text-slate-400">
              Se actualiza solo cada 30 segundos · Última: {ultimaActualizacion?.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) ?? "—"}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Reloj />
            <button onClick={salirDePantalla} className="rounded-xl border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10">
              Salir (Esc)
            </button>
          </div>
        </header>
        {filtroMecanicos && <div className="mb-5">{filtroMecanicos}</div>}
        {columnas}
        {avisos}
      </div>
    );
  }

  return (
    <AppShell
      compact
      currentPath="/trabajos/tablero"
      title="Tablero del taller"
      description="Cada auto en su etapa. Arrastrá las tarjetas para moverlas."
      actions={
        <div className="flex items-center gap-2">
          <p className="hidden text-xs text-slate-500 dark:text-slate-400 xl:block" title="Se actualiza solo cada 60 segundos">
            {ultimaActualizacion
              ? `Actualizado ${ultimaActualizacion.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}`
              : "Sincronizando…"}
          </p>
          <button
            onClick={() => cargarTablero(true)}
            disabled={refreshing}
            title="Actualizar ahora"
            aria-label="Actualizar ahora"
            className="flex h-9 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-900 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 sm:w-9 sm:px-0"
          >
            <svg className={cn("h-4 w-4", refreshing && "animate-spin")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8 8 0 004.582 9M20 20v-5h-.581m0 0A8 8 0 014.062 13" />
            </svg>
            {/* En el celular el botón va a lo ancho: con el ícono solo quedaba un rectángulo vacío. */}
            <span className="sm:hidden">Actualizar</span>
          </button>
          <button
            onClick={entrarEnPantalla}
            className="hidden h-9 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 sm:inline-flex"
            title="Pantalla completa para la tele del taller"
          >
            <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" /></svg>
            Modo pantalla
          </button>
          <Link href="/trabajos" className="hidden h-9 items-center rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 sm:inline-flex">
            Ver lista
          </Link>
          {canCreate && (
            <Link href="/trabajos/nuevo" className="inline-flex h-9 items-center rounded-xl bg-brand-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700">
              + Nuevo ingreso
            </Link>
          )}
        </div>
      }
    >
      {filtroMecanicos && <div className="mb-4">{filtroMecanicos}</div>}
      {columnas}
      {avisos}

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

function marcarItem(tablero: TableroData, trabajoId: number, itemId: number, completado: boolean): TableroData {
  const copia = { ...tablero };
  for (const paso of FLUJO) {
    copia[paso.estado] = {
      ...copia[paso.estado],
      trabajos: copia[paso.estado].trabajos.map((t) => {
        if (t.id !== trabajoId) return t;
        const items = t.items.map((i) => (i.id === itemId ? { ...i, completado } : i));
        return { ...t, items, items_completados: items.filter((i) => i.completado).length };
      }),
    };
  }
  return copia;
}

function iniciales(nombre: string): string {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "?";
}

function Reloj() {
  const [ahora, setAhora] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setAhora(new Date());
    const primero = setTimeout(tick, 0);
    const id = setInterval(tick, 15_000);
    return () => { clearTimeout(primero); clearInterval(id); };
  }, []);
  if (!ahora) return null;
  return (
    <p className="font-display text-4xl font-extrabold tabular-nums leading-none">
      {ahora.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
    </p>
  );
}

function ColumnaKanban({
  paso,
  trabajos,
  totalPlata,
  showAmounts,
  pantalla,
  arrastrando,
  permitido,
  hover,
  onDragOverColumna,
  onSoltar,
  onDragStart,
  onDragEnd,
  onOpen,
  onAdvance,
  onToggleItem,
  canDeliver,
  actionLoading,
}: {
  paso: (typeof FLUJO)[number];
  trabajos: TrabajoKanban[];
  totalPlata: number;
  showAmounts: boolean;
  pantalla: boolean;
  arrastrando: TrabajoKanban | null;
  permitido: boolean;
  hover: boolean;
  onDragOverColumna: (over: boolean) => void;
  onSoltar: () => void;
  onDragStart: (trabajo: TrabajoKanban) => void;
  onDragEnd: () => void;
  onOpen: (id: number) => void;
  onAdvance: (trabajo: TrabajoKanban) => void;
  onToggleItem: (trabajo: TrabajoKanban, itemId: number, completado: boolean) => void;
  canDeliver: boolean;
  actionLoading: boolean;
}) {
  const esOrigen = arrastrando?.estado === paso.estado;
  return (
    <section
      aria-label={paso.titulo}
      onDragOver={(e: DragEvent) => { if (permitido) { e.preventDefault(); onDragOverColumna(true); } }}
      onDragLeave={() => onDragOverColumna(false)}
      onDrop={(e: DragEvent) => { e.preventDefault(); onSoltar(); }}
      className={cn(
        "min-w-0 rounded-2xl p-2 transition-colors",
        pantalla ? "bg-white/5" : "bg-slate-100/70 dark:bg-slate-900/50",
        arrastrando && !esOrigen && (permitido ? "ring-2 ring-dashed ring-brand-300 dark:ring-brand-800" : "opacity-50"),
        hover && "bg-brand-50 ring-brand-500 dark:bg-brand-950/30",
      )}
    >
      <header className="flex items-start justify-between gap-3 px-2 pb-3 pt-2">
        <div className="min-w-0">
          <h2 className={cn("flex items-center gap-2 font-semibold", pantalla ? "text-xl text-white" : "text-sm text-slate-900 dark:text-white")}>
            <span className={cn("shrink-0 rounded-full", pantalla ? "h-3 w-3" : "h-2.5 w-2.5", paso.punto)} aria-hidden="true" />
            {paso.titulo}
            <span className={cn("rounded-md px-1.5 font-semibold", pantalla ? "bg-white/10 text-base text-white" : "bg-white text-xs text-slate-600 ring-1 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700")}>
              {trabajos.length}
            </span>
          </h2>
          {!pantalla && <p className="mt-0.5 pl-[18px] text-xs text-slate-500 dark:text-slate-400">{paso.descripcion}</p>}
        </div>
        {showAmounts && totalPlata > 0 && (
          <p className="shrink-0 pt-0.5 text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400" title="Suma de las órdenes de esta etapa">
            {formatCurrency(totalPlata)}
          </p>
        )}
      </header>

      <div className="flex flex-col gap-2">
        {trabajos.length > 0 ? (
          trabajos.map((trabajo) => (
            <TarjetaTrabajo
              key={trabajo.id}
              trabajo={trabajo}
              paso={paso}
              showAmounts={showAmounts}
              pantalla={pantalla}
              arrastrandoEsta={arrastrando?.id === trabajo.id}
              onDragStart={() => onDragStart(trabajo)}
              onDragEnd={onDragEnd}
              onOpen={() => onOpen(trabajo.id)}
              onAdvance={() => onAdvance(trabajo)}
              onToggleItem={(itemId, completado) => onToggleItem(trabajo, itemId, completado)}
              canDeliver={canDeliver}
              actionLoading={actionLoading}
            />
          ))
        ) : (
          <p className={cn("rounded-xl border border-dashed px-4 py-8 text-center text-xs", pantalla ? "border-white/15 text-slate-400" : "border-slate-300 text-slate-500 dark:border-slate-700 dark:text-slate-400")}>
            {hover ? "Soltá acá" : "Ningún auto en esta etapa."}
          </p>
        )}
      </div>
    </section>
  );
}

function TarjetaTrabajo({
  trabajo,
  paso,
  showAmounts,
  pantalla,
  arrastrandoEsta,
  onDragStart,
  onDragEnd,
  onOpen,
  onAdvance,
  onToggleItem,
  canDeliver,
  actionLoading,
}: {
  trabajo: TrabajoKanban;
  paso: (typeof FLUJO)[number];
  showAmounts: boolean;
  pantalla: boolean;
  arrastrandoEsta: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onOpen: () => void;
  onAdvance: () => void;
  onToggleItem: (itemId: number, completado: boolean) => void;
  canDeliver: boolean;
  actionLoading: boolean;
}) {
  const [verTareas, setVerTareas] = useState(false);
  const dias = trabajo.dias_en_etapa ?? trabajo.dias_en_taller;
  const demorado = dias >= DIAS_DEMORA;
  const pendientes = Math.max(0, trabajo.items_total - trabajo.items_completados);
  const checklistPendiente = ["EN_PROCESO", "FINALIZADO"].includes(trabajo.estado) && pendientes > 0;
  const progreso = trabajo.items_total > 0 ? (trabajo.items_completados / trabajo.items_total) * 100 : 0;
  const listo = trabajo.estado === "FINALIZADO";
  const waHref = listo
    ? buildWhatsAppUrl(`Hola ${trabajo.cliente_nombre.split(" ")[0]}, tu ${trabajo.vehiculo} (${trabajo.patente}) ya está listo para retirar.`, trabajo.cliente_telefono)
    : "";
  const puedeAccion = paso.accion && (paso.siguiente !== "ENTREGADO" || canDeliver);

  return (
    <article
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", String(trabajo.id)); onDragStart(); }}
      onDragEnd={onDragEnd}
      className={cn(
        "cursor-grab rounded-xl border shadow-sm transition active:cursor-grabbing",
        pantalla ? "border-white/10 bg-slate-900 hover:border-white/25" : "border-slate-200 bg-white hover:border-slate-300 hover:shadow dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600",
        arrastrandoEsta && "rotate-1 opacity-50",
      )}
    >
      <button type="button" onClick={onOpen} className={cn("block w-full text-left", pantalla ? "p-4" : "p-3")}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <Patente valor={trabajo.patente} className={pantalla ? "text-lg" : undefined} />
            <p className={cn("mt-1.5 truncate font-semibold", pantalla ? "text-lg text-white" : "text-sm text-slate-800 dark:text-slate-100")}>{trabajo.vehiculo}</p>
            <p className={cn("truncate", pantalla ? "text-sm text-slate-400" : "text-xs text-slate-500 dark:text-slate-400")}>{trabajo.cliente_nombre}</p>
          </div>
          <div className="shrink-0 text-right">
            <p className={cn("font-mono text-[11px]", pantalla ? "text-slate-500" : "text-slate-400")}>{numeroOrden(trabajo.id)}</p>
            {showAmounts && <p className="mt-1 font-display text-lg font-extrabold tabular-nums text-slate-900 dark:text-white">{formatCurrency(trabajo.total)}</p>}
          </div>
        </div>

        {trabajo.resumen_corto && (
          <p className={cn("mt-2 line-clamp-2 leading-relaxed", pantalla ? "text-sm text-slate-300" : "text-xs text-slate-600 dark:text-slate-300")}>{trabajo.resumen_corto}</p>
        )}
      </button>

      <div className={cn("flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs", pantalla ? "px-4 pb-3 text-slate-400" : "px-3 pb-3 text-slate-500 dark:text-slate-400")}>
        <span className={cn("inline-flex items-center gap-1", demorado && "font-semibold text-amber-600 dark:text-amber-400")} title={demorado ? `Más de ${DIAS_DEMORA} días en esta etapa` : `${trabajo.dias_en_taller} días desde el ingreso`}>
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          {dias === 0 ? `Hoy ${paso.enEtapa}` : `${dias} ${dias === 1 ? "día" : "días"} ${paso.enEtapa}`}
        </span>
        {trabajo.items_total > 0 && (
          <button
            type="button"
            onClick={() => setVerTareas((v) => !v)}
            aria-expanded={verTareas}
            className="inline-flex items-center gap-1.5 rounded-md px-1 py-0.5 transition hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <span className="h-1.5 w-12 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              <span className="block h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${progreso}%` }} />
            </span>
            {trabajo.items_completados}/{trabajo.items_total} tareas
            <svg className={cn("h-3 w-3 transition-transform", verTareas && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
          </button>
        )}
        {trabajo.responsable_nombre && (
          <span className="inline-flex items-center gap-1.5">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-slate-200 text-[9px] font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">{iniciales(trabajo.responsable_nombre)}</span>
            {trabajo.responsable_nombre.split(" ")[0]}
          </span>
        )}
      </div>

      {/* Checklist tildable desde la tarjeta */}
      {verTareas && trabajo.items.length > 0 && (
        <ul className={cn("mx-3 mb-3 space-y-1 rounded-lg p-2", pantalla ? "bg-white/5" : "bg-slate-50 dark:bg-slate-900/50")}>
          {trabajo.items.map((item) => (
            <li key={item.id}>
              <label className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-xs">
                <input
                  type="checkbox"
                  checked={item.completado}
                  onChange={(e) => onToggleItem(item.id, e.target.checked)}
                  className="mt-0.5 h-3.5 w-3.5 rounded border-slate-300 accent-emerald-600"
                />
                <span className={cn(pantalla ? "text-slate-200" : "text-slate-700 dark:text-slate-200", item.completado && "line-through opacity-60")}>{item.descripcion}</span>
              </label>
            </li>
          ))}
        </ul>
      )}

      {(puedeAccion || (listo && !pantalla)) && (
        <div className={cn("flex items-center justify-end gap-1.5 border-t px-3 py-2", pantalla ? "border-white/10" : "border-slate-100 dark:border-slate-700/70")}>
          {listo && !pantalla && (
            waHref ? (
              <a href={waHref} target="_blank" rel="noreferrer" className="mr-auto rounded-lg bg-[#25D366] px-2.5 py-1.5 text-xs font-bold text-white transition hover:bg-[#1ebe5d]">
                Avisar por WhatsApp
              </a>
            ) : (
              <span className="mr-auto text-[11px] text-slate-400" title="Cargá un celular válido en la ficha del cliente">Sin celular</span>
            )
          )}
          {listo && showAmounts && (
            <Link href={`/pagos/registrar?cliente=${trabajo.cliente_id}`} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">
              Cobrar
            </Link>
          )}
          {puedeAccion && (checklistPendiente ? (
            <button type="button" onClick={() => setVerTareas(true)} className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/30">
              {pendientes === 1 ? "Falta 1 tarea" : `Faltan ${pendientes} tareas`}
            </button>
          ) : (
            <button
              type="button"
              onClick={onAdvance}
              disabled={actionLoading}
              className={cn(
                "rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition disabled:opacity-50",
                pantalla ? "border-white/20 text-white hover:bg-white/10" : "border-slate-200 text-slate-700 hover:border-brand-500 hover:bg-brand-50 hover:text-brand-700 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-brand-950/40",
              )}
            >
              {paso.accion} →
            </button>
          ))}
        </div>
      )}
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
  const pasosPanel = [...FLUJO, PASO_ENTREGADO];
  const completados = trabajo.items.filter((item) => item.completado).length;
  const progreso = trabajo.items.length > 0 ? Math.round((completados / trabajo.items.length) * 100) : 0;
  const requiereChecklist = ["EN_PROCESO", "FINALIZADO"].includes(trabajo.estado);
  const puedeAvanzar = !requiereChecklist || completados === trabajo.items.length;

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur dark:border-slate-700 dark:bg-slate-900/95">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-brand-500">{numeroOrden(trabajo.id)} · {paso?.titulo ?? PASO_ENTREGADO.titulo}</p>
            <h2 className="mt-1 font-mono text-2xl font-black text-slate-900 dark:text-white">{trabajo.vehiculo.patente}</h2>
            <p className="text-xs text-slate-500">{trabajo.vehiculo.marca} {trabajo.vehiculo.modelo} · {trabajo.cliente.nombre_completo}</p>
          </div>
          <button onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">×</button>
        </div>
      </header>

      <div className="space-y-5 p-5">
        <div className="grid grid-cols-4 gap-1.5">
          {pasosPanel.map((item, index) => {
            const actual = pasosPanel.findIndex((flow) => flow.estado === trabajo.estado);
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
