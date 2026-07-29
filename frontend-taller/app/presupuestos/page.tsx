"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { eliminarPresupuesto, getPresupuestos } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { Presupuesto } from "@/lib/types";
import { cn } from "@/lib/utils";

const ESTADOS = [
  { value: "TODOS", label: "Todos" },
  { value: "BORRADOR", label: "Borradores" },
  { value: "ENVIADO", label: "Enviados" },
  { value: "APROBADO", label: "Aprobados" },
  { value: "RECHAZADO", label: "Rechazados" },
];

const estadoMeta: Record<string, { label: string; className: string }> = {
  BORRADOR: { label: "Borrador", className: "border-slate-200 bg-slate-100 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300" },
  ENVIADO: { label: "Esperando respuesta", className: "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/50 dark:bg-sky-950/30 dark:text-sky-300" },
  APROBADO: { label: "Aprobado", className: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300" },
  RECHAZADO: { label: "Rechazado", className: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300" },
};

function metaEstado(estado: string) {
  return estadoMeta[estado] ?? {
    label: "Estado anterior",
    className: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300",
  };
}

export default function ListadoPresupuestos() {
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("TODOS");
  const [idABorrar, setIdABorrar] = useState<number | null>(null);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const data = await getPresupuestos(busqueda);
        if (active) setPresupuestos(data);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "No pudimos cargar las cotizaciones.");
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [busqueda]);

  const visibles = estado === "TODOS" ? presupuestos : presupuestos.filter((presupuesto) => presupuesto.estado === estado);
  const resumen = useMemo(() => ({
    abiertos: presupuestos.filter((p) => ["BORRADOR", "ENVIADO"].includes(p.estado)).length,
    aprobados: presupuestos.filter((p) => p.estado === "APROBADO").length,
    montoAbierto: presupuestos.filter((p) => ["BORRADOR", "ENVIADO"].includes(p.estado)).reduce((total, p) => total + Number(p.total), 0),
  }), [presupuestos]);

  async function confirmarBorrado() {
    if (!idABorrar) return;
    const anterior = presupuestos;
    setPresupuestos((items) => items.filter((item) => item.id !== idABorrar));
    try {
      await eliminarPresupuesto(idABorrar);
      setMensaje("Presupuesto enviado a la papelera.");
      setTimeout(() => setMensaje(""), 2500);
    } catch (caught) {
      setPresupuestos(anterior);
      setError(caught instanceof Error ? caught.message : "No pudimos eliminar el presupuesto.");
    } finally {
      setIdABorrar(null);
    }
  }

  return (
    <AppShell
      currentPath="/presupuestos"
      badge="Ventas"
      title="Presupuestos"
      description="Seguimiento comercial desde el borrador hasta la orden de trabajo."
      actions={<Link href="/presupuestos/nuevo" className="inline-flex rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700">+ Nuevo presupuesto</Link>}
    >
      <div className="space-y-4">
        {mensaje && <div className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-900 px-5 py-3 text-sm font-bold text-white shadow-2xl dark:bg-sky-600">{mensaje}</div>}
        {error && <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{error}</div>}

        <div className="grid gap-3 sm:grid-cols-3">
          <Summary label="En seguimiento" value={String(resumen.abiertos)} helper="Borradores y enviados" />
          <Summary label="Aprobados" value={String(resumen.aprobados)} helper="Listos para convertir en OT" success />
          <Summary label="Valor abierto" value={formatCurrency(resumen.montoAbierto)} helper="Oportunidad comercial" />
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 xl:flex-row xl:items-center">
            <div className="relative min-w-0 flex-1">
              <svg className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" /></svg>
              <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar cliente, patente o trabajo…" className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm outline-none transition focus:border-sky-500 focus:ring-4 focus:ring-sky-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
            </div>
            <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100 p-1 dark:bg-slate-950">
              {ESTADOS.map((item) => {
                const count = item.value === "TODOS" ? presupuestos.length : presupuestos.filter((p) => p.estado === item.value).length;
                return (
                  <button key={item.value} type="button" onClick={() => setEstado(item.value)} className={cn("whitespace-nowrap rounded-lg px-3 py-2 text-xs font-bold transition", estado === item.value ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200")}>
                    {item.label} <span className="ml-1 opacity-60">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {loading ? (
            <LoadingRows />
          ) : visibles.length ? (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {visibles.map((presupuesto) => {
                const meta = metaEstado(presupuesto.estado);
                return (
                  <article key={presupuesto.id} className="grid gap-3 px-4 py-4 transition hover:bg-slate-50/70 dark:hover:bg-slate-950/35 lg:grid-cols-[90px_minmax(220px,1.2fr)_minmax(220px,1fr)_170px_150px_auto] lg:items-center">
                    <Link href={`/presupuestos/${presupuesto.id}`} className="font-mono text-sm font-black text-sky-600 dark:text-sky-400">P-{String(presupuesto.id).padStart(4, "0")}</Link>

                    <Link href={`/presupuestos/${presupuesto.id}`} className="min-w-0">
                      <strong className="block truncate text-sm text-slate-900 dark:text-white">{presupuesto.cliente_nombre}</strong>
                      <span className="block truncate text-xs text-slate-500">{presupuesto.patente} · {presupuesto.vehiculo}</span>
                    </Link>

                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-700 dark:text-slate-300">{presupuesto.resumen_corto || "Sin detalle cargado"}</p>
                      <p className="mt-1 text-[11px] text-slate-400">{new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(presupuesto.fecha_creacion))}</p>
                    </div>

                    <span className={cn("w-fit rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-wider", meta.className)}>{meta.label}</span>
                    <strong className="font-mono text-sm text-slate-900 dark:text-white lg:text-right">{formatCurrency(Number(presupuesto.total))}</strong>

                    <div className="flex items-center gap-2 lg:justify-end">
                      <Link href={`/presupuestos/${presupuesto.id}`} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white hover:bg-slate-800 dark:bg-slate-700 dark:hover:bg-slate-600">Abrir</Link>
                      <details className="relative">
                        <summary className="flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-lg border border-slate-200 text-lg font-bold text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">⋯</summary>
                        <div className="absolute right-0 top-10 z-20 w-48 rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
                          {presupuesto.estado !== "RECHAZADO" && <Link href={`/trabajos/nuevo?presupuesto=${presupuesto.id}`} className="block rounded-lg px-3 py-2 text-xs font-bold text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-950/30">Convertir en OT</Link>}
                          <Link href={`/presupuestos/nuevo?id=${presupuesto.id}`} className="block rounded-lg px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800">Editar</Link>
                          <button type="button" onClick={() => setIdABorrar(presupuesto.id)} className="block w-full rounded-lg px-3 py-2 text-left text-xs font-bold text-red-600 hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/30">Enviar a papelera</button>
                        </div>
                      </details>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center px-6 py-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sky-50 text-xl dark:bg-sky-950/30">₱</div>
              <h2 className="mt-4 font-bold text-slate-900 dark:text-white">No hay presupuestos en esta vista</h2>
              <p className="mt-1 text-sm text-slate-500">Cambiá el filtro o prepará una nueva cotización.</p>
              <Link href="/presupuestos/nuevo" className="mt-4 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-bold text-white">Crear presupuesto</Link>
            </div>
          )}
        </section>

        {idABorrar !== null && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900">
              <h2 className="text-lg font-black text-slate-900 dark:text-white">¿Enviar P-{idABorrar} a la papelera?</h2>
              <p className="mt-2 text-sm text-slate-500">Dejará de aparecer en el historial activo.</p>
              <div className="mt-6 flex gap-2">
                <button type="button" onClick={() => setIdABorrar(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-bold text-slate-600 dark:border-slate-700 dark:text-slate-300">Cancelar</button>
                <button type="button" onClick={confirmarBorrado} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white">Eliminar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Summary({ label, value, helper, success = false }: { label: string; value: string; helper: string; success?: boolean }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <div className="mt-1 flex items-baseline gap-2">
        <strong className={cn("font-mono text-xl text-slate-900 dark:text-white", success && "text-emerald-600 dark:text-emerald-400")}>{value}</strong>
        <span className="truncate text-xs text-slate-500">{helper}</span>
      </div>
    </div>
  );
}

function LoadingRows() {
  return <div className="space-y-3 p-4">{[1, 2, 3, 4, 5].map((item) => <div key={item} className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />)}</div>;
}
