"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getTableroTrabajos, type TableroData, type TrabajoKanban } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

const REFRESH_INTERVAL_MS = 60_000; // 60 segundos

export default function TableroTrabajos() {
  const [tablero, setTablero] = useState<TableroData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [ultimaActualizacion, setUltimaActualizacion] = useState<Date | null>(null);

  const cargarTablero = useCallback(async (silencioso = false) => {
    try {
      if (silencioso) setRefreshing(true);
      else setLoading(true);
      const data = await getTableroTrabajos();
      setTablero(data);
      setUltimaActualizacion(new Date());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Carga inicial
  useEffect(() => {
    cargarTablero(false);
  }, [cargarTablero]);

  // Auto-refresh cada 60s
  useEffect(() => {
    const interval = setInterval(() => cargarTablero(true), REFRESH_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [cargarTablero]);

  if (loading) {
    return (
      <AppShell currentPath="/trabajos/tablero" title="Estado del Taller" description="Sincronizando autos en proceso...">
        <div className="flex h-[60vh] items-center justify-center">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600"></div>
        </div>
      </AppShell>
    );
  }

  if (!tablero) return null;

  return (
    <AppShell
      currentPath="/trabajos/tablero"
      badge="Estado del Taller"
      title="¿Cómo está el taller hoy?"
      description="Todos los autos en proceso, de un vistazo. Se actualiza solo cada 60 segundos."
      actions={
        <div className="flex items-center gap-3">
          {/* Última actualización + botón refresh */}
          <div className="hidden sm:flex flex-col items-end">
            {ultimaActualizacion && (
              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Actualizado {ultimaActualizacion.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
            <span className="text-[9px] text-slate-400">Auto-refresh cada 60s</span>
          </div>
          <button
            onClick={() => cargarTablero(true)}
            disabled={refreshing}
            title="Actualizar ahora"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-brand-500 hover:text-brand-600 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500"
          >
            <svg className={cn("h-4 w-4", refreshing && "animate-spin")} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <Link href="/trabajos" className="text-sm font-bold text-slate-500 hover:text-slate-900 underline dark:hover:text-white transition-colors">
            Ver en lista
          </Link>
          <Link href="/trabajos/nuevo" className="inline-flex items-center justify-center rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 hover:-translate-y-0.5">
            + Nuevo Ingreso
          </Link>
        </div>
      }
    >
      {/* GRID ADAPTATIVO (La magia pura)
        1 columna en celus, 2 en tablets, 4 columnas justas en PC grandes. 
        Sin scrollbars horizontales horribles. 
      */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4 items-start pb-12">
        
        <ColumnaKanban 
          titulo="1. En Espera" 
          colorBorde="border-slate-300 dark:border-slate-600"
          colorFondo="bg-slate-100/40 dark:bg-slate-900/30"
          datos={tablero.INGRESADO}
        />
        
        <ColumnaKanban 
          titulo="2. En Proceso" 
          colorBorde="border-amber-400 dark:border-amber-500/50"
          colorFondo="bg-amber-50/40 dark:bg-amber-950/10"
          datos={tablero.EN_PROCESO}
        />
        
        <ColumnaKanban 
          titulo="3. Terminado" 
          colorBorde="border-emerald-400 dark:border-emerald-500/50"
          colorFondo="bg-emerald-50/40 dark:bg-emerald-950/10"
          datos={tablero.FINALIZADO}
        />
        
        <ColumnaKanban 
          titulo="4. Entregados" 
          colorBorde="border-blue-400 dark:border-blue-500/50"
          colorFondo="bg-blue-50/40 dark:bg-blue-950/10"
          datos={tablero.ENTREGADO}
        />

      </div>
    </AppShell>
  );
}

// COMPONENTE: Una columna entera del tablero
function ColumnaKanban({ titulo, colorBorde, colorFondo, datos }: { titulo: string; colorBorde: string; colorFondo: string; datos: { trabajos: TrabajoKanban[], total_plata: number } }) {
  return (
    <div className={cn("flex flex-col rounded-2xl border-t-4 bg-white p-3.5 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] transition-all dark:bg-slate-800", colorBorde)}>
      <div className="mb-4 mt-1 flex items-center justify-between px-1">
        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{titulo}</h3>
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-slate-100 px-1.5 text-[10px] font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
          {datos.trabajos.length}
        </span>
      </div>
      
      <div className="mb-4 rounded-xl bg-slate-50 py-3 text-center dark:bg-slate-900/50">
        <p className="text-[9px] font-bold uppercase tracking-[0.2em] text-slate-400">Capital Retenido</p>
        <p className="mt-0.5 font-mono text-lg font-black tracking-tight text-slate-700 dark:text-slate-300">{formatCurrency(datos.total_plata)}</p>
      </div>

      <div className={cn("flex h-full min-h-[120px] flex-col gap-3 rounded-xl p-2.5", colorFondo)}>
        {datos.trabajos.length > 0 ? (
          datos.trabajos.map(t => <TarjetaTrabajo key={t.id} trabajo={t} />)
        ) : (
          <div className="flex h-full min-h-[100px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200/60 text-slate-400 dark:border-slate-700/50">
            <svg className="mb-2 h-5 w-5 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
            </svg>
            <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Columna Vacía</span>
          </div>
        )}
      </div>
    </div>
  );
}

// COMPONENTE: La tarjetita de cada auto
function TarjetaTrabajo({ trabajo }: { trabajo: TrabajoKanban }) {
  const esDemorado = trabajo.dias_en_taller >= 7;

  return (
    <Link href={`/trabajos/${trabajo.id}`} className="group relative block cursor-pointer rounded-xl border border-slate-200/60 bg-white p-3.5 shadow-sm transition-all hover:-translate-y-1 hover:border-brand-500 hover:shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:hover:border-brand-500">
      
      {/* Alerta de demora */}
      {esDemorado && (
        <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white shadow-md ring-2 ring-white dark:ring-slate-800" title="Lleva 7 o más días">
          !
        </span>
      )}

      <div className="mb-2.5 flex items-center justify-between">
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[9px] font-bold text-slate-500 dark:bg-slate-700/50 dark:text-slate-400">
          OT-{trabajo.id}
        </span>
        <span className={cn("text-[9px] font-bold uppercase tracking-wider", esDemorado ? "text-red-500" : "text-slate-400")}>
          {trabajo.dias_en_taller === 0 ? "Ingresó hoy" : `${trabajo.dias_en_taller} días`}
        </span>
      </div>

      <h4 className="font-mono text-base font-black tracking-tight text-slate-900 dark:text-white">{trabajo.patente}</h4>
      <p className="mt-0.5 truncate text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">{trabajo.vehiculo}</p>
      
      <p className="mt-3 text-xs leading-relaxed text-slate-600 line-clamp-2 dark:text-slate-300">
        {trabajo.resumen_corto}
      </p>

      <div className="mt-4 flex items-end justify-between border-t border-slate-100 pt-3 dark:border-slate-700/50">
        <div className="flex items-center gap-1.5 truncate">
          <div className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-[9px] font-bold text-slate-500 dark:bg-slate-700 dark:text-slate-300">
            {trabajo.cliente_nombre.charAt(0).toUpperCase()}
          </div>
          <p className="truncate text-[10px] font-bold text-slate-500">{trabajo.cliente_nombre}</p>
        </div>
        <p className="font-mono text-sm font-black tracking-tight text-slate-900 dark:text-white">{formatCurrency(trabajo.total)}</p>
      </div>
    </Link>
  );
}