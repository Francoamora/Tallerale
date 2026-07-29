"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import {
  getMovimientosCaja,
  getResumenCaja,
  type CajaResumen,
  type MovimientoCaja,
} from "@/lib/api";
import { HintBubble } from "@/components/hint-bubble";
import { formatCurrency, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";

const METODOS = [
  { value: "", label: "Todos los medios" },
  { value: "EFECTIVO", label: "Efectivo" },
  { value: "TRANSFERENCIA", label: "Transferencia" },
  { value: "TARJETA", label: "Tarjeta" },
  { value: "CHEQUE", label: "Cheque" },
];

const resumenVacio: CajaResumen = {
  ingresos: 0,
  egresos: 0,
  resultado: 0,
  cantidad_movimientos: 0,
};

function fechaLocal(fecha = new Date()) {
  const offset = fecha.getTimezoneOffset();
  return new Date(fecha.getTime() - offset * 60_000).toISOString().slice(0, 10);
}

function inicioMesActual() {
  const hoy = new Date();
  return fechaLocal(new Date(hoy.getFullYear(), hoy.getMonth(), 1));
}

export default function CajaDiaria() {
  const [vista, setVista] = useState<"hoy" | "historial">("hoy");
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [resumen, setResumen] = useState<CajaResumen>(resumenVacio);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [desde, setDesde] = useState(inicioMesActual);
  const [hasta, setHasta] = useState(() => fechaLocal());
  const [metodo, setMetodo] = useState("");

  const periodo = useMemo(() => {
    if (vista === "hoy") {
      const hoy = fechaLocal();
      return { fecha_desde: hoy, fecha_hasta: hoy, metodo };
    }
    return { fecha_desde: desde, fecha_hasta: hasta, metodo };
  }, [desde, hasta, metodo, vista]);

  const cargarCaja = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [lista, totales] = await Promise.all([
        getMovimientosCaja(periodo),
        getResumenCaja(periodo),
      ]);
      setMovimientos(lista);
      setResumen(totales);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos cargar los movimientos.");
    } finally {
      setLoading(false);
    }
  }, [periodo]);

  useEffect(() => {
    cargarCaja();
  }, [cargarCaja]);

  return (
    <AppShell
      currentPath="/caja"
      badge="Tesorería"
      title="Caja y movimientos"
      description="Entradas y salidas reales, separadas por período y medio de pago."
      actions={
        <div className="flex items-center gap-2">
          <Link
            href="/gastos?nuevo=1"
            className="inline-flex items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            − Nuevo gasto
          </Link>
          <Link
            href="/pagos/registrar"
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
          >
            ＋ Registrar cobro
          </Link>
        </div>
      }
    >
      <div className="space-y-4">
        <section className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-900">
            <button
              onClick={() => setVista("hoy")}
              className={cn(
                "rounded-lg px-5 py-2 text-sm font-bold transition",
                vista === "hoy"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                  : "text-slate-500 dark:text-slate-400",
              )}
            >
              Caja de hoy
            </button>
            <button
              onClick={() => setVista("historial")}
              className={cn(
                "rounded-lg px-5 py-2 text-sm font-bold transition",
                vista === "historial"
                  ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white"
                  : "text-slate-500 dark:text-slate-400",
              )}
            >
              Historial
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {vista === "historial" && (
              <>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Desde</span>
                  <input type="date" value={desde} max={hasta} onChange={(event) => setDesde(event.target.value)} className="bg-transparent text-xs font-semibold text-slate-700 outline-none dark:text-slate-200" />
                </label>
                <label className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-700 dark:bg-slate-900">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Hasta</span>
                  <input type="date" value={hasta} min={desde} onChange={(event) => setHasta(event.target.value)} className="bg-transparent text-xs font-semibold text-slate-700 outline-none dark:text-slate-200" />
                </label>
              </>
            )}
            <select
              value={metodo}
              onChange={(event) => setMetodo(event.target.value)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              aria-label="Filtrar medio de pago"
            >
              {METODOS.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
            </select>
            <button onClick={cargarCaja} className="grid h-10 w-10 place-items-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900" aria-label="Actualizar movimientos">
              ↻
            </button>
          </div>
        </section>

        {error && (
          <div role="alert" className="flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
            <span>{error}</span>
            <button onClick={cargarCaja} className="underline">Reintentar</button>
          </div>
        )}

        {!loading && !error && movimientos.length === 0 && vista === "hoy" && (
          <HintBubble
            id="hint-caja-v2"
            variant="banner"
            emoji="💰"
            title="Empezá a mover la caja de hoy"
            desc="Registrá un cobro o un gasto. El resultado del día se actualizará automáticamente."
            action={{ label: "Registrar cobro", href: "/pagos/registrar" }}
          />
        )}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Ingresos" value={formatCurrency(resumen.ingresos)} detail={vista === "hoy" ? "Cobros recibidos hoy" : "Cobros del período"} tone="green" />
          <Kpi label="Egresos" value={formatCurrency(resumen.egresos)} detail={vista === "hoy" ? "Gastos registrados hoy" : "Gastos del período"} tone="red" />
          <Kpi
            label="Resultado"
            value={formatCurrency(resumen.resultado)}
            detail={resumen.resultado >= 0 ? "Entradas menos salidas" : "Las salidas superan las entradas"}
            tone={resumen.resultado >= 0 ? "dark" : "red"}
          />
          <Kpi label="Movimientos" value={String(resumen.cantidad_movimientos)} detail={metodo ? METODOS.find((item) => item.value === metodo)?.label ?? metodo : "Todos los medios de pago"} />
        </section>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-4 dark:border-slate-700 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white">
                {vista === "hoy" ? "Movimientos de hoy" : "Libro de movimientos"}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {vista === "hoy" ? "Actividad financiera de la jornada." : `${desde} — ${hasta}`}
              </p>
            </div>
            <div className="flex items-center gap-4 text-[11px] font-semibold text-slate-400">
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-500" /> Ingreso</span>
              <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-red-500" /> Egreso</span>
            </div>
          </div>

          {/* Tabla — desktop/tablet. En mobile 4 columnas no entran y obligaba
              a scrollear horizontal para leer cada movimiento. */}
          <div className="hidden overflow-x-auto sm:block">
            <table className="min-w-[720px] w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-[0.16em] text-slate-400 dark:border-slate-700">
                  <th className="px-5 py-3">Fecha y hora</th>
                  <th className="py-3">Movimiento</th>
                  <th className="py-3">Medio</th>
                  <th className="px-5 py-3 text-right">Importe</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/70">
                {loading ? (
                  Array.from({ length: 4 }).map((_, index) => (
                    <tr key={index} className="animate-pulse">
                      <td colSpan={4} className="px-5 py-4"><div className="h-5 rounded bg-slate-100 dark:bg-slate-700" /></td>
                    </tr>
                  ))
                ) : movimientos.length ? (
                  movimientos.map((movimiento) => (
                    <tr key={movimiento.id} className="transition hover:bg-slate-50/80 dark:hover:bg-slate-900/30">
                      <td className="whitespace-nowrap px-5 py-3 text-xs text-slate-500 dark:text-slate-400">{formatDateTime(movimiento.fecha)}</td>
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <span className={cn("grid h-8 w-8 place-items-center rounded-lg text-sm font-black", movimiento.tipo === "INGRESO" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30" : "bg-red-50 text-red-600 dark:bg-red-950/30")}>
                            {movimiento.tipo === "INGRESO" ? "↘" : "↗"}
                          </span>
                          <div>
                            <p className="font-semibold text-slate-800 dark:text-slate-100">{movimiento.concepto}</p>
                            <p className="text-[10px] uppercase tracking-wider text-slate-400">{movimiento.id}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3">
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-700 dark:text-slate-300">{movimiento.metodo}</span>
                      </td>
                      <td className={cn("px-5 py-3 text-right font-mono font-black", movimiento.tipo === "INGRESO" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                        {movimiento.tipo === "INGRESO" ? "+" : "−"} {formatCurrency(movimiento.monto)}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="px-5 py-14 text-center">
                      <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-700">↕</div>
                      <p className="font-semibold text-slate-700 dark:text-slate-200">No hay movimientos en este período</p>
                      <p className="mt-1 text-xs text-slate-400">Cambiá las fechas o registrá una nueva operación.</p>
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
            ) : movimientos.length ? (
              movimientos.map((movimiento) => (
                <div key={movimiento.id} className="flex items-center gap-3 px-5 py-3.5">
                  <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-black", movimiento.tipo === "INGRESO" ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/30" : "bg-red-50 text-red-600 dark:bg-red-950/30")}>
                    {movimiento.tipo === "INGRESO" ? "↘" : "↗"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-800 dark:text-slate-100">{movimiento.concepto}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-slate-400">
                      {formatDateTime(movimiento.fecha)}
                      <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-700 dark:text-slate-300">{movimiento.metodo}</span>
                    </p>
                  </div>
                  <p className={cn("shrink-0 font-mono font-black", movimiento.tipo === "INGRESO" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
                    {movimiento.tipo === "INGRESO" ? "+" : "−"} {formatCurrency(movimiento.monto)}
                  </p>
                </div>
              ))
            ) : (
              <div className="px-5 py-14 text-center">
                <div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-slate-100 text-slate-400 dark:bg-slate-700">↕</div>
                <p className="font-semibold text-slate-700 dark:text-slate-200">No hay movimientos en este período</p>
                <p className="mt-1 text-xs text-slate-400">Cambiá las fechas o registrá una nueva operación.</p>
              </div>
            )}
          </div>
          {movimientos.length >= 200 && (
            <p className="border-t border-slate-100 px-5 py-3 text-center text-xs text-amber-600 dark:border-slate-700 dark:text-amber-400">
              Se muestran los 200 movimientos más recientes del período.
            </p>
          )}
        </section>

        <p className="px-1 text-[11px] leading-5 text-slate-400">
          El resultado representa ingresos menos egresos del período seleccionado. No equivale a una conciliación bancaria ni al dinero contado físicamente.
        </p>
      </div>
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
  tone?: "default" | "green" | "red" | "dark";
}) {
  return (
    <article
      className={cn(
        "rounded-2xl border px-5 py-4 shadow-sm",
        tone === "green" && "border-emerald-200 bg-emerald-50 dark:border-emerald-900/40 dark:bg-emerald-950/20",
        tone === "red" && "border-red-200 bg-red-50 dark:border-red-900/40 dark:bg-red-950/20",
        tone === "dark" && "border-slate-900 bg-slate-900 dark:border-brand-600 dark:bg-brand-600",
        tone === "default" && "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800",
      )}
    >
      <p className={cn("text-[10px] font-black uppercase tracking-[0.16em]", tone === "dark" ? "text-white/60" : "text-slate-400")}>{label}</p>
      <p
        className={cn(
          "mt-1.5 font-mono text-2xl font-black",
          tone === "green" && "text-emerald-600 dark:text-emerald-400",
          tone === "red" && "text-red-600 dark:text-red-400",
          tone === "dark" && "text-white",
          tone === "default" && "text-slate-900 dark:text-white",
        )}
      >
        {value}
      </p>
      <p className={cn("mt-1 truncate text-[11px]", tone === "dark" ? "text-white/55" : "text-slate-400")}>{detail}</p>
    </article>
  );
}
