"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getTurnos, actualizarEstadoTurno, eliminarTurno } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { Turno } from "@/lib/types";

const ESTADOS_TURNO = [
  { value: "PENDIENTE", label: "Pendiente" },
  { value: "CONFIRMADO", label: "Confirmado" },
  { value: "CUMPLIDO", label: "Cumplido" },
  { value: "CANCELADO", label: "Cancelado" },
];

const DIAS_SEMANA = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const MESES = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];

function MiniCalendario({ turnos, onDiaClick, diaSeleccionado }: { turnos: Turno[]; onDiaClick: (fecha: Date) => void; diaSeleccionado: Date | null }) {
  const [mesActual, setMesActual] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });

  const year = mesActual.getFullYear();
  const month = mesActual.getMonth();
  const primerDia = new Date(year, month, 1).getDay();
  const diasEnMes = new Date(year, month + 1, 0).getDate();

  const turnosPorDia: Record<string, number> = {};
  turnos.forEach((t) => {
    const f = new Date(t.fecha_hora);
    if (f.getFullYear() === year && f.getMonth() === month) {
      const key = f.getDate().toString();
      turnosPorDia[key] = (turnosPorDia[key] || 0) + 1;
    }
  });

  const celdas: (number | null)[] = [];
  for (let i = 0; i < primerDia; i++) celdas.push(null);
  for (let d = 1; d <= diasEnMes; d++) celdas.push(d);

  const hoy = new Date();

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="mb-4 flex items-center justify-between">
        <button onClick={() => setMesActual(new Date(year, month - 1, 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 transition">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </button>
        <span className="text-sm font-bold text-slate-900 dark:text-white">{MESES[month]} {year}</span>
        <button onClick={() => setMesActual(new Date(year, month + 1, 1))} className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 transition">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1">
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="py-1 text-center text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {d}
          </div>
        ))}
        {celdas.map((dia, i) => {
          if (dia === null) return <div key={`empty-${i}`} />;
          const fecha = new Date(year, month, dia);
          const estaSeleccionado = diaSeleccionado?.toDateString() === fecha.toDateString();
          const esHoy = hoy.toDateString() === fecha.toDateString();
          const cantTurnos = turnosPorDia[dia.toString()] || 0;

          return (
            <button
              key={dia}
              onClick={() => onDiaClick(fecha)}
              className={cn(
                "relative flex h-9 w-full flex-col items-center justify-center rounded-lg text-sm font-semibold transition",
                estaSeleccionado ? "bg-purple-600 text-white shadow-sm" :
                esHoy ? "bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400" :
                "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-700"
              )}
            >
              {dia}
              {cantTurnos > 0 && (
                <span className={cn("absolute bottom-0.5 h-1.5 w-1.5 rounded-full", estaSeleccionado ? "bg-white" : "bg-purple-500")} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function AgendaTurnos() {
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [notificacion, setNotificacion] = useState({ msg: "", isError: false });
  const [idABorrar, setIdABorrar] = useState<number | null>(null);
  const [vista, setVista] = useState<"timeline" | "calendario">("timeline");
  const [diaSeleccionado, setDiaSeleccionado] = useState<Date | null>(null);

  async function cargar(q?: string) {
    try {
      setLoading(true);
      const data = await getTurnos(q);
      setTurnos(data);
    } catch {
      mostrarNotificacion("Error cargando la agenda", true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = setTimeout(() => cargar(busqueda), 300);
    return () => clearTimeout(timer);
  }, [busqueda]);

  async function cambiarEstado(id: number, nuevoEstado: string) {
    const backup = [...turnos];
    setTurnos(turnos.map((t) => (t.id === id ? { ...t, estado: nuevoEstado } : t)));
    try {
      await actualizarEstadoTurno(id, nuevoEstado);
      mostrarNotificacion(`Turno marcado como ${nuevoEstado}`);
    } catch {
      setTurnos(backup);
      mostrarNotificacion("Error al actualizar estado.", true);
    }
  }

  async function confirmarBorrado() {
    if (!idABorrar) return;
    const backup = [...turnos];
    setTurnos(turnos.filter((t) => t.id !== idABorrar));
    try {
      await eliminarTurno(idABorrar);
      mostrarNotificacion("Turno eliminado permanentemente.");
    } catch {
      setTurnos(backup);
      mostrarNotificacion("Error al eliminar el turno.", true);
    } finally {
      setIdABorrar(null);
    }
  }

  function mostrarNotificacion(msg: string, isError = false) {
    setNotificacion({ msg, isError });
    setTimeout(() => setNotificacion({ msg: "", isError: false }), 3000);
  }

  const turnosFiltrados = diaSeleccionado && vista === "calendario"
    ? turnos.filter((t) => new Date(t.fecha_hora).toDateString() === diaSeleccionado.toDateString())
    : turnos;

  const turnosAgrupados = turnosFiltrados.reduce((acc, turno) => {
    const fechaObj = new Date(turno.fecha_hora);
    const fecha = fechaObj.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });
    if (!acc[fecha]) acc[fecha] = [];
    acc[fecha].push(turno);
    return acc;
  }, {} as Record<string, Turno[]>);

  const getBadgeColor = (estado: string) => {
    switch (estado) {
      case "PENDIENTE": return "bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300";
      case "CONFIRMADO": return "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400";
      case "CUMPLIDO": return "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400";
      case "CANCELADO": return "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 opacity-60";
      default: return "bg-slate-100 text-slate-700";
    }
  };

  return (
    <AppShell
      currentPath="/turnos"
      badge="Organización"
      title="Agenda Inteligente"
      description="Visualizá y gestioná las citas de tu taller en línea de tiempo o en calendario."
      actions={
        <Link href="/turnos/nuevo" className="inline-flex items-center justify-center rounded-xl bg-purple-600 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-purple-700 hover:-translate-y-0.5">
          + Agendar Turno
        </Link>
      }
    >
      <div className="space-y-6">

        {/* TOAST */}
        {notificacion.msg && (
          <div className={cn("fixed bottom-6 right-6 z-50 animate-in slide-in-from-bottom-5 fade-in rounded-lg px-5 py-3 text-sm font-bold text-white shadow-2xl", notificacion.isError ? "bg-red-600" : "bg-slate-900 dark:bg-purple-600")}>
            {notificacion.msg}
          </div>
        )}

        {/* MODAL DE BORRADO */}
        {idABorrar && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="w-full max-w-md scale-100 rounded-3xl bg-white p-8 shadow-2xl animate-in zoom-in-95 dark:bg-slate-800">
              <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
              </div>
              <h3 className="text-xl font-black text-slate-900 dark:text-white">¿Limpiar turno de la agenda?</h3>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Esta acción borrará permanentemente la cita.</p>
              <div className="mt-8 flex gap-3">
                <button onClick={() => setIdABorrar(null)} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300">Cancelar</button>
                <button onClick={confirmarBorrado} className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white transition hover:bg-red-700 shadow-md">Sí, eliminar</button>
              </div>
            </div>
          </div>
        )}

        {/* CONTROLES SUPERIORES */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
            </span>
            <input
              type="text"
              placeholder="Buscar por cliente, patente o motivo..."
              className="w-full rounded-2xl border border-slate-200 bg-white py-3.5 pl-12 pr-4 text-sm font-medium outline-none transition focus:border-purple-500 focus:ring-4 focus:ring-purple-500/10 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>

          {/* TOGGLE DE VISTA */}
          <div className="flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800/50">
            <button
              onClick={() => { setVista("timeline"); setDiaSeleccionado(null); }}
              className={cn("flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all", vista === "timeline" ? "bg-white text-purple-600 shadow-sm dark:bg-slate-700 dark:text-purple-400" : "text-slate-500 hover:text-slate-700 dark:text-slate-400")}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
              Lista
            </button>
            <button
              onClick={() => setVista("calendario")}
              className={cn("flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold transition-all", vista === "calendario" ? "bg-white text-purple-600 shadow-sm dark:bg-slate-700 dark:text-purple-400" : "text-slate-500 hover:text-slate-700 dark:text-slate-400")}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              Calendario
            </button>
          </div>
        </div>

        {/* VISTA CALENDARIO */}
        {vista === "calendario" && (
          <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
            <MiniCalendario
              turnos={turnos}
              onDiaClick={setDiaSeleccionado}
              diaSeleccionado={diaSeleccionado}
            />
            <div>
              {diaSeleccionado ? (
                <div className="mb-4">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">
                    {diaSeleccionado.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
                    <span className="ml-2 rounded-full bg-purple-100 px-2 py-0.5 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                      {turnosFiltrados.length} turno{turnosFiltrados.length !== 1 ? "s" : ""}
                    </span>
                  </h3>
                </div>
              ) : (
                <div className="flex h-32 items-center justify-center rounded-2xl border border-dashed border-slate-200 dark:border-slate-700">
                  <p className="text-sm text-slate-400">Hacé clic en un día para ver sus turnos</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* TIMELINE DE TURNOS */}
        <div className={cn("space-y-12", vista === "calendario" && !diaSeleccionado && "hidden")}>
          {loading ? (
            <div className="space-y-6 animate-pulse">
              <div className="h-8 w-48 rounded bg-slate-200 dark:bg-slate-800" />
              <div className="h-32 w-full rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
              <div className="h-32 w-full rounded-2xl bg-slate-100 dark:bg-slate-800/50" />
            </div>
          ) : Object.keys(turnosAgrupados).length > 0 ? (
            Object.entries(turnosAgrupados).map(([fecha, turnosDelDia]) => (
              <div key={fecha} className="relative">
                <div className="sticky top-0 z-10 -mx-4 mb-4 bg-slate-50/90 px-4 py-2 backdrop-blur-md dark:bg-[#0B1120]/90 sm:mx-0 sm:px-0">
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-500 dark:text-slate-400">{fecha}</h3>
                </div>

                <div className="grid gap-4">
                  {turnosDelDia.map((turno) => {
                    const hora = new Date(turno.fecha_hora).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" });
                    const isCancelado = turno.estado === "CANCELADO";

                    return (
                      <div
                        key={turno.id}
                        className={cn(
                          "group relative flex flex-col gap-4 rounded-2xl border bg-white p-5 shadow-sm transition-all sm:flex-row sm:items-center dark:bg-slate-800",
                          isCancelado ? "border-slate-100 dark:border-slate-800" : "border-slate-200 hover:border-purple-300 hover:shadow-md dark:border-slate-700 dark:hover:border-purple-500/50"
                        )}
                      >
                        <div className="flex w-24 flex-shrink-0 flex-col border-b border-slate-100 pb-3 sm:border-b-0 sm:border-r sm:pb-0 sm:pr-4 dark:border-slate-700">
                          <span className={cn("font-mono text-2xl font-black tracking-tighter", isCancelado ? "text-slate-300 dark:text-slate-600" : "text-purple-600 dark:text-purple-400")}>
                            {hora}
                          </span>
                          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Hora</span>
                        </div>

                        <div className={cn("flex-1", isCancelado && "opacity-50 grayscale")}>
                          <div className="flex items-center gap-2">
                            <h4 className="text-lg font-bold text-slate-900 dark:text-white">{turno.cliente_nombre}</h4>
                            <span className="rounded-md bg-slate-100 px-2 py-0.5 font-mono text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                              {turno.patente}
                            </span>
                          </div>
                          <p className="text-sm font-semibold uppercase text-slate-500 dark:text-slate-400">{turno.vehiculo_desc}</p>
                          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                            <span className="font-bold">Motivo:</span> {turno.motivo}
                          </p>
                          {turno.notas && <p className="mt-1 text-xs italic text-slate-400">"{turno.notas}"</p>}
                        </div>

                        <div className="flex flex-col items-end gap-3 flex-shrink-0 pt-3 sm:pt-0">
                          <div className="flex items-center gap-1.5 opacity-0 transition-opacity group-hover:opacity-100">
                            <Link
                              href={`/turnos/nuevo?id=${turno.id}`}
                              title="Re-agendar o editar notas"
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-purple-200 bg-purple-50 text-purple-600 transition hover:bg-purple-600 hover:text-white dark:border-purple-900/50 dark:bg-purple-900/20 dark:text-purple-400 dark:hover:bg-purple-600 dark:hover:text-white"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </Link>
                            <button
                              onClick={() => setIdABorrar(turno.id)}
                              title="Eliminar de la agenda"
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-red-500 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                            </button>
                          </div>

                          <select
                            value={turno.estado}
                            onChange={(e) => cambiarEstado(turno.id, e.target.value)}
                            className={cn("w-full cursor-pointer appearance-none rounded-xl border px-4 py-2 text-xs font-bold uppercase tracking-wider outline-none transition-all focus:ring-2 focus:ring-purple-500/50 sm:w-auto", getBadgeColor(turno.estado))}
                          >
                            {ESTADOS_TURNO.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-slate-200 py-24 dark:border-slate-800">
              <div className="mb-4 rounded-full bg-slate-50 p-4 dark:bg-slate-800/50">
                <svg className="h-8 w-8 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                {diaSeleccionado ? "Sin turnos este día" : "Agenda Limpia"}
              </h3>
              <p className="mt-1 max-w-sm text-center text-sm text-slate-500">
                {diaSeleccionado ? "No hay citas programadas para esta fecha." : "No tenés turnos programados. Usá el botón de arriba para agendar."}
              </p>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
