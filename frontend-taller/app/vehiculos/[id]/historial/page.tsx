"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Patente } from "@/components/patente";
import { StatusBadge } from "@/components/status-badge";
import { getHistorialVehiculo } from "@/lib/api";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import type { VehiculoHistorial, VehiculoHistorialTrabajo } from "@/lib/types";
import { numeroOrden, numeroPresupuesto } from "@/lib/documentos";
import { cn } from "@/lib/utils";

type Tipo = "todo" | "trabajos" | "repuestos";
type Item = VehiculoHistorialTrabajo["items"][number];

const esTrabajo = (i: Item) => i.tipo === "MANO_OBRA" || i.tipo === "OTRO";
const esRepuesto = (i: Item) => i.tipo === "REPUESTO" || i.tipo === "INSUMO";

function normalizar(valor: string) {
  return valor.toLocaleLowerCase("es-AR").normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

/** Fecha de la visita: cuándo se terminó; si sigue en el taller, el ingreso. */
const fechaDe = (t: VehiculoHistorialTrabajo) => new Date(t.fecha_realizado ?? t.fecha_ingreso);

/**
 * Historial del vehículo a todo el ancho: a la izquierda el auto y "Últimos
 * cambios" (cuándo se hizo cada cosa por última vez); a la derecha las visitas
 * en filas compactas, agrupadas por año, con búsqueda dentro de lo que se hizo
 * y filtros por año y por tipo.
 */
export default function HistorialVehiculoPage() {
  const { id } = useParams<{ id: string }>();
  const [historial, setHistorial] = useState<VehiculoHistorial | null>(null);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [anio, setAnio] = useState<number | "todos">("todos");
  const [tipo, setTipo] = useState<Tipo>("todo");

  useEffect(() => {
    let active = true;
    getHistorialVehiculo(Number(id))
      .then((data) => { if (active) setHistorial(data); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "No pudimos cargar el historial."); });
    return () => { active = false; };
  }, [id]);

  const vehiculo = historial?.vehiculo;
  const visitas = useMemo(
    () => (historial?.trabajos ?? []).filter((t) => t.estado !== "ANULADO").sort((a, b) => fechaDe(b).getTime() - fechaDe(a).getTime()),
    [historial],
  );
  const anios = useMemo(() => Array.from(new Set(visitas.map((t) => fechaDe(t).getFullYear()))).sort((a, b) => b - a), [visitas]);

  // Última vez que se hizo cada cosa (sólo lo que efectivamente se completó).
  const ultimosCambios = useMemo(() => {
    const vistos = new Map<string, { descripcion: string; fecha: Date; km: number; repuesto: boolean }>();
    for (const t of visitas) {
      for (const item of t.items) {
        if (!item.completado) continue;
        const clave = normalizar(item.descripcion);
        if (!vistos.has(clave)) vistos.set(clave, { descripcion: item.descripcion, fecha: fechaDe(t), km: t.kilometraje, repuesto: esRepuesto(item) });
      }
    }
    return Array.from(vistos.values());
  }, [visitas]);

  const termino = normalizar(busqueda.trim());
  const filtradas = visitas.filter((t) => {
    if (anio !== "todos" && fechaDe(t).getFullYear() !== anio) return false;
    const items = t.items.filter((i) => (tipo === "todo" ? true : tipo === "trabajos" ? esTrabajo(i) : esRepuesto(i)));
    if (tipo !== "todo" && items.length === 0) return false;
    if (!termino) return true;
    return normalizar([t.resumen, t.recomendaciones_proximo_service, ...items.map((i) => i.descripcion)].join(" ")).includes(termino);
  });
  const porAnio = anios
    .map((a) => ({ anio: a, visitas: filtradas.filter((t) => fechaDe(t).getFullYear() === a) }))
    .filter((g) => g.visitas.length > 0);

  const recomendacion = visitas.find((t) => t.recomendaciones_proximo_service);
  const faltanKm = vehiculo?.proximo_service_km ? vehiculo.proximo_service_km - vehiculo.kilometraje_actual : null;
  const totalGastado = visitas.reduce((s, t) => s + Number(t.total), 0);
  const hayFiltro = Boolean(termino) || anio !== "todos" || tipo !== "todo";

  return (
    <AppShell
      currentPath="/clientes"
      compact
      badge="Vehículo"
      title={vehiculo ? `${vehiculo.marca} ${vehiculo.modelo}` : "Historial del vehículo"}
      description={vehiculo ? `Historial de ${vehiculo.patente}: qué se le hizo y cuándo.` : "Recuperando el historial del vehículo."}
      actions={
        <div className="flex items-center gap-2">
          <Link href={vehiculo ? `/clientes?id=${vehiculo.cliente_id}` : "/clientes"} className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
            ← Volver al cliente
          </Link>
          {vehiculo && (
            <Link href={`/trabajos/nuevo?vehiculo=${vehiculo.id}`} className="inline-flex h-9 items-center rounded-xl bg-brand-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700">
              + Nueva orden
            </Link>
          )}
        </div>
      }
    >
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">{error}</div>
      ) : !historial || !vehiculo ? (
        <div className="flex justify-center py-24"><div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600 dark:border-slate-700" /></div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
          {/* ══ Columna izquierda: el auto ══ */}
          <aside className="space-y-4 lg:sticky lg:top-20">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <Patente valor={vehiculo.patente} className="text-base" />
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                {[vehiculo.anio, vehiculo.color].filter(Boolean).join(" · ")}
                {(vehiculo.anio || vehiculo.color) && " · "}
                <Link href={`/clientes?id=${vehiculo.cliente_id}`} className="font-semibold text-slate-900 hover:text-brand-600 dark:text-white">{vehiculo.cliente_nombre}</Link>
              </p>
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-slate-100 pt-4 dark:border-slate-700">
                <Cifra etiqueta="Kilometraje" valor={`${formatNumber(vehiculo.kilometraje_actual)} km`} />
                <Cifra
                  etiqueta="Próximo service"
                  valor={vehiculo.proximo_service_km ? `${formatNumber(vehiculo.proximo_service_km)} km` : "—"}
                  detalle={faltanKm === null ? "Sin programar" : faltanKm < 0 ? `Vencido hace ${formatNumber(-faltanKm)} km` : `Faltan ${formatNumber(faltanKm)} km`}
                  tono={faltanKm === null ? undefined : faltanKm < 0 ? "rojo" : faltanKm <= 1500 ? "ambar" : undefined}
                />
                <Cifra etiqueta="Visitas" valor={String(visitas.length)} detalle={visitas.length ? `Desde ${fechaDe(visitas[visitas.length - 1]).getFullYear()}` : undefined} />
                {totalGastado > 0 && <Cifra etiqueta="Facturado" valor={formatCurrency(totalGastado)} />}
              </dl>
              {recomendacion && (
                <div className="mt-4 rounded-xl bg-amber-50 px-3.5 py-3 text-sm dark:bg-amber-950/30">
                  <p className="text-xs font-semibold text-amber-900 dark:text-amber-200">
                    Para el próximo service{recomendacion.proximo_control_km ? ` · ${formatNumber(recomendacion.proximo_control_km)} km` : ""}
                  </p>
                  <p className="mt-0.5 text-amber-800 dark:text-amber-300">{recomendacion.recomendaciones_proximo_service}</p>
                </div>
              )}
            </section>

            {ultimosCambios.length > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:text-white">Últimos cambios</h2>
                <ul className="max-h-80 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-700/60">
                  {ultimosCambios.map((c) => (
                    <li key={c.descripcion}>
                      <button
                        type="button"
                        onClick={() => { setBusqueda(c.descripcion); setAnio("todos"); setTipo("todo"); }}
                        className="flex w-full items-center justify-between gap-3 px-5 py-2.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-700/30"
                        title="Ver las visitas donde se hizo"
                      >
                        <span className="flex min-w-0 items-center gap-2">
                          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", c.repuesto ? "bg-sky-500" : "bg-slate-400")} aria-hidden="true" />
                          <span className="truncate text-sm text-slate-800 dark:text-slate-100">{c.descripcion}</span>
                        </span>
                        <span className="shrink-0 text-right text-[11px] leading-tight text-slate-500 dark:text-slate-400">
                          {c.fecha.toLocaleDateString("es-AR", { month: "short", year: "numeric" }).replace(".", "")}
                          <span className="block tabular-nums text-slate-400">{formatNumber(c.km)} km</span>
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </aside>

          {/* ══ Columna derecha: las visitas ══ */}
          <div className="min-w-0 space-y-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="relative w-full xl:max-w-sm">
                <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" /></svg>
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Buscar en lo que se hizo: aceite, pastillas…"
                  aria-label="Buscar en el historial"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-9 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
                {busqueda && (
                  <button type="button" onClick={() => setBusqueda("")} aria-label="Borrar búsqueda" className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700">×</button>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {anios.length > 1 && (
                  <div className="flex gap-1" role="toolbar" aria-label="Filtrar por año">
                    {(["todos", ...anios] as const).map((a) => (
                      <Pastilla key={a} activa={anio === a} onClick={() => setAnio(a)}>{a === "todos" ? "Todos los años" : a}</Pastilla>
                    ))}
                  </div>
                )}
                <div className="flex rounded-full bg-slate-100 p-0.5 dark:bg-slate-800" role="toolbar" aria-label="Qué mostrar">
                  {([["todo", "Todo"], ["trabajos", "Trabajos"], ["repuestos", "Repuestos"]] as const).map(([valor, texto]) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => setTipo(valor)}
                      aria-pressed={tipo === valor}
                      className={cn("h-8 rounded-full px-3 text-xs font-semibold transition", tipo === valor ? "bg-white text-slate-900 shadow-sm dark:bg-slate-600 dark:text-white" : "text-slate-600 hover:text-slate-900 dark:text-slate-300")}
                    >
                      {texto}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="hidden grid-cols-[96px_88px_minmax(0,1fr)_170px_110px] gap-4 border-b border-slate-100 bg-slate-50/80 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400 xl:grid">
                <span>Fecha</span>
                <span>Km</span>
                <span>Qué se hizo</span>
                <span>Orden</span>
                <span className="text-right">Importe</span>
              </div>

              {visitas.length === 0 ? (
                <div className="px-6 py-14 text-center">
                  <p className="font-semibold text-slate-700 dark:text-slate-200">Todavía no hay trabajos para este vehículo.</p>
                  <Link href={`/trabajos/nuevo?vehiculo=${vehiculo.id}`} className="mt-3 inline-block text-sm font-semibold text-brand-600">Registrar el primer ingreso →</Link>
                </div>
              ) : porAnio.length === 0 ? (
                <div className="px-6 py-14 text-center">
                  <p className="font-semibold text-slate-700 dark:text-slate-200">Nada coincide con esos filtros.</p>
                  <button type="button" onClick={() => { setBusqueda(""); setAnio("todos"); setTipo("todo"); }} className="mt-2 text-sm font-semibold text-brand-600">Ver todo el historial</button>
                </div>
              ) : (
                porAnio.map((grupo) => (
                  <div key={grupo.anio}>
                    <p className="border-b border-slate-100 bg-slate-50/60 px-5 py-2 text-xs font-semibold text-slate-500 dark:border-slate-700 dark:bg-slate-900/30 dark:text-slate-400">
                      <span className="font-display text-base font-extrabold text-slate-900 dark:text-white">{grupo.anio}</span>
                      <span className="ml-2">{grupo.visitas.length} {grupo.visitas.length === 1 ? "visita" : "visitas"}</span>
                    </p>
                    <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
                      {grupo.visitas.map((t) => <FilaVisita key={t.id} trabajo={t} tipo={tipo} termino={termino} />)}
                    </ul>
                  </div>
                ))
              )}
              {hayFiltro && porAnio.length > 0 && (
                <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  {filtradas.length} de {visitas.length} visitas ·{" "}
                  <button type="button" onClick={() => { setBusqueda(""); setAnio("todos"); setTipo("todo"); }} className="font-semibold text-brand-600">Quitar filtros</button>
                </p>
              )}
            </section>

            {historial.presupuestos.length > 0 && (
              <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
                <h2 className="border-b border-slate-100 px-5 py-3 text-sm font-semibold text-slate-900 dark:border-slate-700 dark:text-white">
                  Presupuestos <span className="ml-1 text-xs font-medium text-slate-400">{historial.presupuestos.length}</span>
                </h2>
                <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {historial.presupuestos.map((p) => (
                    <li key={p.id}>
                      <Link href={`/presupuestos/${p.id}`} className="flex items-center justify-between gap-4 px-5 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-700/30">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-900 dark:text-white">{p.resumen || "Sin detalle"}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{formatDate(p.fecha_creacion)} · {numeroPresupuesto(p.id)}</p>
                        </div>
                        <span className="flex shrink-0 items-center gap-3">
                          <StatusBadge status={p.estado} />
                          <span className="text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{formatCurrency(p.total)}</span>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Cifra({ etiqueta, valor, detalle, tono }: { etiqueta: string; valor: string; detalle?: string; tono?: "rojo" | "ambar" }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500 dark:text-slate-400">{etiqueta}</dt>
      <dd className="mt-1 truncate font-display text-xl font-extrabold leading-none tabular-nums text-slate-900 dark:text-white">{valor}</dd>
      {detalle && (
        <dd className={cn("mt-1 text-[11px] font-medium", tono === "rojo" ? "text-red-600 dark:text-red-400" : tono === "ambar" ? "text-amber-700 dark:text-amber-400" : "text-slate-500 dark:text-slate-400")}>
          {detalle}
        </dd>
      )}
    </div>
  );
}

function Pastilla({ activa, onClick, children }: { activa: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activa}
      className={cn("h-8 rounded-full px-3 text-xs font-semibold transition", activa ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800")}
    >
      {children}
    </button>
  );
}

/** Una visita en una fila: fecha, km, qué se hizo (con sus tareas) y la orden. */
function FilaVisita({ trabajo, tipo, termino }: { trabajo: VehiculoHistorialTrabajo; tipo: Tipo; termino: string }) {
  const fecha = fechaDe(trabajo);
  const enTaller = ["INGRESADO", "EN_PROCESO", "FINALIZADO"].includes(trabajo.estado);
  const items = trabajo.items.filter((i) => (tipo === "todo" ? true : tipo === "trabajos" ? esTrabajo(i) : esRepuesto(i)));

  return (
    <li>
      <Link
        href={`/trabajos/${trabajo.id}`}
        className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 px-5 py-3.5 transition hover:bg-slate-50 dark:hover:bg-slate-700/30 xl:grid-cols-[96px_88px_minmax(0,1fr)_170px_110px] xl:items-start"
      >
        <p className="text-sm font-semibold text-slate-900 dark:text-white">
          {fecha.toLocaleDateString("es-AR", { day: "numeric", month: "short" }).replace(".", "")}
          <span className="font-normal text-slate-500 xl:hidden"> · {formatNumber(trabajo.kilometraje)} km</span>
        </p>
        <p className="hidden text-sm tabular-nums text-slate-600 dark:text-slate-300 xl:block">{formatNumber(trabajo.kilometraje)}</p>

        <div className="col-span-2 min-w-0 xl:col-span-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            {enTaller && <span className="mr-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">En el taller</span>}
            {trabajo.resumen || "Trabajo sin descripción"}
          </p>
          {items.length > 0 && (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {items.map((item, i) => {
                const coincide = termino && normalizar(item.descripcion).includes(termino);
                return (
                  <li
                    key={`${item.descripcion}-${i}`}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-xs",
                      coincide
                        ? "bg-brand-100 font-semibold text-brand-800 ring-1 ring-brand-300 dark:bg-brand-900/40 dark:text-brand-200 dark:ring-brand-800"
                        : esRepuesto(item) ? "bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300" : "bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200",
                      !item.completado && "opacity-60",
                    )}
                    title={item.completado ? undefined : "Pendiente"}
                  >
                    {item.completado && <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>}
                    {item.descripcion}
                    {item.cantidad > 1 && <span className="opacity-70">×{formatNumber(item.cantidad)}</span>}
                  </li>
                );
              })}
            </ul>
          )}
          {trabajo.recomendaciones_proximo_service && (
            <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400"><span className="font-semibold text-slate-700 dark:text-slate-300">Recomendado:</span> {trabajo.recomendaciones_proximo_service}</p>
          )}
        </div>

        <div className="row-start-1 col-start-2 flex flex-col items-end gap-1 xl:col-start-auto xl:row-start-auto xl:items-start">
          <span className="flex items-center gap-2">
            <span className="font-mono text-xs text-slate-500">{numeroOrden(trabajo.id)}</span>
            <StatusBadge status={trabajo.estado} />
          </span>
          {trabajo.responsable_nombre && <span className="hidden text-xs text-slate-500 dark:text-slate-400 xl:block">{trabajo.responsable_nombre.split(" ")[0]}</span>}
        </div>

        <p className="hidden text-right font-display text-lg font-extrabold leading-none tabular-nums text-slate-900 dark:text-white xl:block">
          {trabajo.total > 0 ? formatCurrency(trabajo.total) : ""}
        </p>
      </Link>
    </li>
  );
}
