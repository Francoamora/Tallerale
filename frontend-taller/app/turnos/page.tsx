"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Patente } from "@/components/patente";
import { actualizarEstadoTurno, eliminarTurno, getTurnos } from "@/lib/api";
import type { Turno } from "@/lib/types";
import { cn } from "@/lib/utils";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

const DIA_MS = 86_400_000;
const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

const ESTADO: Record<string, { label: string; clase: string; chip: string }> = {
  PENDIENTE: {
    label: "Sin confirmar",
    clase: "bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900",
    chip: "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  },
  CONFIRMADO: {
    label: "Confirmado",
    clase: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900",
    chip: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  },
  CUMPLIDO: {
    label: "Vino",
    clase: "bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700",
    chip: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
  },
  CANCELADO: {
    label: "Cancelado",
    clase: "bg-red-50 text-red-600 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900",
    chip: "bg-red-50 text-red-500 line-through dark:bg-red-950/30 dark:text-red-300",
  },
};

const FILTROS = [
  { value: "PROXIMOS", label: "Próximos" },
  { value: "SIN_CONFIRMAR", label: "Sin confirmar" },
  { value: "HISTORIAL", label: "Anteriores" },
] as const;
type Filtro = (typeof FILTROS)[number]["value"];

// ─── Fechas ────────────────────────────────────────────────

function inicioDia(fecha: Date) {
  return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate());
}

function claveDia(fecha: Date) {
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
}

function diasDesdeHoy(fecha: Date) {
  return Math.round((inicioDia(fecha).getTime() - inicioDia(new Date()).getTime()) / DIA_MS);
}

function hora(fecha: Date) {
  return `${String(fecha.getHours()).padStart(2, "0")}:${String(fecha.getMinutes()).padStart(2, "0")}`;
}

/** "Hoy", "Mañana", "Ayer" o "Sábado 21 de noviembre". */
function etiquetaDia(fecha: Date) {
  const diff = diasDesdeHoy(fecha);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Mañana";
  if (diff === -1) return "Ayer";
  const opciones: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" };
  if (fecha.getFullYear() !== new Date().getFullYear()) opciones.year = "numeric";
  const texto = fecha.toLocaleDateString("es-AR", opciones).replace(",", "");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Cómo se nombra el día dentro de un mensaje: "hoy", "mañana", "el sábado 21". */
function diaEnMensaje(fecha: Date) {
  const diff = diasDesdeHoy(fecha);
  if (diff === 0) return "hoy";
  if (diff === 1) return "mañana";
  return `el ${fecha.toLocaleDateString("es-AR", { weekday: "long" })} ${fecha.getDate()}`;
}

const estaAbierto = (t: Turno) => t.estado === "PENDIENTE" || t.estado === "CONFIRMADO";

function mensajeWhatsApp(t: Turno) {
  const fecha = new Date(t.fecha_hora);
  const nombre = t.cliente_nombre.split(" ")[0];
  const auto = t.vehiculo_desc && t.vehiculo_desc !== "Sin Vehículo" ? ` con tu ${t.vehiculo_desc}` : "";
  if (t.estado === "PENDIENTE") {
    return `Hola ${nombre}! Te escribimos del taller por tu turno ${diaEnMensaje(fecha)} a las ${hora(fecha)}${auto}. ¿Nos confirmás si venís?`;
  }
  return `Hola ${nombre}! Te recordamos tu turno ${diaEnMensaje(fecha)} a las ${hora(fecha)}${auto}. ¡Te esperamos!`;
}

function agruparPorDia(turnos: Turno[]) {
  const grupos = new Map<string, Turno[]>();
  for (const t of turnos) {
    const clave = claveDia(new Date(t.fecha_hora));
    grupos.set(clave, [...(grupos.get(clave) ?? []), t]);
  }
  return [...grupos.entries()];
}

// ─── Página ────────────────────────────────────────────────

export default function AgendaTurnos() {
  const router = useRouter();
  const [turnos, setTurnos] = useState<Turno[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("PROXIMOS");
  const [vista, setVista] = useState<"lista" | "calendario">("lista");
  const [diaSel, setDiaSel] = useState(() => inicioDia(new Date()));
  const [verPasados, setVerPasados] = useState(false);
  const [menuId, setMenuId] = useState<number | null>(null);
  const [idABorrar, setIdABorrar] = useState<number | null>(null);
  const [aviso, setAviso] = useState({ texto: "", error: false });

  const mostrarAviso = useCallback((texto: string, error = false) => {
    setAviso({ texto, error });
    window.setTimeout(() => setAviso({ texto: "", error: false }), 2800);
  }, []);

  useEffect(() => {
    let activo = true;
    const timer = window.setTimeout(async () => {
      try {
        setLoading(true);
        const data = await getTurnos(busqueda);
        if (activo) setTurnos(data);
      } catch {
        if (activo) mostrarAviso("No pudimos cargar la agenda.", true);
      } finally {
        if (activo) setLoading(false);
      }
    }, busqueda ? 250 : 0);
    return () => { activo = false; window.clearTimeout(timer); };
  }, [busqueda, mostrarAviso]);

  async function cambiarEstado(id: number, estado: string, texto?: string) {
    const anterior = turnos;
    setTurnos((actuales) => actuales.map((t) => (t.id === id ? { ...t, estado } : t)));
    try {
      await actualizarEstadoTurno(id, estado);
      if (texto) mostrarAviso(texto);
      return true;
    } catch {
      setTurnos(anterior);
      mostrarAviso("No pudimos actualizar el turno.", true);
      return false;
    }
  }

  async function abrirOrden(t: Turno) {
    if (estaAbierto(t) && !(await cambiarEstado(t.id, "CUMPLIDO"))) return;
    const params = new URLSearchParams();
    if (t.vehiculo_id) params.set("vehiculo", String(t.vehiculo_id));
    if (t.motivo) params.set("motivo", t.motivo);
    router.push(`/trabajos/nuevo?${params.toString()}`);
  }

  async function confirmarBorrado() {
    if (!idABorrar) return;
    const anterior = turnos;
    setTurnos((actuales) => actuales.filter((t) => t.id !== idABorrar));
    try {
      await eliminarTurno(idABorrar);
      mostrarAviso("Turno eliminado.");
    } catch {
      setTurnos(anterior);
      mostrarAviso("No pudimos eliminar el turno.", true);
    } finally {
      setIdABorrar(null);
    }
  }

  const hoy = inicioDia(new Date());
  const clasificados = useMemo(() => {
    const inicioHoy = inicioDia(new Date()).getTime();
    const enSemana = inicioHoy + 7 * DIA_MS;
    const futuros = turnos.filter((t) => new Date(t.fecha_hora).getTime() >= inicioHoy);
    const anteriores = turnos.filter((t) => new Date(t.fecha_hora).getTime() < inicioHoy);
    const deHoy = futuros.filter((t) => new Date(t.fecha_hora).getTime() < inicioHoy + DIA_MS && t.estado !== "CANCELADO");
    return {
      futuros,
      anteriores: [...anteriores].reverse(),
      pasadosSinCerrar: anteriores.filter(estaAbierto),
      sinConfirmar: futuros.filter((t) => t.estado === "PENDIENTE"),
      hoy: deHoy.length,
      hoyConfirmados: deHoy.filter((t) => t.estado === "CONFIRMADO").length,
      semana: futuros.filter((t) => new Date(t.fecha_hora).getTime() < enSemana && t.estado !== "CANCELADO").length,
    };
  }, [turnos]);

  const visibles = filtro === "PROXIMOS" ? clasificados.futuros : filtro === "SIN_CONFIRMAR" ? clasificados.sinConfirmar : clasificados.anteriores;
  const cantidadFiltro: Record<Filtro, number> = {
    PROXIMOS: clasificados.futuros.length,
    SIN_CONFIRMAR: clasificados.sinConfirmar.length,
    HISTORIAL: clasificados.anteriores.length,
  };

  const filaProps = (t: Turno) => ({
    t,
    menuAbierto: menuId === t.id,
    onMenu: (abrir: boolean) => setMenuId(abrir ? t.id : null),
    onEstado: (estado: string, texto: string) => void cambiarEstado(t.id, estado, texto),
    onAbrirOrden: () => void abrirOrden(t),
    onEliminar: () => setIdABorrar(t.id),
  });

  function irAPasados() {
    setVista("lista");
    setFiltro("PROXIMOS");
    setVerPasados(true);
  }

  return (
    <AppShell
      currentPath="/turnos"
      compact
      badge="Organización"
      title="Agenda"
      description="Quién viene, cuándo, y qué turnos falta confirmar."
      actions={
        <Link href="/turnos/nuevo" className="inline-flex h-9 items-center rounded-xl bg-brand-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700">
          + Nuevo turno
        </Link>
      }
    >
      {aviso.texto && (
        <div role="status" className={cn("fixed bottom-6 right-6 z-50 rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-2xl", aviso.error ? "bg-red-600" : "bg-slate-900 dark:bg-slate-700")}>
          {aviso.texto}
        </div>
      )}

      {/* Franja de números (en el calendario, el resumen va en el panel del día) */}
      {vista === "lista" && (
      <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 xl:grid-cols-4">
        <Cifra
          label="Hoy"
          value={String(clasificados.hoy)}
          helper={clasificados.hoy ? `${clasificados.hoyConfirmados} confirmado${clasificados.hoyConfirmados === 1 ? "" : "s"}` : "Día libre"}
          onClick={() => { setVista("calendario"); setDiaSel(hoy); }}
        />
        <Cifra label="Próximos 7 días" value={String(clasificados.semana)} helper="Turnos agendados" onClick={() => { setVista("lista"); setFiltro("PROXIMOS"); }} />
        <Cifra
          label="Sin confirmar"
          value={String(clasificados.sinConfirmar.length)}
          helper={clasificados.sinConfirmar.length ? "Mandales un WhatsApp" : "Todo confirmado"}
          alerta={clasificados.sinConfirmar.length > 0}
          onClick={() => { setVista("lista"); setFiltro("SIN_CONFIRMAR"); }}
        />
        <Cifra
          label="Pasados sin cerrar"
          value={String(clasificados.pasadosSinCerrar.length)}
          helper={clasificados.pasadosSinCerrar.length ? "Marcá si vinieron o no" : "Agenda al día"}
          alerta={clasificados.pasadosSinCerrar.length > 0}
          onClick={clasificados.pasadosSinCerrar.length ? irAPasados : undefined}
        />
      </div>
      )}

      {/* Búsqueda, filtros y vista */}
      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-sm">
          <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" /></svg>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar cliente, patente o motivo…"
            aria-label="Buscar turnos"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        {vista === "lista" && (
          <div className="-mx-1 flex min-w-0 gap-1 overflow-x-auto px-1 pb-1 lg:pb-0" role="toolbar" aria-label="Filtrar turnos">
            {FILTROS.map((f) => {
              const activo = filtro === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  onClick={() => setFiltro(f.value)}
                  aria-pressed={activo}
                  className={cn(
                    "inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-xs font-semibold transition",
                    activo ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
                  )}
                >
                  {f.label}
                  <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", activo ? "bg-white/20 dark:bg-slate-900/10" : "bg-slate-200/70 text-slate-600 dark:bg-slate-700 dark:text-slate-300")}>{cantidadFiltro[f.value]}</span>
                </button>
              );
            })}
          </div>
        )}
        <div className="flex shrink-0 rounded-xl bg-slate-200/60 p-1 dark:bg-slate-800 lg:ml-auto" role="tablist" aria-label="Vista">
          <BotonVista activo={vista === "lista"} onClick={() => setVista("lista")} texto="Lista" icono="M5 7h14M5 12h14M5 17h14" />
          <BotonVista activo={vista === "calendario"} onClick={() => setVista("calendario")} texto="Calendario" icono="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </div>
      </div>

      {vista === "lista" ? (
        <div className="mt-3 space-y-3">
          {filtro === "PROXIMOS" && clasificados.pasadosSinCerrar.length > 0 && (
            <section className="overflow-hidden rounded-2xl border border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20">
              <div className="flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
                    {clasificados.pasadosSinCerrar.length === 1 ? "Un turno pasado quedó sin cerrar" : `${clasificados.pasadosSinCerrar.length} turnos pasados quedaron sin cerrar`}
                  </p>
                  <p className="text-xs text-amber-800/80 dark:text-amber-300/80">Marcá si vinieron o no, así la agenda queda al día.</p>
                </div>
                <button type="button" onClick={() => setVerPasados((v) => !v)} aria-expanded={verPasados} className="inline-flex h-8 shrink-0 items-center self-start rounded-lg bg-white px-3 text-xs font-semibold text-amber-900 shadow-sm ring-1 ring-amber-200 transition hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900 sm:self-auto">
                  {verPasados ? "Ocultar" : "Revisar"}
                </button>
              </div>
              {verPasados && (
                <ul className="divide-y divide-amber-100 border-t border-amber-200 bg-white dark:divide-slate-700/70 dark:border-amber-900/60 dark:bg-slate-800">
                  {clasificados.pasadosSinCerrar.map((t) => <Fila key={t.id} {...filaProps(t)} conFecha />)}
                </ul>
              )}
            </section>
          )}

          {loading ? (
            <div className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-700/50" />)}
            </div>
          ) : visibles.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-800">
              <p className="font-semibold text-slate-700 dark:text-slate-200">
                {busqueda ? "No encontramos turnos con esa búsqueda." : filtro === "SIN_CONFIRMAR" ? "Todos los turnos están confirmados." : filtro === "HISTORIAL" ? "Todavía no hay turnos anteriores." : "No hay turnos por delante."}
              </p>
              {filtro === "PROXIMOS" && !busqueda && (
                <Link href="/turnos/nuevo" className="mt-4 inline-block rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white">Agendar un turno</Link>
              )}
            </div>
          ) : (
            agruparPorDia(visibles).map(([clave, delDia]) => {
              const fecha = new Date(delDia[0].fecha_hora);
              const esHoy = diasDesdeHoy(fecha) === 0;
              return (
                <section key={clave} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                  <header className={cn("flex items-baseline gap-2 border-b px-5 py-2.5", esHoy ? "border-brand-100 bg-brand-50 dark:border-brand-900/40 dark:bg-brand-950/20" : "border-slate-100 bg-slate-50/80 dark:border-slate-700 dark:bg-slate-900/40")}>
                    <h2 className={cn("font-display text-lg font-extrabold leading-none", esHoy ? "text-brand-700 dark:text-brand-300" : "text-slate-900 dark:text-white")}>{etiquetaDia(fecha)}</h2>
                    {diasDesdeHoy(fecha) >= -1 && diasDesdeHoy(fecha) <= 1 && (
                      <span className="text-xs text-slate-500 dark:text-slate-400">{fecha.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}</span>
                    )}
                    <span className="ml-auto text-xs tabular-nums text-slate-500 dark:text-slate-400">{delDia.length} {delDia.length === 1 ? "turno" : "turnos"}</span>
                  </header>
                  <ul className="divide-y divide-slate-100 dark:divide-slate-700/70">
                    {delDia.map((t) => <Fila key={t.id} {...filaProps(t)} />)}
                  </ul>
                </section>
              );
            })
          )}
        </div>
      ) : (
        <div className="mt-3 grid gap-4 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <Calendario turnos={turnos} diaSel={diaSel} onDia={setDiaSel} />
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 lg:sticky lg:top-24">
            <div className="grid grid-cols-2 border-b border-slate-100 dark:border-slate-700">
              <MiniCifra label="Hoy" value={clasificados.hoy} helper={clasificados.hoy ? `${clasificados.hoyConfirmados} confirmado${clasificados.hoyConfirmados === 1 ? "" : "s"}` : "Día libre"} onClick={() => setDiaSel(hoy)} />
              <MiniCifra label="Próximos 7 días" value={clasificados.semana} helper="Turnos agendados" onClick={() => { setVista("lista"); setFiltro("PROXIMOS"); }} />
              <MiniCifra label="Sin confirmar" value={clasificados.sinConfirmar.length} helper="Ver la lista" alerta={clasificados.sinConfirmar.length > 0} onClick={() => { setVista("lista"); setFiltro("SIN_CONFIRMAR"); }} />
              <MiniCifra label="Pasados sin cerrar" value={clasificados.pasadosSinCerrar.length} helper={clasificados.pasadosSinCerrar.length ? "Resolverlos" : "Agenda al día"} alerta={clasificados.pasadosSinCerrar.length > 0} onClick={clasificados.pasadosSinCerrar.length ? irAPasados : undefined} />
            </div>
            <header className="flex items-center gap-3 border-b border-slate-100 px-5 py-3.5 dark:border-slate-700">
              <div className="min-w-0">
                <h2 className="font-display text-xl font-extrabold leading-tight text-slate-900 dark:text-white">{etiquetaDia(diaSel)}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {diasDesdeHoy(diaSel) >= -1 && diasDesdeHoy(diaSel) <= 1 ? `${diaSel.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })} · ` : ""}
                  {(() => {
                    const n = turnos.filter((t) => claveDia(new Date(t.fecha_hora)) === claveDia(diaSel)).length;
                    return n ? `${n} ${n === 1 ? "turno" : "turnos"}` : "Sin turnos";
                  })()}
                </p>
              </div>
              {diasDesdeHoy(diaSel) >= 0 && (
                <Link href={`/turnos/nuevo?fecha=${claveDia(diaSel)}`} className="ml-auto inline-flex h-8 shrink-0 items-center rounded-lg px-3 text-xs font-semibold text-brand-700 ring-1 ring-brand-200 transition hover:bg-brand-50 dark:text-brand-300 dark:ring-brand-900 dark:hover:bg-brand-950/30">
                  + Turno este día
                </Link>
              )}
            </header>
            {(() => {
              const delDia = turnos.filter((t) => claveDia(new Date(t.fecha_hora)) === claveDia(diaSel));
              if (loading) return <div className="p-4"><div className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-700/50" /></div>;
              if (!delDia.length) {
                return (
                  <div className="px-6 py-12 text-center">
                    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Día libre</p>
                    <p className="mt-1 text-xs text-slate-500">No hay turnos agendados para este día.</p>
                  </div>
                );
              }
              return <ul className="divide-y divide-slate-100 dark:divide-slate-700/70">{delDia.map((t) => <Fila key={t.id} {...filaProps(t)} apilada />)}</ul>;
            })()}
          </section>
        </div>
      )}

      {idABorrar !== null && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">¿Eliminar este turno?</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Desaparece de la agenda y no se puede recuperar. Si el cliente avisó que no viene, mejor marcalo como cancelado.</p>
            <div className="mt-6 flex gap-2">
              <button type="button" onClick={() => setIdABorrar(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300">Volver</button>
              <button type="button" onClick={confirmarBorrado} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

// ─── Piezas ────────────────────────────────────────────────

function Cifra({ label, value, helper, alerta = false, onClick }: { label: string; value: string; helper: string; alerta?: boolean; onClick?: () => void }) {
  const cuerpo = (
    <>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className={cn("mt-1 font-display text-3xl font-extrabold leading-none tabular-nums", alerta ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-white")}>{value}</p>
      <p className="mt-1 truncate text-[11px] text-slate-400">{helper}</p>
    </>
  );
  const clase = "block border-slate-100 px-5 py-4 text-left [&:not(:first-child)]:border-l dark:border-slate-700 max-xl:[&:nth-child(3)]:border-l-0 max-xl:[&:nth-child(n+3)]:border-t";
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(clase, "transition hover:bg-slate-50 dark:hover:bg-slate-700/30")}>{cuerpo}</button>
  ) : (
    <div className={clase}>{cuerpo}</div>
  );
}

function MiniCifra({ label, value, helper, alerta = false, onClick }: { label: string; value: number; helper: string; alerta?: boolean; onClick?: () => void }) {
  const cuerpo = (
    <>
      <span className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <span className="mt-0.5 flex items-baseline gap-2">
        <span className={cn("font-display text-2xl font-extrabold leading-none tabular-nums", alerta ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-white")}>{value}</span>
        <span className="truncate text-[11px] text-slate-400">{helper}</span>
      </span>
    </>
  );
  const clase = "block min-w-0 border-slate-100 px-5 py-3 text-left dark:border-slate-700 [&:nth-child(even)]:border-l [&:nth-child(n+3)]:border-t";
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(clase, "transition hover:bg-slate-50 dark:hover:bg-slate-700/30")}>{cuerpo}</button>
  ) : (
    <div className={clase}>{cuerpo}</div>
  );
}

function BotonVista({ activo, onClick, texto, icono }: { activo: boolean; onClick: () => void; texto: string; icono: string }) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={activo}
      onClick={onClick}
      className={cn("inline-flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition", activo ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white")}
    >
      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d={icono} /></svg>
      {texto}
    </button>
  );
}

function Fila({
  t,
  menuAbierto,
  onMenu,
  onEstado,
  onAbrirOrden,
  onEliminar,
  conFecha = false,
  apilada = false,
}: {
  t: Turno;
  menuAbierto: boolean;
  onMenu: (abrir: boolean) => void;
  onEstado: (estado: string, texto: string) => void;
  onAbrirOrden: () => void;
  onEliminar: () => void;
  conFecha?: boolean;
  apilada?: boolean;
}) {
  const fecha = new Date(t.fecha_hora);
  const diff = diasDesdeHoy(fecha);
  const abierto = estaAbierto(t);
  const pasado = diff < 0;
  const estado = ESTADO[t.estado] ?? ESTADO.PENDIENTE;
  const wa = abierto && !pasado ? buildWhatsAppUrl(mensajeWhatsApp(t), t.cliente_telefono) : "";
  const tieneAuto = t.vehiculo_desc && t.vehiculo_desc !== "Sin Vehículo";

  let principal: React.ReactNode = null;
  if (abierto && pasado) {
    principal = (
      <div className="flex gap-1.5">
        <button type="button" onClick={() => onEstado("CUMPLIDO", "Marcado: vino.")} className="inline-flex h-8 items-center rounded-lg bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900">Vino</button>
        <button type="button" onClick={() => onEstado("CANCELADO", "Marcado: no vino.")} className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 transition hover:bg-slate-50 dark:text-slate-300 dark:ring-slate-600 dark:hover:bg-slate-700">No vino</button>
      </div>
    );
  } else if (abierto && diff === 0) {
    principal = (
      <button type="button" onClick={onAbrirOrden} className="inline-flex h-8 items-center rounded-lg bg-brand-600 px-3 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700">
        <span className="sm:hidden">Abrir orden →</span>
        <span className="hidden sm:inline">Llegó · Abrir orden →</span>
      </button>
    );
  } else if (t.estado === "PENDIENTE") {
    principal = (
      <button type="button" onClick={() => onEstado("CONFIRMADO", "Turno confirmado.")} className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-600 dark:hover:bg-slate-700">
        Marcar confirmado
      </button>
    );
  }

  const itemsMenu = [
    { texto: "Editar turno", href: `/turnos/nuevo?id=${t.id}` },
    ...(t.estado === "PENDIENTE" && !pasado ? [{ texto: "Marcar confirmado", onClick: () => onEstado("CONFIRMADO", "Turno confirmado.") }] : []),
    ...(t.estado === "CONFIRMADO" && !pasado ? [{ texto: "Volver a sin confirmar", onClick: () => onEstado("PENDIENTE", "Turno sin confirmar.") }] : []),
    ...(abierto ? [{ texto: "Abrir orden de trabajo", onClick: onAbrirOrden }] : []),
    ...(abierto && !pasado ? [{ texto: "Cancelar turno", onClick: () => onEstado("CANCELADO", "Turno cancelado.") }] : []),
    ...(t.estado === "CANCELADO" && !pasado ? [{ texto: "Reactivar turno", onClick: () => onEstado("PENDIENTE", "Turno reactivado.") }] : []),
    ...(t.cliente_id ? [{ texto: "Ver ficha del cliente", href: `/clientes?id=${t.cliente_id}` }] : []),
    { texto: "Eliminar", onClick: onEliminar, peligro: true },
  ];

  return (
    <li
      className={cn(
        "grid grid-cols-[56px_minmax(0,1fr)] gap-x-3 gap-y-2.5 px-4 py-3.5 sm:grid-cols-[64px_minmax(0,1fr)] sm:gap-x-4 sm:px-5 transition hover:bg-slate-50/70 dark:hover:bg-slate-700/20",
        !apilada && "md:grid-cols-[72px_minmax(0,1fr)_120px_auto] md:items-center",
        t.estado === "CANCELADO" && "opacity-60",
      )}
    >
      <div>
        <p className={cn("font-display text-2xl font-extrabold leading-none tabular-nums text-slate-900 dark:text-white", t.estado === "CANCELADO" && "line-through")}>{hora(fecha)}</p>
        {conFecha && <p className="mt-1 text-[11px] text-slate-500">{fecha.toLocaleDateString("es-AR", { day: "numeric", month: "short" })}</p>}
      </div>

      <div className="min-w-0">
        <div className="flex min-w-0 items-baseline gap-2">
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{t.cliente_nombre}</p>
          {t.patente && t.patente !== "N/A" && <Patente valor={t.patente} className="shrink-0 text-xs" />}
        </div>
        <p className="mt-0.5 line-clamp-2 text-sm text-slate-500 dark:text-slate-400 md:line-clamp-1">
          {tieneAuto && <span>{t.vehiculo_desc} · </span>}
          <span className="text-slate-700 dark:text-slate-300">{t.motivo}</span>
        </p>
        {t.notas && <p className="mt-0.5 truncate text-xs text-slate-400">{t.notas}</p>}
        <span className={cn("mt-2 inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset", !apilada && "md:hidden", estado.clase)}>{estado.label}</span>
      </div>

      {!apilada && (
        <div className="hidden md:block">
          <span className={cn("inline-flex whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset", estado.clase)}>{estado.label}</span>
        </div>
      )}

      <div className={cn("col-start-2 flex flex-wrap items-center gap-1.5", !apilada && "md:col-start-auto md:justify-end")}>
        {principal}
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noopener noreferrer"
            title={t.estado === "PENDIENTE" ? "Pedir confirmación por WhatsApp" : "Recordar el turno por WhatsApp"}
            aria-label={t.estado === "PENDIENTE" ? "Pedir confirmación por WhatsApp" : "Recordar el turno por WhatsApp"}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200 transition hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35ZM12.04 21.5h-.01a9.45 9.45 0 0 1-4.82-1.32l-.35-.2-3.58.94.96-3.49-.23-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.22 4.25-9.47 9.48-9.47 2.53 0 4.9.99 6.7 2.78a9.4 9.4 0 0 1 2.77 6.7c0 5.22-4.25 9.46-9.47 9.46Zm8.06-17.53A11.3 11.3 0 0 0 12.04.63C5.76.63.65 5.74.65 12.02c0 2 .52 3.96 1.52 5.69L.55 23.6l6.04-1.58a11.4 11.4 0 0 0 5.44 1.39h.01c6.28 0 11.39-5.11 11.39-11.39 0-3.04-1.19-5.9-3.34-8.05Z" /></svg>
            <span className={cn(principal && "hidden sm:inline")}>{t.estado === "PENDIENTE" ? "Pedir confirmación" : "Recordar"}</span>
          </a>
        )}
        <MenuMas abierto={menuAbierto} onAbrir={onMenu} items={itemsMenu} />
      </div>
    </li>
  );
}

function Calendario({ turnos, diaSel, onDia }: { turnos: Turno[]; diaSel: Date; onDia: (fecha: Date) => void }) {
  const [mes, setMes] = useState(() => new Date(diaSel.getFullYear(), diaSel.getMonth(), 1));
  const year = mes.getFullYear();
  const month = mes.getMonth();
  // Semana de lunes a domingo, como se usa en el taller.
  const offset = (new Date(year, month, 1).getDay() + 6) % 7;
  const diasEnMes = new Date(year, month + 1, 0).getDate();
  const celdas: (number | null)[] = [...Array.from({ length: offset }, () => null), ...Array.from({ length: diasEnMes }, (_, i) => i + 1)];
  while (celdas.length % 7) celdas.push(null);

  const porDia = useMemo(() => {
    const mapa = new Map<string, Turno[]>();
    for (const t of turnos) {
      const clave = claveDia(new Date(t.fecha_hora));
      mapa.set(clave, [...(mapa.get(clave) ?? []), t]);
    }
    return mapa;
  }, [turnos]);

  const delMes = turnos.filter((t) => {
    const f = new Date(t.fecha_hora);
    return f.getFullYear() === year && f.getMonth() === month && t.estado !== "CANCELADO";
  }).length;

  function irAHoy() {
    const hoy = inicioDia(new Date());
    setMes(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
    onDia(hoy);
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <header className="flex items-center gap-2 px-5 py-3.5">
        <div className="mr-auto">
          <h2 className="font-display text-xl font-extrabold leading-tight text-slate-900 dark:text-white">{MESES[month]} {year}</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">{delMes ? `${delMes} ${delMes === 1 ? "turno" : "turnos"} este mes` : "Sin turnos este mes"}</p>
        </div>
        <button type="button" onClick={irAHoy} className="inline-flex h-8 items-center rounded-lg px-3 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 transition hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-600 dark:hover:bg-slate-700">Hoy</button>
        <button type="button" onClick={() => setMes(new Date(year, month - 1, 1))} aria-label="Mes anterior" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-700">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
        </button>
        <button type="button" onClick={() => setMes(new Date(year, month + 1, 1))} aria-label="Mes siguiente" className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 dark:hover:bg-slate-700">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
        </button>
      </header>

      <div className="grid grid-cols-7 border-t border-slate-100 dark:border-slate-700">
        {DIAS_SEMANA.map((d, i) => (
          <div key={d} className={cn("py-2 text-center text-xs font-medium text-slate-500 dark:text-slate-400", i >= 5 && "text-slate-400 dark:text-slate-500")}>{d}</div>
        ))}
        {celdas.map((dia, i) => {
          if (dia === null) return <div key={`v-${i}`} className="border-t border-slate-100 bg-slate-50/50 dark:border-slate-700 dark:bg-slate-900/20 [&:not(:nth-child(7n+1))]:border-l" />;
          const fecha = new Date(year, month, dia);
          const delDia = (porDia.get(claveDia(fecha)) ?? []).filter((t) => t.estado !== "CANCELADO");
          const sel = claveDia(fecha) === claveDia(diaSel);
          const esHoy = diasDesdeHoy(fecha) === 0;
          const pasado = diasDesdeHoy(fecha) < 0;
          const sinCerrar = pasado && delDia.some(estaAbierto);
          return (
            <button
              key={dia}
              type="button"
              onClick={() => onDia(fecha)}
              aria-pressed={sel}
              aria-label={`${etiquetaDia(fecha)}: ${delDia.length} turnos`}
              className={cn(
                "group relative flex min-h-14 flex-col items-stretch gap-1 border-t border-slate-100 p-1.5 text-left transition dark:border-slate-700 sm:min-h-24 sm:p-2 [&:not(:nth-child(7n+1))]:border-l",
                sel ? "bg-brand-50 ring-2 ring-inset ring-brand-500 dark:bg-brand-950/30" : "hover:bg-slate-50 dark:hover:bg-slate-700/30",
              )}
            >
              <span
                className={cn(
                  "flex h-6 w-6 items-center justify-center self-center rounded-full text-xs font-semibold tabular-nums sm:self-start",
                  esHoy ? "bg-brand-600 text-white" : pasado ? "text-slate-400 dark:text-slate-500" : "text-slate-800 dark:text-slate-200",
                )}
              >
                {dia}
              </span>
              {/* En el celular, un punto por día con turnos; en pantallas grandes, los turnos. */}
              {delDia.length > 0 && (
                <span className={cn("mx-auto h-1.5 w-1.5 rounded-full sm:hidden", sinCerrar ? "bg-amber-500" : "bg-brand-500")} />
              )}
              <span className="hidden min-w-0 flex-col gap-0.5 sm:flex">
                {delDia.slice(0, 2).map((t) => (
                  <span key={t.id} className={cn("truncate rounded px-1.5 py-0.5 text-[11px] font-medium", pasado && t.estado === "CUMPLIDO" ? ESTADO.CUMPLIDO.chip : (ESTADO[t.estado] ?? ESTADO.PENDIENTE).chip)}>
                    <span className="tabular-nums">{hora(new Date(t.fecha_hora))}</span> {t.cliente_nombre.split(" ")[0]}
                  </span>
                ))}
                {delDia.length > 2 && <span className="px-1.5 text-[11px] font-medium text-slate-500">+{delDia.length - 2} más</span>}
              </span>
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 px-5 py-2.5 text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-emerald-200 dark:bg-emerald-800" /> Confirmado</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-amber-200 dark:bg-amber-800" /> Sin confirmar</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-slate-200 dark:bg-slate-700" /> Ya vino</span>
      </div>
    </section>
  );
}

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
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onAbrir(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") onAbrir(false); };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", tecla); };
  }, [abierto, onAbrir]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => onAbrir(!abierto)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        className={cn("inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition", abierto ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white")}
      >
        Más
        <svg className={cn("h-3.5 w-3.5 transition-transform", abierto && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
      </button>
      {abierto && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1.5 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-800">
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
