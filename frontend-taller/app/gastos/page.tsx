"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  crearGasto,
  getGastos,
  getResumenGastos,
  type GastosResumen,
} from "@/lib/api";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { Gasto } from "@/lib/types";
import { cn } from "@/lib/utils";

const TIPOS_GASTO = [
  { value: "REPUESTOS", label: "Repuestos", short: "R" },
  { value: "INSUMOS", label: "Insumos", short: "I" },
  { value: "SERVICIOS", label: "Servicios", short: "S" },
  { value: "OTROS", label: "Otros", short: "O" },
];

const METODOS = [
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "TARJETA", label: "Tarjeta" },
  { value: "CHEQUE", label: "Cheque" },
];

const TIPO_BADGE: Record<string, string> = {
  REPUESTOS: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800/50 dark:bg-blue-900/20 dark:text-blue-300",
  INSUMOS: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300",
  SERVICIOS: "border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-800/50 dark:bg-violet-900/20 dark:text-violet-300",
  OTROS: "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-700 dark:text-slate-300",
};

const inputBase =
  "w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white";

function fechaLocal(fecha = new Date()) {
  const offset = fecha.getTimezoneOffset();
  return new Date(fecha.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function inicioMesActual() {
  const hoy = new Date();
  return fechaLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
}

const resumenVacio: GastosResumen = {
  mes_actual: 0,
  mes_anterior: 0,
  total_periodo: 0,
  cantidad_periodo: 0,
  por_tipo: [],
};

export default function GastosPage() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [resumen, setResumen] = useState<GastosResumen>(resumenVacio);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [mensaje, setMensaje] = useState<{ text: string; error?: boolean } | null>(null);

  const [desde, setDesde] = useState(inicioMesActual);
  const [hasta, setHasta] = useState(() => fechaLocal());
  const [filtroTipo, setFiltroTipo] = useState("");
  const [filtroMetodo, setFiltroMetodo] = useState("");
  const [buscar, setBuscar] = useState("");

  const [tipo, setTipo] = useState("REPUESTOS");
  const [descripcion, setDescripcion] = useState("");
  const [monto, setMonto] = useState("");
  const [comprobante, setComprobante] = useState("");
  const [metodo, setMetodo] = useState("EFECTIVO");
  const [fecha, setFecha] = useState(() => fechaLocal());
  const [isSaving, setIsSaving] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [lista, totales] = await Promise.all([
        getGastos({
          fecha_desde: desde,
          fecha_hasta: hasta,
          tipo: filtroTipo,
          metodo: filtroMetodo,
          buscar: buscar.trim(),
        }),
        getResumenGastos({ fecha_desde: desde, fecha_hasta: hasta }),
      ]);
      setGastos(lista);
      setResumen(totales);
    } catch (error) {
      setMensaje({
        text: error instanceof Error ? error.message : "No pudimos cargar los gastos.",
        error: true,
      });
    } finally {
      setLoading(false);
    }
  }, [buscar, desde, filtroMetodo, filtroTipo, hasta]);

  useEffect(() => {
    const timer = window.setTimeout(cargar, 250);
    return () => window.clearTimeout(timer);
  }, [cargar]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("nuevo") === "1") {
      setShowForm(true);
    }
  }, []);

  useEffect(() => {
    if (!mensaje) return;
    const timer = window.setTimeout(() => setMensaje(null), 3500);
    return () => window.clearTimeout(timer);
  }, [mensaje]);

  const variacionMes = useMemo(() => {
    if (resumen.mes_anterior === 0) return null;
    return ((resumen.mes_actual - resumen.mes_anterior) / resumen.mes_anterior) * 100;
  }, [resumen]);

  const totalesPorTipo = useMemo(
    () =>
      TIPOS_GASTO.map((item) => ({
        ...item,
        total: resumen.por_tipo.find((dato) => dato.tipo === item.value)?.total ?? 0,
      })),
    [resumen.por_tipo],
  );

  function cerrarFormulario() {
    setShowForm(false);
    window.history.replaceState({}, "", "/gastos");
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!descripcion.trim() || !monto || Number(monto) <= 0) {
      setMensaje({ text: "Completá una descripción y un importe válido.", error: true });
      return;
    }

    setIsSaving(true);
    try {
      await crearGasto({
        tipo,
        descripcion: descripcion.trim(),
        monto: Number(monto),
        comprobante: comprobante.trim(),
        metodo_pago: metodo,
        fecha,
      });
      setDescripcion("");
      setMonto("");
      setComprobante("");
      setFecha(fechaLocal());
      cerrarFormulario();
      setMensaje({ text: "Gasto registrado y reflejado en Caja." });
      await cargar();
    } catch (error) {
      setMensaje({
        text: error instanceof Error ? error.message : "No pudimos registrar el gasto.",
        error: true,
      });
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppShell
      currentPath="/gastos"
      badge="Finanzas"
      title="Gastos y compras"
      description="Egresos del taller, ordenados y listos para controlar."
      actions={
        <button
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          <span aria-hidden>＋</span> Nuevo gasto
        </button>
      }
    >
      <div className="space-y-4">
        {mensaje && (
          <div
            role="status"
            className={cn(
              "fixed bottom-6 right-6 z-[70] max-w-sm rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-2xl",
              mensaje.error ? "bg-red-600" : "bg-emerald-600",
            )}
          >
            {mensaje.text}
          </div>
        )}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi
            label="Gastos del mes"
            value={formatCurrency(resumen.mes_actual)}
            detail={
              variacionMes === null
                ? "Sin comparación anterior"
                : `${variacionMes >= 0 ? "↑" : "↓"} ${Math.abs(variacionMes).toFixed(0)}% vs. mes anterior`
            }
            tone="red"
          />
          <Kpi label="Período seleccionado" value={formatCurrency(resumen.total_periodo)} detail={`${desde} — ${hasta}`} />
          <Kpi label="Movimientos" value={String(resumen.cantidad_periodo)} detail="Egresos en el período" />
          <Kpi
            label="Promedio por gasto"
            value={formatCurrency(resumen.cantidad_periodo ? resumen.total_periodo / resumen.cantidad_periodo : 0)}
            detail="Importe medio registrado"
          />
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_160px_170px_145px_145px]">
            <label className="relative">
              <span className="sr-only">Buscar gasto</span>
              <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
              </svg>
              <input
                value={buscar}
                onChange={(event) => setBuscar(event.target.value)}
                placeholder="Buscar descripción o comprobante"
                className={cn(inputBase, "pl-10")}
              />
            </label>
            <select value={filtroTipo} onChange={(event) => setFiltroTipo(event.target.value)} className={inputBase} aria-label="Filtrar por categoría">
              <option value="">Todas las categorías</option>
              {TIPOS_GASTO.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <select value={filtroMetodo} onChange={(event) => setFiltroMetodo(event.target.value)} className={inputBase} aria-label="Filtrar por método">
              <option value="">Todos los medios</option>
              {METODOS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <input type="date" value={desde} max={hasta} onChange={(event) => setDesde(event.target.value)} className={inputBase} aria-label="Desde" />
            <input type="date" value={hasta} min={desde} onChange={(event) => setHasta(event.target.value)} className={inputBase} aria-label="Hasta" />
          </div>
        </section>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700">
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white">Registro de gastos</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Hasta 200 resultados del filtro actual.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                {gastos.length}
              </span>
            </div>

            {/* Tabla — desktop/tablet. En mobile una tabla de 5 columnas no entra
                y obligaba a scrollear horizontal para leer cada gasto. */}
            <div className="hidden overflow-x-auto sm:block">
              <table className="min-w-[760px] w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-[0.14em] text-slate-400 dark:border-slate-700">
                    <th className="px-5 py-3">Fecha</th>
                    <th className="py-3">Detalle</th>
                    <th className="py-3">Categoría</th>
                    <th className="py-3">Medio</th>
                    <th className="px-5 py-3 text-right">Importe</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/70">
                  {loading ? (
                    Array.from({ length: 4 }).map((_, index) => (
                      <tr key={index} className="animate-pulse">
                        <td colSpan={5} className="px-5 py-4"><div className="h-5 rounded bg-slate-100 dark:bg-slate-700" /></td>
                      </tr>
                    ))
                  ) : gastos.length ? (
                    gastos.map((gasto) => (
                      <tr key={gasto.id} className="transition hover:bg-slate-50/80 dark:hover:bg-slate-900/30">
                        <td className="whitespace-nowrap px-5 py-3 text-xs text-slate-500 dark:text-slate-400">
                          {formatDateTime(gasto.fecha).split(",")[0]}
                        </td>
                        <td className="max-w-sm py-3">
                          <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{gasto.descripcion}</p>
                          <p className="mt-0.5 text-[11px] text-slate-400">
                            {gasto.comprobante || "Sin comprobante"} · {gasto.registrado_por}
                          </p>
                        </td>
                        <td className="py-3">
                          <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider", TIPO_BADGE[gasto.tipo] ?? TIPO_BADGE.OTROS)}>
                            {TIPOS_GASTO.find((item) => item.value === gasto.tipo)?.label ?? gasto.tipo}
                          </span>
                        </td>
                        <td className="py-3 text-xs font-medium text-slate-500 dark:text-slate-300">
                          {METODOS.find((item) => item.value === gasto.metodo_pago)?.label ?? gasto.metodo_pago}
                        </td>
                        <td className="px-5 py-3 text-right font-mono font-black text-red-600 dark:text-red-400">
                          − {formatCurrency(gasto.monto)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-5 py-14 text-center">
                        <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-700">↙</div>
                        <p className="font-semibold text-slate-700 dark:text-slate-200">No encontramos gastos</p>
                        <p className="mt-1 text-xs text-slate-400">Probá otro período o registrá el primer egreso.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Tarjetas — mobile */}
            <div className="divide-y divide-slate-100 dark:divide-slate-700/70 sm:hidden">
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="animate-pulse px-5 py-4">
                    <div className="h-5 rounded bg-slate-100 dark:bg-slate-700" />
                  </div>
                ))
              ) : gastos.length ? (
                gastos.map((gasto) => (
                  <div key={gasto.id} className="px-5 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{gasto.descripcion}</p>
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {formatDateTime(gasto.fecha).split(",")[0]} · {gasto.comprobante || "Sin comprobante"}
                        </p>
                      </div>
                      <p className="shrink-0 font-mono font-black text-red-600 dark:text-red-400">
                        − {formatCurrency(gasto.monto)}
                      </p>
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-2">
                      <span className={cn("inline-flex rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider", TIPO_BADGE[gasto.tipo] ?? TIPO_BADGE.OTROS)}>
                        {TIPOS_GASTO.find((item) => item.value === gasto.tipo)?.label ?? gasto.tipo}
                      </span>
                      <span className="text-[11px] font-medium text-slate-500 dark:text-slate-300">
                        {METODOS.find((item) => item.value === gasto.metodo_pago)?.label ?? gasto.metodo_pago}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="px-5 py-14 text-center">
                  <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-700">↙</div>
                  <p className="font-semibold text-slate-700 dark:text-slate-200">No encontramos gastos</p>
                  <p className="mt-1 text-xs text-slate-400">Probá otro período o registrá el primer egreso.</p>
                </div>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h2 className="font-bold text-slate-900 dark:text-white">Distribución</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Por categoría en el período.</p>
            <div className="mt-5 space-y-4">
              {totalesPorTipo.map((item) => {
                const porcentaje = resumen.total_periodo ? (item.total / resumen.total_periodo) * 100 : 0;
                return (
                  <div key={item.value}>
                    <div className="flex items-center justify-between gap-3 text-xs">
                      <span className="font-semibold text-slate-600 dark:text-slate-300">{item.label}</span>
                      <span className="font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(item.total)}</span>
                    </div>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                      <div className="h-full rounded-full bg-brand-500 transition-all" style={{ width: `${porcentaje}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 z-[60] flex justify-end bg-slate-950/50 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="Registrar gasto">
          <button className="absolute inset-0 cursor-default" onClick={cerrarFormulario} aria-label="Cerrar formulario" />
          <aside className="relative h-full w-full max-w-xl overflow-y-auto border-l border-slate-200 bg-slate-50 p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-950 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-600">Nuevo movimiento</p>
                <h2 className="mt-1 text-2xl font-black tracking-tight text-slate-900 dark:text-white">Registrar gasto</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">El egreso aparecerá automáticamente en Caja.</p>
              </div>
              <button onClick={cerrarFormulario} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800" aria-label="Cerrar">✕</button>
            </div>

            <form onSubmit={handleSubmit} className="mt-7 space-y-6">
              <fieldset>
                <legend className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">Categoría</legend>
                <div className="grid grid-cols-2 gap-2">
                  {TIPOS_GASTO.map((item) => (
                    <button
                      type="button"
                      key={item.value}
                      onClick={() => setTipo(item.value)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl border p-3 text-left transition",
                        tipo === item.value
                          ? "border-brand-500 bg-brand-50 text-brand-800 ring-2 ring-brand-500/10 dark:bg-brand-950/30 dark:text-brand-200"
                          : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
                      )}
                    >
                      <span className={cn("grid h-8 w-8 place-items-center rounded-lg text-xs font-black", tipo === item.value ? "bg-brand-500 text-white" : "bg-slate-100 dark:bg-slate-800")}>{item.short}</span>
                      <span className="text-sm font-bold">{item.label}</span>
                    </button>
                  ))}
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Importe *</span>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 font-bold text-slate-400">$</span>
                    <input required autoFocus type="number" min="0.01" step="0.01" value={monto} onChange={(event) => setMonto(event.target.value)} placeholder="0,00" className={cn(inputBase, "pl-8 font-mono text-lg font-bold")} />
                  </div>
                </label>
                <label className="space-y-1.5">
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Fecha *</span>
                  <input required type="date" value={fecha} max={fechaLocal()} onChange={(event) => setFecha(event.target.value)} className={inputBase} />
                </label>
              </div>

              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Descripción *</span>
                <input required maxLength={255} value={descripcion} onChange={(event) => setDescripcion(event.target.value)} placeholder="Ej. Filtros y aceite para el service de HHJ 517" className={inputBase} />
              </label>

              <fieldset>
                <legend className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">Medio de pago</legend>
                <div className="grid grid-cols-2 gap-2">
                  {METODOS.map((item) => (
                    <button
                      type="button"
                      key={item.value}
                      onClick={() => setMetodo(item.value)}
                      className={cn(
                        "rounded-xl border px-3 py-2.5 text-sm font-semibold transition",
                        metodo === item.value
                          ? "border-emerald-500 bg-emerald-50 text-emerald-700 ring-2 ring-emerald-500/10 dark:bg-emerald-950/30 dark:text-emerald-300"
                          : "border-slate-200 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300",
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </fieldset>

              <label className="block space-y-1.5">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Comprobante <span className="font-normal text-slate-400">(opcional)</span></span>
                <input maxLength={50} value={comprobante} onChange={(event) => setComprobante(event.target.value)} placeholder="Factura C 0001-000045" className={inputBase} />
              </label>

              <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400">
                Se registrará un egreso de <strong className="text-slate-900 dark:text-white">{formatCurrency(Number(monto) || 0)}</strong> por {METODOS.find((item) => item.value === metodo)?.label.toLowerCase()}.
              </div>

              <div className="flex gap-3">
                <button type="button" onClick={cerrarFormulario} className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">Cancelar</button>
                <button type="submit" disabled={isSaving} className="flex-[1.5] rounded-xl bg-slate-900 px-4 py-3 text-sm font-bold text-white shadow-lg transition hover:bg-slate-800 disabled:opacity-50 dark:bg-brand-600">
                  {isSaving ? "Registrando…" : "Confirmar gasto"}
                </button>
              </div>
            </form>
          </aside>
        </div>
      )}
    </AppShell>
  );
}

function Kpi({
  label,
  value,
  detail,
  tone = "default",
}: {
  label: string;
  value: string;
  detail: string;
  tone?: "default" | "red";
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-400">{label}</p>
      <p className={cn("mt-1.5 font-mono text-2xl font-black", tone === "red" ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-white")}>{value}</p>
      <p className="mt-1 truncate text-[11px] text-slate-400">{detail}</p>
    </article>
  );
}
