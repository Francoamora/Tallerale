"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { getVehiculos } from "@/lib/api";
import { formatNumber } from "@/lib/format";
import type { Vehiculo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { HintBubble } from "@/components/hint-bubble";

export default function DirectorioVehiculos() {
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");

  useEffect(() => {
    async function cargar() {
      try {
        setLoading(true);
        const data = await getVehiculos(busqueda);
        setVehiculos(data);
      } catch (e) {
        console.error("Error cargando directorio de vehículos", e);
      } finally {
        setLoading(false);
      }
    }
    
    // Debounce para no saturar la API mientras tipea
    const timer = setTimeout(cargar, 300);
    return () => clearTimeout(timer);
  }, [busqueda]);

  // Lógica Inteligente de Ventas: Alertas de Service
  const getEstadoService = (kmActual: number, proximoKm?: number | null) => {
    if (!proximoKm) return { color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400", texto: "Sin registro" };
    
    const diferencia = proximoKm - kmActual;
    
    if (diferencia < 0) {
      return { color: "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50", texto: "¡Service Vencido!" };
    } else if (diferencia <= 1500) {
      return { color: "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/50", texto: "Pronto a vencer" };
    } else {
      return { color: "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50", texto: "Al día" };
    }
  };

  return (
    <AppShell
      currentPath="/vehiculos"
      badge="Directorio"
      title="Flota de Vehículos"
      description="Base de datos de todos los autos registrados. Monitoreá kilometrajes y próximos services."
      actions={
        <Link
          href="/clientes/nuevo"
          title="Los vehículos se dan de alta al crear un cliente o una orden."
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          + Alta desde Cliente
        </Link>
      }
    >
      <div className="space-y-6">

        {/* HINT — primera visita */}
        <HintBubble
          id="hint-vehiculos-v1"
          variant="banner"
          emoji="🚗"
          title="Registrá el primer vehículo"
          desc="Cargá la patente, marca, modelo y kilometraje. El sistema te avisa cuando se acerca el próximo service."
          action={{ label: "Agregar vehículo", href: "/vehiculos/nuevo" }}
        />

        {/* BARRA DE BÚSQUEDA Y FILTROS */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-md">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Buscar por patente, marca o modelo..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-11 pr-4 text-sm outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-slate-800 dark:bg-slate-900 dark:text-white"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-2">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              Total: {vehiculos.length} unidades
            </p>
          </div>
        </div>

        {/* TABLA DE DIRECTORIO */}
        <SectionCard title="Base de Datos Automotor">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[850px]">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:border-slate-800">
                  <th className="py-4 pl-4">Patente</th>
                  <th className="py-4">Marca y Modelo</th>
                  <th className="py-4">Titular Registrado</th>
                  <th className="py-4 text-right">Kilometraje</th>
                  <th className="py-4 text-center">Estado del Service</th>
                  <th className="py-4 pr-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {loading ? (
                  <SkeletonRows />
                ) : vehiculos.length > 0 ? (
                  vehiculos.map((v) => {
                    const estadoSrv = getEstadoService(v.kilometraje_actual, v.proximo_service_km);

                    return (
                      <tr key={v.id} className="group transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                        
                        {/* Patente */}
                        <td className="py-4 pl-4">
                          <span className="inline-flex items-center justify-center rounded-md bg-slate-900 px-2.5 py-1 font-mono text-[11px] font-bold tracking-widest text-white dark:bg-slate-800">
                            {v.patente}
                          </span>
                        </td>

                        {/* Marca y Modelo */}
                        <td className="py-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 dark:text-white">{v.marca} {v.modelo}</span>
                            {v.anio && <span className="text-[10px] font-semibold text-slate-400">Año {v.anio} {v.color ? `· ${v.color}` : ''}</span>}
                          </div>
                        </td>

                        {/* Titular */}
                        <td className="py-4">
                          <Link href={`/clientes/${v.cliente_id}`} className="text-sm font-semibold text-brand-600 hover:text-brand-700 hover:underline dark:text-brand-400">
                            Ver Cliente #{v.cliente_id}
                          </Link>
                        </td>

                        {/* Kilometraje */}
                        <td className="py-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className="font-mono text-sm font-bold text-slate-700 dark:text-slate-300">
                              {formatNumber(v.kilometraje_actual)} km
                            </span>
                            {v.proximo_service_km && (
                              <span className="text-[10px] font-medium text-slate-400">
                                Próx: {formatNumber(v.proximo_service_km)} km
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Alerta de Service */}
                        <td className="py-4 text-center">
                          <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider", estadoSrv.color)}>
                            {estadoSrv.texto}
                          </span>
                        </td>

                        {/* Acciones */}
                        <td className="py-4 pr-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 opacity-80 transition-opacity group-hover:opacity-100">
                            
                            {/* Botón Presupuestar */}
                            <Link
                              href={`/presupuestos/nuevo?vehiculo=${v.id}`}
                              title="Armar presupuesto rápido"
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-sky-200 bg-sky-50 text-sky-600 transition hover:bg-sky-600 hover:text-white dark:border-sky-900/50 dark:bg-sky-900/20 dark:text-sky-400 dark:hover:bg-sky-600 dark:hover:text-white"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                            </Link>

                            {/* Botón Ingresar OT */}
                            <Link
                              href={`/trabajos/nuevo?vehiculo=${v.id}`}
                              title="Ingresar al taller (OT)"
                              className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand-200 bg-brand-50 text-brand-600 transition hover:bg-brand-600 hover:text-white dark:border-brand-900/50 dark:bg-brand-900/20 dark:text-brand-400 dark:hover:bg-brand-600 dark:hover:text-white"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                            </Link>

                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="py-16 text-center text-sm text-slate-400">
                      No se encontraron vehículos que coincidan con la búsqueda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>
    </AppShell>
  );
}

function SkeletonRows() {
  return (
    <>
      {[1, 2, 3, 4, 5].map((i) => (
        <tr key={i} className="animate-pulse">
          <td className="py-5 pl-4"><div className="h-6 w-20 rounded bg-slate-100 dark:bg-slate-800" /></td>
          <td className="py-5"><div className="h-4 w-32 rounded bg-slate-100 dark:bg-slate-800" /></td>
          <td className="py-5"><div className="h-4 w-24 rounded bg-slate-100 dark:bg-slate-800" /></td>
          <td className="py-5"><div className="ml-auto h-4 w-16 rounded bg-slate-100 dark:bg-slate-800" /></td>
          <td className="py-5"><div className="mx-auto h-5 w-24 rounded-full bg-slate-100 dark:bg-slate-800" /></td>
          <td className="py-5 pr-4"><div className="ml-auto h-8 w-16 rounded-lg bg-slate-100 dark:bg-slate-800" /></td>
        </tr>
      ))}
    </>
  );
}