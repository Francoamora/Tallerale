"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ExportarContador } from "@/components/exportar-contador";
import { HintBubble } from "@/components/hint-bubble";
import { getMovimientosCaja, getPerfilTaller, getResumenCaja, type CajaResumen, type FiltrosCaja, type MovimientoCaja } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const MEDIOS: Record<string, string> = {
  EFECTIVO: "Efectivo",
  TRANSFERENCIA: "Transferencia",
  TARJETA: "Tarjeta",
  CHEQUE: "Cheque",
  CONTADO: "Contado",
  OTRO: "Otro",
};

const PERIODOS = [
  { value: "hoy", label: "Hoy" },
  { value: "ayer", label: "Ayer" },
  { value: "semana", label: "Esta semana" },
  { value: "mes", label: "Este mes" },
  { value: "mes_pasado", label: "Mes pasado" },
  { value: "personalizado", label: "Elegir fechas" },
] as const;
type Periodo = (typeof PERIODOS)[number]["value"];

const TIPOS = [
  { value: "", label: "Todo" },
  { value: "INGRESO", label: "Entradas" },
  { value: "EGRESO", label: "Salidas" },
] as const;
type Tipo = (typeof TIPOS)[number]["value"];

const resumenVacio: CajaResumen = { ingresos: 0, egresos: 0, resultado: 0, cantidad_movimientos: 0 };

function fechaLocal(fecha = new Date()) {
  return new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function rangoDe(periodo: Periodo, desde: string, hasta: string) {
  const hoy = new Date();
  const d = (y: number, m: number, dia: number) => fechaLocal(new Date(y, m, dia));
  switch (periodo) {
    case "hoy":
      return { desde: fechaLocal(hoy), hasta: fechaLocal(hoy) };
    case "ayer": {
      const ayer = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - 1);
      return { desde: fechaLocal(ayer), hasta: fechaLocal(ayer) };
    }
    case "semana": {
      // De lunes a hoy.
      const lunes = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - ((hoy.getDay() + 6) % 7));
      return { desde: fechaLocal(lunes), hasta: fechaLocal(hoy) };
    }
    case "mes":
      return { desde: d(hoy.getFullYear(), hoy.getMonth(), 1), hasta: fechaLocal(hoy) };
    case "mes_pasado":
      return { desde: d(hoy.getFullYear(), hoy.getMonth() - 1, 1), hasta: d(hoy.getFullYear(), hoy.getMonth(), 0) };
    default:
      return { desde, hasta };
  }
}

function etiquetaDia(clave: string) {
  const [y, m, dia] = clave.split("-").map(Number);
  const fecha = new Date(y, m - 1, dia);
  const hoy = new Date();
  const diff = Math.round((new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime() - fecha.getTime()) / 86_400_000);
  if (diff === 0) return "Hoy";
  if (diff === 1) return "Ayer";
  const texto = fecha.toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" }).replace(",", "");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function hora(valor: string) {
  const f = new Date(valor);
  return `${String(f.getHours()).padStart(2, "0")}:${String(f.getMinutes()).padStart(2, "0")}`;
}

/** Descarga lo que se está viendo como planilla (se abre en Excel). */
function descargarCSV(movimientos: MovimientoCaja[], nombre: string) {
  const filas = [
    ["Fecha", "Hora", "Tipo", "Concepto", "Cliente", "Medio", "Importe"],
    ...movimientos.map((m) => [
      fechaLocal(new Date(m.fecha)),
      hora(m.fecha),
      m.tipo === "INGRESO" ? "Entrada" : "Salida",
      m.detalle || m.concepto,
      m.cliente_nombre || "",
      MEDIOS[m.metodo] ?? m.metodo,
      String(m.tipo === "INGRESO" ? m.monto : -m.monto).replace(".", ","),
    ]),
  ];
  const csv = filas.map((f) => f.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombre}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function CajaDiaria() {
  const params = useSearchParams();
  const clienteInicial = params.get("cliente");

  const [periodo, setPeriodo] = useState<Periodo>(clienteInicial ? "mes" : "hoy");
  const [desde, setDesde] = useState(() => rangoDe("mes", "", "").desde);
  const [hasta, setHasta] = useState(() => fechaLocal());
  const [tipo, setTipo] = useState<Tipo>("");
  const [metodo, setMetodo] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [busquedaActiva, setBusquedaActiva] = useState("");
  const [cliente, setCliente] = useState<{ id: number; nombre: string } | null>(clienteInicial ? { id: Number(clienteInicial), nombre: "" } : null);

  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [resumen, setResumen] = useState<CajaResumen>(resumenVacio);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [paraContador, setParaContador] = useState(false);
  const [contador, setContador] = useState({ telefono: "", taller: "" });

  useEffect(() => {
    getPerfilTaller()
      .then((p) => setContador({ telefono: p.telefono_contador ?? "", taller: p.taller_nombre }))
      .catch(() => {});
  }, []);

  // La búsqueda se manda al dejar de tipear un momento.
  useEffect(() => {
    const t = window.setTimeout(() => setBusquedaActiva(busqueda.trim()), 300);
    return () => window.clearTimeout(t);
  }, [busqueda]);

  const rango = rangoDe(periodo, desde, hasta);
  const filtros: FiltrosCaja = useMemo(
    () => ({
      fecha_desde: rango.desde,
      fecha_hasta: rango.hasta,
      metodo: metodo || undefined,
      tipo: tipo || undefined,
      q: busquedaActiva || undefined,
      cliente_id: cliente?.id,
    }),
    [rango.desde, rango.hasta, metodo, tipo, busquedaActiva, cliente?.id],
  );

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [lista, totales] = await Promise.all([getMovimientosCaja(filtros), getResumenCaja(filtros)]);
      setMovimientos(lista);
      setResumen(totales);
      // Si se llegó con ?cliente=, se completa el nombre del filtro.
      setCliente((actual) => (actual && !actual.nombre ? { ...actual, nombre: lista.find((m) => m.cliente_id === actual.id)?.cliente_nombre || "Cliente" } : actual));
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos cargar los movimientos.");
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, MovimientoCaja[]>();
    for (const m of movimientos) {
      const clave = fechaLocal(new Date(m.fecha));
      mapa.set(clave, [...(mapa.get(clave) ?? []), m]);
    }
    return [...mapa.entries()];
  }, [movimientos]);

  const hayFiltros = Boolean(tipo || metodo || busquedaActiva || cliente);
  const unSoloDia = rango.desde === rango.hasta;
  const textoPeriodo = periodo === "personalizado"
    ? `Del ${new Date(`${rango.desde}T00:00`).toLocaleDateString("es-AR")} al ${new Date(`${rango.hasta}T00:00`).toLocaleDateString("es-AR")}`
    : PERIODOS.find((p) => p.value === periodo)?.label;

  function limpiarFiltros() {
    setTipo("");
    setMetodo("");
    setBusqueda("");
    setCliente(null);
  }

  return (
    <AppShell
      currentPath="/caja"
      compact
      badge="Tesorería"
      title="Caja"
      description="Lo que entró y salió, por período, cliente y medio de pago."
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setParaContador(true)} className="inline-flex h-9 items-center gap-1.5 rounded-xl px-3.5 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0-4-4m4 4 4-4M5 20h14" /></svg>
            Para el contador
          </button>
          <Link href="/gastos?nuevo=1" className="inline-flex h-9 items-center rounded-xl px-3.5 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800">
            − Registrar gasto
          </Link>
          <Link href="/pagos/registrar" className="inline-flex h-9 items-center rounded-xl bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700">
            + Registrar cobro
          </Link>
        </div>
      }
    >
      {/* Período */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="-mx-1 flex min-w-0 gap-1 overflow-x-auto px-1 pb-1 lg:pb-0" role="toolbar" aria-label="Período">
          {PERIODOS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriodo(p.value)}
              aria-pressed={periodo === p.value}
              className={cn(
                "inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-semibold transition",
                periodo === p.value ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
              )}
            >
              {p.label}
            </button>
          ))}
        </div>
        {periodo === "personalizado" && (
          <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            <input type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} aria-label="Desde" className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:[color-scheme:dark]" />
            <span>a</span>
            <input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} aria-label="Hasta" className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:[color-scheme:dark]" />
          </div>
        )}
      </div>

      {/* Números del período */}
      <div className="mt-3 grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 xl:grid-cols-4">
        <Cifra label="Entró" value={formatCurrency(resumen.ingresos)} helper={`${resumen.cantidad_ingresos ?? 0} ${resumen.cantidad_ingresos === 1 ? "cobro" : "cobros"}`} tono="verde" onClick={() => setTipo(tipo === "INGRESO" ? "" : "INGRESO")} activo={tipo === "INGRESO"} />
        <Cifra label="Salió" value={formatCurrency(resumen.egresos)} helper={`${resumen.cantidad_egresos ?? 0} ${resumen.cantidad_egresos === 1 ? "gasto" : "gastos"}`} tono="rojo" onClick={() => setTipo(tipo === "EGRESO" ? "" : "EGRESO")} activo={tipo === "EGRESO"} />
        <Cifra label="Resultado" value={formatCurrency(resumen.resultado)} helper={resumen.resultado >= 0 ? "Entró más de lo que salió" : "Salió más de lo que entró"} tono={resumen.resultado < 0 ? "rojo" : undefined} />
        <div className="border-slate-100 px-5 py-4 dark:border-slate-700 max-xl:border-t xl:border-l">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Por medio de pago</p>
          {resumen.por_medio?.length ? (
            <ul className="mt-1.5 space-y-1">
              {resumen.por_medio.slice(0, 3).map((m) => (
                <li key={m.metodo}>
                  <button type="button" onClick={() => setMetodo(metodo === m.metodo ? "" : m.metodo)} className={cn("flex w-full items-baseline justify-between gap-2 rounded text-left text-sm transition hover:text-slate-900 dark:hover:text-white", metodo === m.metodo ? "font-semibold text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300")}>
                    <span>{MEDIOS[m.metodo] ?? m.metodo}</span>
                    <span className="tabular-nums">{formatCurrency(m.ingresos - m.egresos)}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-sm text-slate-400">Sin movimientos</p>
          )}
        </div>
      </div>

      {/* Buscador y filtros */}
      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-sm">
          <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" /></svg>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar cliente, concepto o importe…"
            aria-label="Buscar movimientos"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-9 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          {busqueda && (
            <button type="button" onClick={() => setBusqueda("")} aria-label="Borrar búsqueda" className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white">×</button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl bg-slate-200/60 p-1 dark:bg-slate-800" role="group" aria-label="Tipo de movimiento">
            {TIPOS.map((t) => (
              <button
                key={t.value}
                type="button"
                onClick={() => setTipo(t.value)}
                aria-pressed={tipo === t.value}
                className={cn("h-8 rounded-lg px-3 text-sm font-semibold transition", tipo === t.value ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400")}
              >
                {t.label}
              </button>
            ))}
          </div>
          <select value={metodo} onChange={(e) => setMetodo(e.target.value)} aria-label="Medio de pago" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <option value="">Todos los medios</option>
            {["EFECTIVO", "TRANSFERENCIA", "TARJETA", "CHEQUE"].map((m) => <option key={m} value={m}>{MEDIOS[m]}</option>)}
          </select>
          {cliente && (
            <span className="inline-flex h-9 items-center gap-1.5 rounded-full bg-brand-50 pl-3 pr-1.5 text-sm font-semibold text-brand-800 ring-1 ring-inset ring-brand-200 dark:bg-brand-950/30 dark:text-brand-200 dark:ring-brand-900">
              Cliente: {cliente.nombre || "…"}
              <button type="button" onClick={() => setCliente(null)} aria-label="Quitar filtro de cliente" className="flex h-6 w-6 items-center justify-center rounded-full hover:bg-brand-100 dark:hover:bg-brand-900/50">×</button>
            </span>
          )}
          {hayFiltros && (
            <button type="button" onClick={limpiarFiltros} className="h-9 rounded-lg px-2.5 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
          {error}
          <button type="button" onClick={() => void cargar()} className="font-semibold underline">Reintentar</button>
        </div>
      )}

      {!loading && !error && movimientos.length === 0 && periodo === "hoy" && !hayFiltros && (
        <div className="mt-4">
          <HintBubble
            id="hint-caja-v2"
            variant="banner"
            title="Empezá a mover la caja de hoy"
            desc="Registrá un cobro o un gasto. El resultado del día se actualiza solo."
            action={{ label: "Registrar cobro", href: "/pagos/registrar" }}
          />
        </div>
      )}

      {/* Movimientos */}
      <section className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 dark:border-slate-700">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-white">{textoPeriodo}</span>
            {" · "}
            {loading ? "Cargando…" : `${movimientos.length} ${movimientos.length === 1 ? "movimiento" : "movimientos"}`}
          </p>
          {movimientos.length > 0 && (
            <button
              type="button"
              onClick={() => descargarCSV(movimientos, `caja-${rango.desde}${unSoloDia ? "" : `-a-${rango.hasta}`}`)}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0-4-4m4 4 4-4M5 20h14" /></svg>
              Descargar Excel
            </button>
          )}
        </header>

        {loading ? (
          <div className="space-y-2 p-4">{[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-700/50" />)}</div>
        ) : movimientos.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="font-semibold text-slate-700 dark:text-slate-200">{hayFiltros ? "Nada coincide con esos filtros." : "No hubo movimientos en este período."}</p>
            {hayFiltros && <button type="button" onClick={limpiarFiltros} className="mt-2 text-sm font-semibold text-brand-700 dark:text-brand-300">Limpiar filtros</button>}
          </div>
        ) : (
          grupos.map(([clave, delDia]) => {
            const neto = delDia.reduce((t, m) => t + (m.tipo === "INGRESO" ? m.monto : -m.monto), 0);
            return (
              <div key={clave}>
                {!unSoloDia && (
                  <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-5 py-2 dark:border-slate-700 dark:bg-slate-900/40">
                    <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{etiquetaDia(clave)}</span>
                    <span className={cn("text-xs font-semibold tabular-nums", neto >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>{neto >= 0 ? "+ " : "− "}{formatCurrency(Math.abs(neto))}</span>
                  </div>
                )}
                <ul className="divide-y divide-slate-100 dark:divide-slate-700/70">
                  {delDia.map((m) => (
                    <Fila key={m.id} m={m} onCliente={(id, nombre) => setCliente({ id, nombre })} />
                  ))}
                </ul>
              </div>
            );
          })
        )}
        {movimientos.length >= 500 && (
          <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500 dark:border-slate-700">Se muestran los últimos 500. Achicá el período para ver el resto (los totales de arriba sí incluyen todo).</p>
        )}
      </section>

      <p className="mt-3 text-xs text-slate-400">
        El resultado es lo que entró menos lo que salió en el período. No reemplaza el arqueo de la plata física.
      </p>

      <ExportarContador abierto={paraContador} onCerrar={() => setParaContador(false)} telefonoContador={contador.telefono} nombreTaller={contador.taller} />
    </AppShell>
  );
}

function Cifra({ label, value, helper, tono, onClick, activo = false }: { label: string; value: string; helper: string; tono?: "verde" | "rojo"; onClick?: () => void; activo?: boolean }) {
  const cuerpo = (
    <>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className={cn("mt-1 font-display text-3xl font-extrabold leading-none tabular-nums", tono === "verde" ? "text-emerald-600 dark:text-emerald-400" : tono === "rojo" ? "text-red-600 dark:text-red-400" : "text-slate-900 dark:text-white")}>{value}</p>
      <p className="mt-1 truncate text-xs text-slate-400">{helper}</p>
    </>
  );
  const clase = cn(
    "block border-slate-100 px-5 py-4 text-left [&:not(:first-child)]:border-l dark:border-slate-700 max-xl:[&:nth-child(3)]:border-l-0 max-xl:[&:nth-child(n+3)]:border-t",
    activo && "bg-slate-50 dark:bg-slate-700/30",
  );
  return onClick ? (
    <button type="button" onClick={onClick} aria-pressed={activo} title="Tocá para ver sólo estos" className={cn(clase, "transition hover:bg-slate-50 dark:hover:bg-slate-700/30")}>{cuerpo}</button>
  ) : (
    <div className={clase}>{cuerpo}</div>
  );
}

function Fila({ m, onCliente }: { m: MovimientoCaja; onCliente: (id: number, nombre: string) => void }) {
  const entrada = m.tipo === "INGRESO";
  return (
    <li className="grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 sm:grid-cols-[52px_minmax(0,1fr)_120px_130px]">
      <span className="text-sm tabular-nums text-slate-500 dark:text-slate-400">{hora(m.fecha)}</span>
      <div className="min-w-0">
        {entrada && m.cliente_id ? (
          <p className="truncate text-sm text-slate-900 dark:text-white">
            Cobro a{" "}
            <button type="button" onClick={() => onCliente(m.cliente_id!, m.cliente_nombre || "")} title="Ver sólo los movimientos de este cliente" className="font-semibold underline decoration-slate-300 underline-offset-2 hover:decoration-brand-500 dark:decoration-slate-600">
              {m.cliente_nombre}
            </button>
          </p>
        ) : (
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{m.detalle || m.concepto}</p>
        )}
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">
          {entrada ? (m.detalle || "Cobro") : (m.categoria || "Gasto")}
          <span className="sm:hidden"> · {MEDIOS[m.metodo] ?? m.metodo}</span>
        </p>
      </div>
      <span className="hidden text-sm text-slate-600 dark:text-slate-300 sm:block">{MEDIOS[m.metodo] ?? m.metodo}</span>
      <span className={cn("text-right text-sm font-semibold tabular-nums", entrada ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400")}>
        {entrada ? "+ " : "− "}{formatCurrency(m.monto)}
      </span>
    </li>
  );
}

export default function CajaPage() {
  return (
    <Suspense fallback={null}>
      <CajaDiaria />
    </Suspense>
  );
}
