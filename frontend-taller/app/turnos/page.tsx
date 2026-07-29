"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { actualizarEstadoTurno, eliminarTurno, getTurnos } from "@/lib/api";
import type { Turno } from "@/lib/types";
import { cn } from "@/lib/utils";

const ESTADOS_TURNO = [
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "CONFIRMADO", label: "Confirmado" },
  { value: "CUMPLIDO", label: "Cumplido" },
  { value: "CANCELADO", label: "Cancelado" },
];

const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const estadoClasses: Record<string, string> = {
  PENDIENTE: "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-300",
  CONFIRMADO: "bg-sky-50 text-sky-700 dark:bg-sky-950/30 dark:text-sky-300",
  CUMPLIDO: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300",
  CANCELADO: "bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-300",
};

function inicioDelDia(fecha = new Date()) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

function agruparTurnos(turnos: Turno[]) {
  return turnos.reduce((grupos, turno) => {
    const fecha = new Date(turno.fecha_hora);
    const clave = `${fecha.getFullYear()}-${fecha.getMonth()}-${fecha.getDate()}`;
    if (!grupos[clave]) grupos[clave] = [];
    grupos[clave].push(turno);
    return grupos;
  }, {} as Record<string, Turno[]>);
}

function MiniCalendario({ turnos, onDiaClick, diaSeleccionado }: { turnos: Turno[]; onDiaClick: (fecha: Date) => void; diaSeleccionado: Date | null }) {
  const [mesActual, setMesActual] = useState(() => {
    const fecha = new Date();
    return new Date(fecha.getFullYear(), fecha.getMonth(), 1);
  });
  const year = mesActual.getFullYear();
  const month = mesActual.getMonth();
  const primerDia = new Date(year, month, 1).getDay();
  const diasEnMes = new Date(year, month + 1, 0).getDate();
  const turnosPorDia: Record<string, number> = {};

  for (const turno of turnos) {
    const fecha = new Date(turno.fecha_hora);
    if (fecha.getFullYear() === year && fecha.getMonth() === month) {
      turnosPorDia[fecha.getDate()] = (turnosPorDia[fecha.getDate()] ?? 0) + 1;
    }
  }

  const celdas: (number | null)[] = [
    ...Array.from({ length: primerDia }, () => null),
    ...Array.from({ length: diasEnMes }, (_, index) => index + 1),
  ];
  const hoy = new Date();

  return (
    <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-slate-900">
      <div className="mb-3 flex items-center justify-between">
        <button type="button" onClick={() => setMesActual(new Date(year, month - 1, 1))} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Mes anterior">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <strong className="text-sm text-slate-900 dark:text-white">{MESES[month]} {year}</strong>
        <button type="button" onClick={() => setMesActual(new Date(year, month + 1, 1))} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Mes siguiente">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1">
        {DIAS_SEMANA.map((dia) => <div key={dia} className="py-1 text-center text-[9px] font-black uppercase tracking-wider text-slate-400">{dia}</div>)}
        {celdas.map((dia, index) => {
          if (dia === null) return <div key={`empty-${index}`} />;
          const fecha = new Date(year, month, dia);
          const seleccionado = diaSeleccionado?.toDateString() === fecha.toDateString();
          const esHoy = hoy.toDateString() === fecha.toDateString();
          const cantidad = turnosPorDia[dia] ?? 0;
          return (
            <button
              type="button"
              key={dia}
              onClick={() => onDiaClick(fecha)}
              className={cn(
                "relative flex h-9 items-center justify-center rounded-lg text-xs font-bold transition",
                seleccionado
                  ? "bg-brand-500 text-white shadow-sm"
                  : esHoy
                    ? "bg-brand-50 text-brand-700 dark:bg-brand-950/30 dark:text-brand-300"
                    : "text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              )}
            >
              {dia}
              {cantidad > 0 && <span className={cn("absolute bottom-1 h-1 w-1 rounded-full", seleccionado ? "bg-white" : "bg-brand-500")} />}
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function AgendaTurnos() {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [notificacion, setNotificacion] = useState({ msg: "", isError: false });
  const [idABorrar, setIdABorrar] = useState<number | null>(null);
  const [vista, setVista] = useState<"lista" | "calendario">("lista");
  const [diaSeleccionado, setDiaSeleccionado] = useState<Date | null>(null);

  const mostrarNotificacion = useCallback((msg: string, isError = false) => {
    setNotificacion({ msg, isError });
    window.setTimeout(() => setNotificacion({ msg: "", isError: false }), 3000);
  }, []);

  const cargar = useCallback(async (query?: string) => {
    try {
      setLoading(true);
      setTurnos(await getTurnos(query));
    } catch {
      mostrarNotificacion("No pudimos cargar la agenda.", true);
    } finally {
      setLoading(false);
    }
  }, [mostrarNotificacion]);

  useEffect(() => {
    const timer = window.setTimeout(() => cargar(busqueda), 300);
    return () => window.clearTimeout(timer);
  }, [busqueda, cargar]);

  async function cambiarEstado(id: number, nuevoEstado: string) {
    const respaldo = [...turnos];
    setTurnos((actuales) => actuales.map((turno) => turno.id === id ? { ...turno, estado: nuevoEstado } : turno));
    try {
      await actualizarEstadoTurno(id, nuevoEstado);
      mostrarNotificacion("Estado actualizado.");
    } catch {
      setTurnos(respaldo);
      mostrarNotificacion("No pudimos actualizar el estado.", true);
    }
  }

  async function confirmarBorrado() {
    if (!idABorrar) return;
    const respaldo = [...turnos];
    setTurnos((actuales) => actuales.filter((turno) => turno.id !== idABorrar));
    try {
      await eliminarTurno(idABorrar);
      mostrarNotificacion("Turno eliminado.");
    } catch {
      setTurnos(respaldo);
      mostrarNotificacion("No pudimos eliminar el turno.", true);
    } finally {
      setIdABorrar(null);
    }
  }

  const hoy = inicioDelDia();
  const turnosHoy = turnos.filter((turno) => inicioDelDia(new Date(turno.fecha_hora)).getTime() === hoy.getTime() && turno.estado !== "CANCELADO").length;
  const proximos = turnos.filter((turno) => new Date(turno.fecha_hora) >= hoy && !["CANCELADO", "CUMPLIDO"].includes(turno.estado)).length;
  const confirmados = turnos.filter((turno) => turno.estado === "CONFIRMADO" && new Date(turno.fecha_hora) >= hoy).length;

  const turnosDelDia = useMemo(
    () => diaSeleccionado ? turnos.filter((turno) => new Date(turno.fecha_hora).toDateString() === diaSeleccionado.toDateString()) : [],
    [diaSeleccionado, turnos]
  );

  return (
    <AppShell
      currentPath="/turnos"
      badge="Organización"
      title="Agenda de turnos"
      description="Reservas, confirmaciones y próximos ingresos del taller."
      actions={<Link href="/turnos/nuevo" className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 dark:bg-brand-600 dark:hover:bg-brand-500">+ Nuevo turno</Link>}
    >
      <div className="space-y-4">
        {notificacion.msg && <div className={cn("fixed bottom-6 right-6 z-50 rounded-xl px-5 py-3 text-sm font-bold text-white shadow-2xl", notificacion.isError ? "bg-red-600" : "bg-slate-900")}>{notificacion.msg}</div>}

        {idABorrar !== null && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-50 text-red-600 dark:bg-red-950/30 dark:text-red-300">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </div>
              <h2 className="mt-4 text-lg font-black text-slate-900 dark:text-white">Eliminar turno</h2>
              <p className="mt-1 text-sm text-slate-500">La cita desaparecerá de la agenda de forma permanente.</p>
              <div className="mt-6 grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setIdABorrar(null)} className="rounded-xl bg-slate-100 py-2.5 text-sm font-bold text-slate-700 dark:bg-slate-800 dark:text-slate-200">Cancelar</button>
                <button type="button" onClick={confirmarBorrado} className="rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white">Eliminar</button>
              </div>
            </div>
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Turnos de hoy" value={turnosHoy} helper={turnosHoy === 1 ? "ingreso previsto" : "ingresos previstos"} />
          <Metric label="Próximos" value={proximos} helper="pendientes o confirmados" />
          <Metric label="Confirmados" value={confirmados} helper="con asistencia prevista" />
        </div>

        <div className="flex flex-col gap-3 rounded-2xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg></span>
            <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar cliente, patente o motivo…" className="h-11 w-full rounded-xl bg-slate-50 pl-10 pr-4 text-sm text-slate-900 outline-none ring-1 ring-slate-200 transition focus:ring-2 focus:ring-brand-400 dark:bg-slate-950 dark:text-white dark:ring-slate-800" />
          </div>
          <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-950">
            <ViewButton active={vista === "lista"} onClick={() => { setVista("lista"); setDiaSeleccionado(null); }} label="Lista" icon="list" />
            <ViewButton active={vista === "calendario"} onClick={() => setVista("calendario")} label="Calendario" icon="calendar" />
          </div>
        </div>

        {vista === "lista" ? (
          <AgendaGroups turnos={turnos} loading={loading} onEstado={cambiarEstado} onBorrar={setIdABorrar} />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
            <MiniCalendario turnos={turnos} onDiaClick={setDiaSeleccionado} diaSeleccionado={diaSeleccionado} />
            {diaSeleccionado ? (
              <AgendaGroups turnos={turnosDelDia} loading={loading} onEstado={cambiarEstado} onBorrar={setIdABorrar} compact />
            ) : (
              <div className="flex min-h-72 flex-col items-center justify-center rounded-2xl bg-white px-6 text-center shadow-sm dark:bg-slate-900">
                <svg className="h-8 w-8 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                <p className="mt-3 text-sm font-bold text-slate-700 dark:text-slate-200">Seleccioná un día</p>
                <p className="mt-1 text-xs text-slate-500">Los turnos de esa fecha aparecerán en este panel.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Metric({ label, value, helper }: { label: string; value: number; helper: string }) {
  return <div className="rounded-2xl bg-white px-4 py-3 shadow-sm dark:bg-slate-900"><p className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p><div className="mt-1 flex items-baseline gap-2"><strong className="font-mono text-xl text-slate-900 dark:text-white">{value}</strong><span className="text-xs text-slate-500">{helper}</span></div></div>;
}

function ViewButton({ active, onClick, label, icon }: { active: boolean; onClick: () => void; label: string; icon: "list" | "calendar" }) {
  return <button type="button" onClick={onClick} className={cn("flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition", active ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white" : "text-slate-500 dark:text-slate-400")}>
    {icon === "list"
      ? <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 7h14M5 12h14M5 17h14" /></svg>
      : <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
    {label}
  </button>;
}

function AgendaGroups({ turnos, loading, onEstado, onBorrar, compact = false }: { turnos: Turno[]; loading: boolean; onEstado: (id: number, estado: string) => void; onBorrar: (id: number) => void; compact?: boolean }) {
  if (loading) return <div className="space-y-3">{[1, 2, 3].map((item) => <div key={item} className="h-24 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-slate-800" />)}</div>;
  if (!turnos.length) return <div className="flex min-h-52 flex-col items-center justify-center rounded-2xl bg-white px-6 text-center shadow-sm dark:bg-slate-900"><p className="text-sm font-bold text-slate-700 dark:text-slate-200">No hay turnos para mostrar</p><p className="mt-1 text-xs text-slate-500">Podés crear uno nuevo desde el botón superior.</p></div>;

  const grupos = agruparTurnos(turnos);
  return <div className={cn("space-y-3", compact && "min-w-0")}>
    {Object.entries(grupos).map(([clave, turnosDelDia]) => {
      const fecha = new Date(turnosDelDia[0].fecha_hora);
      return <section key={clave} className="overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-slate-900">
        <header className="flex items-center justify-between bg-slate-50/80 px-4 py-2.5 dark:bg-slate-950/35">
          <div><strong className="text-xs capitalize text-slate-800 dark:text-slate-100">{fecha.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}</strong><span className="ml-2 text-[10px] font-bold text-slate-400">{turnosDelDia.length} {turnosDelDia.length === 1 ? "turno" : "turnos"}</span></div>
        </header>
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {turnosDelDia.map((turno) => <TurnoRow key={turno.id} turno={turno} onEstado={onEstado} onBorrar={onBorrar} />)}
        </div>
      </section>;
    })}
  </div>;
}

function TurnoRow({ turno, onEstado, onBorrar }: { turno: Turno; onEstado: (id: number, estado: string) => void; onBorrar: (id: number) => void }) {
  const hora = new Date(turno.fecha_hora).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
  const cancelado = turno.estado === "CANCELADO";
  return <article className={cn("grid gap-3 px-4 py-3.5 transition hover:bg-slate-50/70 dark:hover:bg-slate-950/25 md:grid-cols-[76px_minmax(0,1fr)_150px_auto] md:items-center", cancelado && "opacity-55")}>
    <div><strong className="font-mono text-lg text-brand-600 dark:text-brand-400">{hora}</strong><p className="text-[9px] font-black uppercase tracking-wider text-slate-400">Ingreso</p></div>
    <div className="min-w-0">
      <div className="flex items-center gap-2"><h3 className="truncate text-sm font-black text-slate-900 dark:text-white">{turno.cliente_nombre}</h3><span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[9px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{turno.patente}</span></div>
      <p className="truncate text-xs font-semibold text-slate-500">{turno.vehiculo_desc}</p>
      <p className="mt-1 truncate text-xs text-slate-600 dark:text-slate-300"><span className="font-bold">Motivo:</span> {turno.motivo}</p>
      {turno.notas && <p className="mt-0.5 truncate text-[11px] text-slate-400">{turno.notas}</p>}
    </div>
    <select value={turno.estado} onChange={(event) => onEstado(turno.id, event.target.value)} className={cn("h-9 cursor-pointer appearance-none rounded-lg px-3 text-[10px] font-black uppercase tracking-wider outline-none", estadoClasses[turno.estado] ?? estadoClasses.PENDIENTE)}>
      {ESTADOS_TURNO.map((estado) => <option key={estado.value} value={estado.value}>{estado.label}</option>)}
    </select>
    <div className="flex gap-1 md:justify-end">
      <Link href={`/turnos/nuevo?id=${turno.id}`} title="Editar turno" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-brand-600 dark:hover:bg-slate-800"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg></Link>
      <button type="button" onClick={() => onBorrar(turno.id)} title="Eliminar turno" className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30"><svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg></button>
    </div>
  </article>;
}
