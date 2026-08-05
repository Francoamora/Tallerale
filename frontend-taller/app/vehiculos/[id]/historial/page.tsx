"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getHistorialVehiculo } from "@/lib/api";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import type { VehiculoHistorial } from "@/lib/types";

const estadoClase: Record<string, string> = {
  INGRESADO: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  EN_PROCESO: "bg-amber-100 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300",
  FINALIZADO: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
  ENTREGADO: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300",
  ANULADO: "bg-rose-100 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
  BORRADOR: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
  ENVIADO: "bg-sky-100 text-sky-700 dark:bg-sky-500/10 dark:text-sky-300",
  APROBADO: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
};

function Estado({ value }: { value: string }) {
  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ${estadoClase[value] ?? "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"}`}>{value.replaceAll("_", " ")}</span>;
}

export default function HistorialVehiculoPage() {
  const { id } = useParams<{ id: string }>();
  const [historial, setHistorial] = useState<VehiculoHistorial | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    getHistorialVehiculo(Number(id))
      .then((data) => { if (active) setHistorial(data); })
      .catch((caught) => { if (active) setError(caught instanceof Error ? caught.message : "No pudimos cargar el historial."); });
    return () => { active = false; };
  }, [id]);

  const vehiculo = historial?.vehiculo;
  return (
    <AppShell
      currentPath="/clientes"
      badge="Vehículo"
      title={vehiculo ? `${vehiculo.marca} ${vehiculo.modelo}` : "Historial del vehículo"}
      description={vehiculo ? `${vehiculo.patente} · Todas las órdenes y presupuestos del vehículo.` : "Recuperando el historial operativo."}
      actions={<Link href="/clientes" className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">← Volver al directorio</Link>}
    >
      {error ? <div className="rounded-2xl border border-rose-200 bg-rose-50 p-5 text-sm font-semibold text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">{error}</div> : !historial || !vehiculo ? <div className="flex justify-center py-24"><div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-violet-600 dark:border-slate-700" /></div> : <div className="mx-auto max-w-5xl space-y-5">
        <section className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:grid-cols-[1fr_auto] sm:items-center dark:border-slate-800 dark:bg-slate-900">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-xl bg-slate-900 px-3 py-2 font-mono text-sm font-black tracking-widest text-white dark:bg-violet-600">{vehiculo.patente}</span>
              <p className="text-sm font-bold text-slate-900 dark:text-white">{vehiculo.cliente_nombre}</p>
            </div>
            <p className="mt-3 text-sm text-slate-500">{[vehiculo.anio, vehiculo.color].filter(Boolean).join(" · ") || "Sin datos adicionales"}</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-4 py-3 text-right dark:bg-slate-800">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Kilometraje actual</p>
            <p className="mt-1 font-mono text-xl font-black text-slate-900 dark:text-white">{formatNumber(vehiculo.kilometraje_actual)} km</p>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
            <div><h2 className="font-black text-slate-900 dark:text-white">Órdenes de trabajo</h2><p className="mt-1 text-sm text-slate-500">Intervenciones realizadas sobre este vehículo.</p></div>
            <span className="rounded-full bg-violet-100 px-3 py-1 text-xs font-black text-violet-700 dark:bg-violet-500/10 dark:text-violet-300">{historial.trabajos.length}</span>
          </div>
          {historial.trabajos.length ? <div className="divide-y divide-slate-100 dark:divide-slate-800">{historial.trabajos.map((trabajo) => <Link key={trabajo.id} href={`/trabajos/${trabajo.id}`} className="flex flex-col gap-3 px-5 py-4 transition hover:bg-violet-50/40 sm:flex-row sm:items-center sm:justify-between dark:hover:bg-violet-500/5"><div><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-slate-900 dark:text-white">OT-{String(trabajo.id).padStart(5, "0")}</strong><Estado value={trabajo.estado} /></div><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{trabajo.resumen || "Sin detalle"}</p><p className="mt-1 text-xs text-slate-400">{formatDate(trabajo.fecha_ingreso)} · {formatNumber(trabajo.kilometraje)} km</p></div><strong className="font-mono text-sm text-slate-800 dark:text-slate-100">{formatCurrency(trabajo.total)}</strong></Link>)}</div> : <p className="px-5 py-10 text-center text-sm text-slate-500">Todavía no hay órdenes de trabajo para este vehículo.</p>}
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800"><div><h2 className="font-black text-slate-900 dark:text-white">Presupuestos</h2><p className="mt-1 text-sm text-slate-500">Cotizaciones vinculadas al vehículo.</p></div><span className="rounded-full bg-sky-100 px-3 py-1 text-xs font-black text-sky-700 dark:bg-sky-500/10 dark:text-sky-300">{historial.presupuestos.length}</span></div>
          {historial.presupuestos.length ? <div className="divide-y divide-slate-100 dark:divide-slate-800">{historial.presupuestos.map((presupuesto) => <Link key={presupuesto.id} href={`/presupuestos/${presupuesto.id}`} className="flex flex-col gap-3 px-5 py-4 transition hover:bg-sky-50/40 sm:flex-row sm:items-center sm:justify-between dark:hover:bg-sky-500/5"><div><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-slate-900 dark:text-white">P-{String(presupuesto.id).padStart(4, "0")}</strong><Estado value={presupuesto.estado} /></div><p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{presupuesto.resumen || "Sin detalle"}</p><p className="mt-1 text-xs text-slate-400">{formatDate(presupuesto.fecha_creacion)}</p></div><strong className="font-mono text-sm text-slate-800 dark:text-slate-100">{formatCurrency(presupuesto.total)}</strong></Link>)}</div> : <p className="px-5 py-10 text-center text-sm text-slate-500">Todavía no hay presupuestos para este vehículo.</p>}
        </section>
      </div>}
    </AppShell>
  );
}
