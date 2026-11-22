"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { crearCompraLote, eliminarGasto, getGastos, getResumenGastos, type GastosResumen } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { Gasto } from "@/lib/types";
import { cn } from "@/lib/utils";

const CATEGORIAS = [
  { value: "REPUESTOS", label: "Repuestos", ejemplo: "Ej: Pastillas de freno para la Hilux" },
  { value: "INSUMOS", label: "Insumos", ejemplo: "Ej: Aceite 20L y trapos" },
  { value: "SERVICIOS", label: "Servicios", ejemplo: "Ej: Luz del taller de noviembre" },
  { value: "OTROS", label: "Otros", ejemplo: "Ej: Herramienta nueva" },
];
const CATEGORIA_LABEL = Object.fromEntries(CATEGORIAS.map((c) => [c.value, c.label]));

const MEDIOS: Record<string, string> = { EFECTIVO: "Efectivo", TRANSFERENCIA: "Transferencia", TARJETA: "Tarjeta", CHEQUE: "Cheque" };

const PERIODOS = [
  { value: "hoy", label: "Hoy" },
  { value: "semana", label: "Esta semana" },
  { value: "mes", label: "Este mes" },
  { value: "mes_pasado", label: "Mes pasado" },
  { value: "anio", label: "Este año" },
  { value: "personalizado", label: "Elegir fechas" },
] as const;
type Periodo = (typeof PERIODOS)[number]["value"];

type Linea = { id: number; tipo: string; descripcion: string; monto: string };
const lineaNueva = (id: number, tipo: string): Linea => ({ id, tipo, descripcion: "", monto: "" });

const resumenVacio: GastosResumen = { mes_actual: 0, mes_anterior: 0, total_periodo: 0, cantidad_periodo: 0, por_tipo: [] };

const campo =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white";
const sinFlechas = "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

function fechaLocal(fecha = new Date()) {
  return new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function rangoDe(periodo: Periodo, desde: string, hasta: string) {
  const hoy = new Date();
  const d = (y: number, m: number, dia: number) => fechaLocal(new Date(y, m, dia));
  switch (periodo) {
    case "hoy":
      return { desde: fechaLocal(hoy), hasta: fechaLocal(hoy) };
    case "semana":
      return { desde: fechaLocal(new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() - ((hoy.getDay() + 6) % 7))), hasta: fechaLocal(hoy) };
    case "mes":
      return { desde: d(hoy.getFullYear(), hoy.getMonth(), 1), hasta: fechaLocal(hoy) };
    case "mes_pasado":
      return { desde: d(hoy.getFullYear(), hoy.getMonth() - 1, 1), hasta: d(hoy.getFullYear(), hoy.getMonth(), 0) };
    case "anio":
      return { desde: d(hoy.getFullYear(), 0, 1), hasta: fechaLocal(hoy) };
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
  const opciones: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" };
  if (y !== hoy.getFullYear()) opciones.year = "numeric";
  const texto = fecha.toLocaleDateString("es-AR", opciones).replace(",", "");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function descargarCSV(gastos: Gasto[], nombre: string) {
  const filas = [
    ["Fecha", "Categoría", "Descripción", "Medio", "Comprobante", "Cargó", "Importe"],
    ...gastos.map((g) => [fechaLocal(new Date(g.fecha)), CATEGORIA_LABEL[g.tipo] ?? g.tipo, g.descripcion, MEDIOS[g.metodo_pago] ?? g.metodo_pago, g.comprobante, g.registrado_por, String(g.monto).replace(".", ",")]),
  ];
  const csv = filas.map((f) => f.map((c) => `"${String(c ?? "").replaceAll('"', '""')}"`).join(";")).join("\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${nombre}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function GastosPage() {
  const [gastos, setGastos] = useState<Gasto[]>([]);
  const [resumen, setResumen] = useState<GastosResumen>(resumenVacio);
  const [loading, setLoading] = useState(true);
  const [aviso, setAviso] = useState<{ texto: string; error?: boolean } | null>(null);

  // Filtros
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [desde, setDesde] = useState(() => rangoDe("mes", "", "").desde);
  const [hasta, setHasta] = useState(() => fechaLocal());
  const [filtroCategoria, setFiltroCategoria] = useState("");
  const [filtroMedio, setFiltroMedio] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [busquedaActiva, setBusquedaActiva] = useState("");

  // Carga rápida: una o varias líneas de la misma compra
  const [lineas, setLineas] = useState<Linea[]>([lineaNueva(1, "REPUESTOS")]);
  const [proximoId, setProximoId] = useState(2);
  const [enfocarLinea, setEnfocarLinea] = useState<number | null>(null);
  const [medio, setMedio] = useState("EFECTIVO");
  const [fecha, setFecha] = useState(() => fechaLocal());
  const [comprobante, setComprobante] = useState("");
  const [masDatos, setMasDatos] = useState(false);
  const [guardando, setGuardando] = useState(false);

  const [aBorrar, setABorrar] = useState<Gasto | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setBusquedaActiva(busqueda.trim()), 300);
    return () => window.clearTimeout(t);
  }, [busqueda]);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 3000);
    return () => window.clearTimeout(t);
  }, [aviso]);

  // Desde Caja se llega con ?nuevo=1: el cursor va directo a la descripción.
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("nuevo") === "1") {
      setEnfocarLinea(1);
      window.history.replaceState({}, "", "/gastos");
    }
  }, []);

  // Lleva el cursor a la línea pedida. Reintenta un momento porque, al entrar
  // a la página, el formulario puede no estar dibujado todavía.
  useEffect(() => {
    if (enfocarLinea === null) return;
    let intentos = 0;
    const timer = window.setInterval(() => {
      const campo = document.getElementById(`linea-desc-${enfocarLinea}`);
      intentos += 1;
      if (campo) campo.focus();
      if (campo || intentos > 30) window.clearInterval(timer);
    }, 50);
    return () => window.clearInterval(timer);
  }, [enfocarLinea]);

  const rango = rangoDe(periodo, desde, hasta);
  const filtros = useMemo(
    () => ({
      fecha_desde: rango.desde,
      fecha_hasta: rango.hasta,
      tipo: filtroCategoria || undefined,
      metodo: filtroMedio || undefined,
      buscar: busquedaActiva || undefined,
    }),
    [rango.desde, rango.hasta, filtroCategoria, filtroMedio, busquedaActiva],
  );

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const [lista, totales] = await Promise.all([getGastos(filtros), getResumenGastos(filtros)]);
      setGastos(lista);
      setResumen(totales);
    } catch (error) {
      setAviso({ texto: error instanceof Error ? error.message : "No pudimos cargar los gastos.", error: true });
    } finally {
      setLoading(false);
    }
  }, [filtros]);

  useEffect(() => {
    void cargar();
  }, [cargar]);

  const grupos = useMemo(() => {
    const mapa = new Map<string, Gasto[]>();
    for (const g of gastos) {
      const clave = fechaLocal(new Date(g.fecha));
      mapa.set(clave, [...(mapa.get(clave) ?? []), g]);
    }
    return [...mapa.entries()];
  }, [gastos]);

  const variacion = resumen.mes_anterior > 0 ? Math.round(((resumen.mes_actual - resumen.mes_anterior) / resumen.mes_anterior) * 100) : null;
  const totalCategorias = resumen.por_tipo.reduce((t, c) => t + c.total, 0);
  const hayFiltros = Boolean(filtroCategoria || filtroMedio || busquedaActiva);
  const unSoloDia = rango.desde === rango.hasta;
  const textoPeriodo = periodo === "personalizado"
    ? `Del ${new Date(`${rango.desde}T00:00`).toLocaleDateString("es-AR")} al ${new Date(`${rango.hasta}T00:00`).toLocaleDateString("es-AR")}`
    : PERIODOS.find((p) => p.value === periodo)?.label;

  const cargadas = lineas.filter((l) => l.descripcion.trim() || l.monto.trim());
  const totalCompra = cargadas.reduce((t, l) => t + (Number.parseFloat(l.monto) || 0), 0);

  function enfocarPrimera() {
    setEnfocarLinea(null);
    window.setTimeout(() => setEnfocarLinea(lineas[0]?.id ?? 1), 0);
  }

  function cambiarLinea(id: number, campo: keyof Omit<Linea, "id">, valor: string) {
    setLineas((actuales) => actuales.map((l) => (l.id === id ? { ...l, [campo]: valor } : l)));
  }

  function agregarLinea() {
    const id = proximoId;
    // La nueva línea hereda la categoría de la anterior (casi siempre es la misma).
    setLineas((actuales) => [...actuales, lineaNueva(id, actuales[actuales.length - 1]?.tipo ?? "REPUESTOS")]);
    setProximoId(id + 1);
    setEnfocarLinea(id);
  }

  function quitarLinea(id: number) {
    setLineas((actuales) => (actuales.length > 1 ? actuales.filter((l) => l.id !== id) : actuales));
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    if (!cargadas.length) return setAviso({ texto: "Escribí qué se compró o pagó.", error: true });
    const conProblema = cargadas.findIndex((l) => l.descripcion.trim().length < 2 || !(Number.parseFloat(l.monto) > 0));
    if (conProblema >= 0) {
      const l = cargadas[conProblema];
      return setAviso({ texto: l.descripcion.trim().length < 2 ? `Línea ${conProblema + 1}: falta qué se compró.` : `Línea ${conProblema + 1}: falta el importe.`, error: true });
    }
    setGuardando(true);
    try {
      await crearCompraLote({
        metodo_pago: medio,
        fecha,
        comprobante: comprobante.trim(),
        lineas: cargadas.map((l) => ({ tipo: l.tipo, descripcion: l.descripcion.trim(), monto: Number.parseFloat(l.monto) })),
      });
      setAviso({
        texto: cargadas.length === 1
          ? `Gasto de ${formatCurrency(totalCompra)} cargado. Ya figura en Caja.`
          : `Compra de ${cargadas.length} ítems por ${formatCurrency(totalCompra)} cargada. Ya figura en Caja.`,
      });
      const ultimaCategoria = cargadas[cargadas.length - 1].tipo;
      setLineas([lineaNueva(proximoId, ultimaCategoria)]);
      setEnfocarLinea(proximoId);
      setProximoId((n) => n + 1);
      setComprobante("");
      await cargar();
    } catch (error) {
      setAviso({ texto: error instanceof Error ? error.message : "No pudimos cargar el gasto.", error: true });
    } finally {
      setGuardando(false);
    }
  }

  async function confirmarBorrado() {
    if (!aBorrar) return;
    const gasto = aBorrar;
    setABorrar(null);
    try {
      await eliminarGasto(gasto.id);
      setAviso({ texto: "Gasto eliminado. También salió de la Caja." });
      await cargar();
    } catch (error) {
      setAviso({ texto: error instanceof Error ? error.message : "No pudimos eliminar el gasto.", error: true });
    }
  }

  function limpiarFiltros() {
    setFiltroCategoria("");
    setFiltroMedio("");
    setBusqueda("");
  }

  return (
    <AppShell
      currentPath="/gastos"
      compact
      badge="Finanzas"
      title="Gastos y compras"
      description="Lo que sale del taller: repuestos, insumos, servicios y demás."
    >
      {aviso && (
        <div role="status" className={cn("fixed bottom-6 right-6 z-50 max-w-sm rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-2xl", aviso.error ? "bg-red-600" : "bg-slate-900 dark:bg-slate-700")}>
          {aviso.texto}
        </div>
      )}

      {/* Carga rápida: una línea para un gasto suelto, varias para una factura */}
      <form onSubmit={guardar} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Cargar un gasto</h2>
          <p className="text-xs text-slate-500 dark:text-slate-400">¿Una factura con varios repuestos? Sumá una línea por cada uno.</p>
        </div>

        <ul className="mt-3 space-y-2">
          {lineas.map((l, i) => (
            <li key={l.id} className="grid grid-cols-[minmax(0,1fr)_36px] gap-2 sm:grid-cols-[140px_minmax(0,1fr)_150px_36px]">
              <select
                value={l.tipo}
                onChange={(e) => cambiarLinea(l.id, "tipo", e.target.value)}
                aria-label={`Categoría de la línea ${i + 1}`}
                className={cn(campo, "col-span-2 sm:col-span-1")}
              >
                {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
              <input
                id={`linea-desc-${l.id}`}
                value={l.descripcion}
                onChange={(e) => cambiarLinea(l.id, "descripcion", e.target.value)}
                placeholder={CATEGORIAS.find((c) => c.value === l.tipo)?.ejemplo}
                aria-label={`Qué se compró (línea ${i + 1})`}
                className={cn(campo, "row-start-2 sm:row-start-auto")}
              />
              <div className="relative col-span-1 row-start-3 sm:row-start-auto">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="any"
                  value={l.monto}
                  onChange={(e) => cambiarLinea(l.id, "monto", e.target.value)}
                  placeholder="Importe"
                  aria-label={`Importe de la línea ${i + 1}`}
                  className={cn(campo, "pl-7 text-right font-semibold tabular-nums", sinFlechas)}
                />
              </div>
              <button
                type="button"
                onClick={() => quitarLinea(l.id)}
                disabled={lineas.length === 1}
                aria-label={`Quitar línea ${i + 1}`}
                title="Quitar línea"
                className="row-start-2 flex h-10 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 disabled:invisible dark:hover:bg-red-950/30 sm:row-start-auto"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
        <button type="button" onClick={agregarLinea} className="mt-2 inline-flex h-8 items-center gap-1 rounded-lg px-1 text-sm font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-300">
          <span className="text-base leading-none">+</span> Otra línea de la misma compra
        </button>

        <div className="mt-3 flex flex-col gap-3 border-t border-slate-100 pt-3 dark:border-slate-700 lg:flex-row lg:items-center">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
            <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
              Pagado con
              <select value={medio} onChange={(e) => setMedio(e.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                {Object.entries(MEDIOS).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
              </select>
            </label>
            {masDatos ? (
              <>
                <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  Fecha
                  <input type="date" value={fecha} max={fechaLocal()} onChange={(e) => setFecha(e.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:[color-scheme:dark]" />
                </label>
                <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                  Comprobante
                  <input value={comprobante} onChange={(e) => setComprobante(e.target.value)} placeholder="Ej: Factura C 0001-000045" className="h-9 w-56 rounded-lg border border-slate-200 bg-white px-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
                </label>
              </>
            ) : (
              <button type="button" onClick={() => setMasDatos(true)} className="font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
                + Fecha distinta o comprobante
              </button>
            )}
          </div>
          <div className="flex items-center justify-between gap-4 lg:ml-auto">
            {cargadas.length > 1 && (
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Total <span className="font-display text-xl font-extrabold tabular-nums text-slate-900 dark:text-white">{formatCurrency(totalCompra)}</span>
              </p>
            )}
            <button type="submit" disabled={guardando} className="inline-flex h-10 items-center justify-center rounded-xl bg-brand-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60">
              {guardando ? "Guardando…" : cargadas.length > 1 ? `Cargar compra (${cargadas.length} ítems)` : "Cargar gasto"}
            </button>
          </div>
        </div>
        <p className="mt-2 text-xs text-slate-400">
          {fecha === fechaLocal() ? "Se carga con fecha de hoy" : `Se carga con fecha ${new Date(`${fecha}T00:00`).toLocaleDateString("es-AR")}`} y aparece en Caja.
        </p>
      </form>

      {/* Período */}
      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="-mx-1 flex min-w-0 gap-1 overflow-x-auto px-1 pb-1 lg:pb-0" role="toolbar" aria-label="Período">
          {PERIODOS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriodo(p.value)}
              aria-pressed={periodo === p.value}
              className={cn("inline-flex h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-semibold transition", periodo === p.value ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800")}
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

      {/* Números */}
      <div className="mt-3 grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 lg:grid-cols-[1fr_1fr_1.6fr]">
        <div className="px-5 py-4">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{hayFiltros ? `${textoPeriodo} · con filtros` : textoPeriodo}</p>
          <p className="mt-1 font-display text-3xl font-extrabold leading-none tabular-nums text-slate-900 dark:text-white">{formatCurrency(resumen.total_periodo)}</p>
          <p className="mt-1 text-xs text-slate-400">{resumen.cantidad_periodo} {resumen.cantidad_periodo === 1 ? "gasto" : "gastos"}</p>
        </div>
        <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-700 lg:border-l lg:border-t-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Este mes vs. el anterior</p>
          <p className="mt-1 font-display text-3xl font-extrabold leading-none tabular-nums text-slate-900 dark:text-white">{formatCurrency(resumen.mes_actual)}</p>
          <p className={cn("mt-1 text-xs", variacion === null ? "text-slate-400" : variacion > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400")}>
            {variacion === null ? "Sin datos del mes anterior" : variacion === 0 ? "Igual que el mes pasado" : `${variacion > 0 ? "↑" : "↓"} ${Math.abs(variacion)}% (el mes pasado: ${formatCurrency(resumen.mes_anterior)})`}
          </p>
        </div>
        <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-700 lg:border-l lg:border-t-0">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">En qué se fue la plata · tocá para filtrar</p>
          <div className="mt-2 space-y-1.5">
            {CATEGORIAS.map((c) => {
              const total = resumen.por_tipo.find((t) => t.tipo === c.value)?.total ?? 0;
              const pct = totalCategorias ? (total / totalCategorias) * 100 : 0;
              const activa = filtroCategoria === c.value;
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setFiltroCategoria(activa ? "" : c.value)}
                  aria-pressed={activa}
                  className={cn("grid w-full grid-cols-[84px_minmax(0,1fr)_96px] items-center gap-3 rounded-md text-left text-sm transition", filtroCategoria && !activa ? "opacity-40 hover:opacity-80" : "")}
                >
                  <span className={cn("truncate", activa ? "font-semibold text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300")}>{c.label}</span>
                  <span className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                    <span className="block h-full rounded-full bg-brand-500" style={{ width: `${pct}%` }} />
                  </span>
                  <span className="text-right tabular-nums text-slate-700 dark:text-slate-200">{formatCurrency(total)}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Buscador y filtros */}
      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-sm">
          <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" /></svg>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar descripción, comprobante o importe…"
            aria-label="Buscar gastos"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-9 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
          {busqueda && <button type="button" onClick={() => setBusqueda("")} aria-label="Borrar búsqueda" className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-white">×</button>}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)} aria-label="Categoría" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <option value="">Todas las categorías</option>
            {CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <select value={filtroMedio} onChange={(e) => setFiltroMedio(e.target.value)} aria-label="Medio de pago" className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 shadow-sm outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <option value="">Todos los medios</option>
            {Object.entries(MEDIOS).map(([valor, texto]) => <option key={valor} value={valor}>{texto}</option>)}
          </select>
          {hayFiltros && (
            <button type="button" onClick={limpiarFiltros} className="h-9 rounded-lg px-2.5 text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">Limpiar filtros</button>
          )}
        </div>
      </div>

      {/* Lista */}
      <section className="mt-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 dark:border-slate-700">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            <span className="font-semibold text-slate-900 dark:text-white">{textoPeriodo}</span>
            {" · "}
            {loading ? "Cargando…" : `${gastos.length} ${gastos.length === 1 ? "gasto" : "gastos"}`}
          </p>
          {gastos.length > 0 && (
            <button type="button" onClick={() => descargarCSV(gastos, `gastos-${rango.desde}${unSoloDia ? "" : `-a-${rango.hasta}`}`)} className="inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0-4-4m4 4 4-4M5 20h14" /></svg>
              Descargar Excel
            </button>
          )}
        </header>

        {loading ? (
          <div className="space-y-2 p-4">{[1, 2, 3].map((i) => <div key={i} className="h-12 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-700/50" />)}</div>
        ) : gastos.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <p className="font-semibold text-slate-700 dark:text-slate-200">{hayFiltros ? "Nada coincide con esos filtros." : "No hay gastos en este período."}</p>
            {hayFiltros ? (
              <button type="button" onClick={limpiarFiltros} className="mt-2 text-sm font-semibold text-brand-700 dark:text-brand-300">Limpiar filtros</button>
            ) : (
              <button type="button" onClick={enfocarPrimera} className="mt-2 text-sm font-semibold text-brand-700 dark:text-brand-300">Cargar el primero</button>
            )}
          </div>
        ) : (
          grupos.map(([clave, delDia]) => (
            <div key={clave}>
              {!unSoloDia && (
                <div className="flex items-baseline justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-5 py-2 dark:border-slate-700 dark:bg-slate-900/40">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">{etiquetaDia(clave)}</span>
                  <span className="text-xs font-semibold tabular-nums text-slate-500 dark:text-slate-400">{formatCurrency(delDia.reduce((t, g) => t + g.monto, 0))}</span>
                </div>
              )}
              <ul className="divide-y divide-slate-100 dark:divide-slate-700/70">
                {delDia.map((g) => (
                  <li key={g.id} className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_110px_120px_32px]">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{g.descripcion}</p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                        {CATEGORIA_LABEL[g.tipo] ?? g.tipo}
                        {g.comprobante ? ` · ${g.comprobante}` : ""}
                        {g.registrado_por ? ` · cargó ${g.registrado_por}` : ""}
                        <span className="sm:hidden"> · {MEDIOS[g.metodo_pago] ?? g.metodo_pago}</span>
                      </p>
                    </div>
                    <span className="hidden text-sm text-slate-600 dark:text-slate-300 sm:block">{MEDIOS[g.metodo_pago] ?? g.metodo_pago}</span>
                    <span className="text-right text-sm font-semibold tabular-nums text-red-600 dark:text-red-400">− {formatCurrency(g.monto)}</span>
                    <button
                      type="button"
                      onClick={() => setABorrar(g)}
                      title="Eliminar gasto"
                      aria-label={`Eliminar ${g.descripcion}`}
                      className="hidden h-8 w-8 items-center justify-center rounded-lg text-slate-300 transition hover:bg-red-50 hover:text-red-600 group-hover:text-slate-400 dark:text-slate-600 dark:hover:bg-red-950/30 sm:flex"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.87 12.14A2 2 0 0116.14 21H7.86a2 2 0 01-1.99-1.86L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
        {gastos.length >= 200 && (
          <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500 dark:border-slate-700">Se muestran los últimos 200. Achicá el período para ver el resto (el total de arriba sí incluye todo).</p>
        )}
      </section>

      {aBorrar && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">¿Eliminar este gasto?</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-slate-900 dark:text-white">{aBorrar.descripcion}</span> · {formatCurrency(aBorrar.monto)}. También sale de la Caja y no se puede recuperar.
            </p>
            <div className="mt-6 flex gap-2">
              <button type="button" onClick={() => setABorrar(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300">Cancelar</button>
              <button type="button" onClick={() => void confirmarBorrado()} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
