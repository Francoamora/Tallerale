"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { getClientes, getVehiculos } from "@/lib/api";
import { formatCurrency, formatNumber } from "@/lib/format";
import type { Cliente, Vehiculo } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filtro = "TODOS" | "DEUDA" | "SERVICE";

function normalizar(valor: string) {
  return valor.toLocaleLowerCase("es-AR").normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function estadoService(vehiculo: Vehiculo) {
  if (!vehiculo.proximo_service_km) return { key: "SIN_DATOS", label: "Sin programar", tone: "slate" };
  const faltan = vehiculo.proximo_service_km - vehiculo.kilometraje_actual;
  if (faltan < 0) return { key: "VENCIDO", label: "Service vencido", tone: "red" };
  if (faltan <= 1500) return { key: "PROXIMO", label: "Próximo", tone: "amber" };
  return { key: "AL_DIA", label: "Al día", tone: "emerald" };
}

const statusClasses = {
  red: "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300",
  amber: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-300",
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-300",
  slate: "border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

function SearchIcon() {
  return <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" /></svg>;
}

export function DirectorioWorkspace() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("TODOS");

  useEffect(() => {
    let active = true;
    async function cargar() {
      try {
        setLoading(true);
        const [clientesData, vehiculosData] = await Promise.all([getClientes(), getVehiculos()]);
        if (!active) return;
        setClientes(clientesData);
        setVehiculos(vehiculosData);
      } catch (caught) {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : "No pudimos cargar el directorio.");
      } finally {
        if (active) setLoading(false);
      }
    }
    cargar();
    return () => { active = false; };
  }, []);

  const vehiculosPorCliente = useMemo(() => {
    const agrupados = new Map<number, Vehiculo[]>();
    for (const vehiculo of vehiculos) {
      agrupados.set(vehiculo.cliente_id, [...(agrupados.get(vehiculo.cliente_id) ?? []), vehiculo]);
    }
    return agrupados;
  }, [vehiculos]);

  const termino = normalizar(busqueda.trim());
  const clientesVisibles = clientes.filter((cliente) => {
    const autos = vehiculosPorCliente.get(cliente.id) ?? [];
    if (filtro === "DEUDA" && Number(cliente.saldo_balance) <= 0) return false;
    if (filtro === "SERVICE" && !autos.some((auto) => ["VENCIDO", "PROXIMO"].includes(estadoService(auto).key))) return false;
    if (!termino) return true;
    return normalizar([
      cliente.nombre_completo, cliente.telefono, cliente.email, cliente.dni ?? "",
      ...autos.flatMap((auto) => [auto.patente, auto.marca, auto.modelo, auto.color]),
    ].join(" ")).includes(termino);
  });

  const deudaTotal = clientes.reduce((total, cliente) => total + Math.max(0, Number(cliente.saldo_balance)), 0);
  const servicesAtencion = vehiculos.filter((vehiculo) => ["VENCIDO", "PROXIMO"].includes(estadoService(vehiculo).key)).length;

  return (
    <AppShell
      currentPath="/clientes"
      badge="Directorio"
      title="Clientes y vehículos"
      description="Cada persona, sus autos y todas las acciones del taller en un solo lugar."
      actions={<Link href="/clientes/nuevo" className="inline-flex rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 dark:bg-brand-600 dark:hover:bg-brand-500">+ Cliente y vehículo</Link>}
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Metric label="Clientes" value={String(clientes.length)} helper={`${vehiculos.length} vehículos vinculados`} />
          <Metric label="Services a revisar" value={String(servicesAtencion)} helper={servicesAtencion ? "Próximos o vencidos" : "Todo bajo control"} warning={servicesAtencion > 0} />
          <Metric label="Saldos pendientes" value={formatCurrency(deudaTotal)} helper={`${clientes.filter((c) => Number(c.saldo_balance) > 0).length} cuentas con deuda`} />
        </div>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
          <div className="flex flex-col gap-3 border-b border-slate-200 p-4 dark:border-slate-800 lg:flex-row lg:items-center">
            <div className="relative min-w-0 flex-1">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"><SearchIcon /></span>
              <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar cliente, patente, vehículo o teléfono…" className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />
            </div>
            <div className="flex gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-950">
              <FilterButton active={filtro === "TODOS"} onClick={() => setFiltro("TODOS")}>Todos</FilterButton>
              <FilterButton active={filtro === "SERVICE"} onClick={() => setFiltro("SERVICE")}>Con service</FilterButton>
              <FilterButton active={filtro === "DEUDA"} onClick={() => setFiltro("DEUDA")}>Con deuda</FilterButton>
            </div>
          </div>

          {error ? (
            <div className="m-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{error}</div>
          ) : loading ? <LoadingRows /> : <DirectorioList clientes={clientesVisibles} vehiculosPorCliente={vehiculosPorCliente} />}
        </section>
      </div>
    </AppShell>
  );
}

function Metric({ label, value, helper, warning = false }: { label: string; value: string; helper: string; warning?: boolean }) {
  return <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</p>
    <div className="mt-1 flex items-baseline gap-2"><strong className={cn("font-mono text-xl text-slate-900 dark:text-white", warning && "text-amber-600 dark:text-amber-400")}>{value}</strong><span className="truncate text-xs text-slate-500">{helper}</span></div>
  </div>;
}

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return <button type="button" onClick={onClick} className={cn("rounded-lg px-3 py-2 text-xs font-bold transition", active ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:hover:text-slate-200")}>{children}</button>;
}

function DirectorioList({ clientes, vehiculosPorCliente }: { clientes: Cliente[]; vehiculosPorCliente: Map<number, Vehiculo[]> }) {
  if (!clientes.length) return <EmptyState />;
  return (
    <div className="space-y-3 bg-slate-100/70 p-3 dark:bg-slate-950/35">
      {clientes.map((cliente) => (
        <ClienteGroup
          key={cliente.id}
          cliente={cliente}
          vehiculos={vehiculosPorCliente.get(cliente.id) ?? []}
        />
      ))}
    </div>
  );
}

function ClienteGroup({ cliente, vehiculos }: { cliente: Cliente; vehiculos: Vehiculo[] }) {
  const deuda = Number(cliente.saldo_balance);
  return <article className="grid overflow-hidden rounded-2xl bg-white shadow-sm transition hover:shadow-md dark:bg-slate-900 lg:grid-cols-[280px_minmax(0,1fr)]">
    <div className="flex flex-col justify-between gap-4 bg-gradient-to-br from-brand-50/75 via-white to-white p-4 dark:bg-none dark:bg-slate-900">
      <div>
        <p className="mb-2 text-[9px] font-black uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400">Cliente</p>
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white font-black text-brand-700 shadow-sm dark:bg-brand-950/40 dark:text-brand-300">{cliente.nombre_completo.charAt(0).toUpperCase()}</span>
          <div className="min-w-0">
            <Link href={`/clientes/${cliente.id}`} className="block truncate text-sm font-black text-slate-900 hover:text-brand-600 dark:text-white dark:hover:text-brand-300">{cliente.nombre_completo}</Link>
            <p className="mt-0.5 truncate text-xs text-slate-500">{cliente.telefono || cliente.email || "Sin datos de contacto"}</p>
            {cliente.dni && <p className="mt-0.5 text-[11px] text-slate-400">DNI/CUIT {cliente.dni}</p>}
          </div>
        </div>
      </div>
      <div>
        <div className="mb-3 flex items-center justify-between rounded-xl border border-slate-200 bg-white px-3 py-2 dark:border-slate-800 dark:bg-slate-900">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Saldo</span>
          <strong className={cn("font-mono text-sm", deuda > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")}>{formatCurrency(deuda)}</strong>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Link href={`/clientes/${cliente.id}`} className="rounded-lg border border-slate-200 px-3 py-2 text-center text-xs font-bold text-slate-700 transition hover:bg-white dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Abrir ficha</Link>
          {deuda > 0
            ? <Link href={`/pagos/registrar?cliente=${cliente.id}`} className="rounded-lg border border-emerald-200 px-3 py-2 text-center text-xs font-bold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-900/60 dark:text-emerald-300 dark:hover:bg-emerald-950/30">Cobrar</Link>
            : <Link href={`/vehiculos/nuevo?cliente=${cliente.id}`} className="rounded-lg border border-brand-200 px-3 py-2 text-center text-xs font-bold text-brand-700 transition hover:bg-brand-50 dark:border-brand-900/60 dark:text-brand-300 dark:hover:bg-brand-950/30">+ Otro auto</Link>}
        </div>
        {deuda > 0 && <Link href={`/vehiculos/nuevo?cliente=${cliente.id}`} className="mt-2 block rounded-lg px-3 py-2 text-center text-xs font-bold text-brand-600 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/30">+ Agregar otro vehículo</Link>}
      </div>
    </div>

    <div className="min-w-0 bg-white dark:bg-slate-900">
      <div className="flex items-center justify-between bg-slate-50/80 px-4 py-2.5 dark:bg-slate-950/35">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-slate-200/70 text-slate-500 dark:bg-slate-800 dark:text-slate-300">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 13l2-5a2 2 0 011.86-1.26h10.28A2 2 0 0119 8l2 5m-18 0h18m-18 0v4a1 1 0 001 1h1m15-5v4a1 1 0 01-1 1h-1M7 16h.01M17 16h.01" />
            </svg>
          </span>
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
            Vehículos del cliente
            <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-[9px] text-slate-500 shadow-sm dark:bg-slate-800 dark:text-slate-300">{vehiculos.length}</span>
          </p>
        </div>
        <Link href={`/vehiculos/nuevo?cliente=${cliente.id}`} className="rounded-lg px-2.5 py-1.5 text-xs font-bold text-brand-600 transition hover:bg-brand-50 hover:text-brand-700 dark:text-brand-300 dark:hover:bg-brand-950/30">+ Agregar</Link>
      </div>
      {vehiculos.length
        ? <div className="divide-y divide-slate-100 dark:divide-slate-800">{vehiculos.map((vehiculo) => <VehiculoRow key={vehiculo.id} vehiculo={vehiculo} />)}</div>
        : <div className="flex flex-col items-start justify-center gap-2 px-4 py-6 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-bold text-slate-700 dark:text-slate-200">Todavía no tiene vehículos</p><p className="text-xs text-slate-500">Vinculá el primero sin volver a cargar al cliente.</p></div><Link href={`/vehiculos/nuevo?cliente=${cliente.id}`} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white dark:bg-brand-600">Agregar vehículo →</Link></div>}
    </div>
  </article>;
}

function VehiculoRow({ vehiculo }: { vehiculo: Vehiculo }) {
  const estado = estadoService(vehiculo);
  return <div className="grid gap-3 px-4 py-3.5 transition hover:bg-brand-50/25 dark:hover:bg-brand-950/10 md:grid-cols-[minmax(210px,1fr)_190px_auto] md:items-center">
    <div className="flex min-w-0 items-center gap-3">
      <span className="shrink-0 rounded-lg bg-slate-900 px-2.5 py-1.5 font-mono text-xs font-black tracking-widest text-white">{vehiculo.patente}</span>
      <span className="min-w-0"><strong className="block truncate text-sm text-slate-900 dark:text-white">{vehiculo.marca} {vehiculo.modelo}</strong><span className="block truncate text-xs text-slate-500">{[vehiculo.anio, vehiculo.color].filter(Boolean).join(" · ") || "Sin datos adicionales"}</span></span>
    </div>
    <div>
      <div className="flex items-center gap-2"><span className="font-mono text-xs font-black text-slate-800 dark:text-slate-100">{formatNumber(vehiculo.kilometraje_actual)} km</span><span className={cn("rounded-full border px-2 py-0.5 text-[9px] font-black uppercase tracking-wider", statusClasses[estado.tone as keyof typeof statusClasses])}>{estado.label}</span></div>
      <p className="mt-1 text-[11px] text-slate-500">{vehiculo.proximo_service_km ? `Próximo: ${formatNumber(vehiculo.proximo_service_km)} km` : "Service sin programar"}</p>
    </div>
    <div className="flex gap-2 md:justify-end">
      <CompartirHistorialButton vehiculo={vehiculo} />
      <Link href={`/vehiculos/${vehiculo.id}/historial`} className="rounded-lg border border-violet-200 px-3 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-50 dark:border-violet-900/60 dark:text-violet-300 dark:hover:bg-violet-950/30">Historial</Link>
      <Link href={`/presupuestos/nuevo?vehiculo=${vehiculo.id}`} className="rounded-lg border border-sky-200 px-3 py-2 text-xs font-bold text-sky-700 transition hover:bg-sky-50 dark:border-sky-900/60 dark:text-sky-300 dark:hover:bg-sky-950/30">Presupuestar</Link>
      <Link href={`/trabajos/nuevo?vehiculo=${vehiculo.id}`} className="rounded-lg bg-slate-900 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-800 dark:bg-brand-600 dark:hover:bg-brand-500">Nueva OT →</Link>
    </div>
  </div>;
}

function CompartirHistorialButton({ vehiculo }: { vehiculo: Vehiculo }) {
  const [estado, setEstado] = useState<"idle" | "copiado" | "error">("idle");

  async function compartir() {
    if (!vehiculo.token) {
      setEstado("error");
      return;
    }
    const url = `${window.location.origin}/p/vehiculo/${vehiculo.token}`;
    const texto = `Hola! Te compartimos el historial y seguimiento de tu ${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.patente}) 🚗\n\n${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `Historial · ${vehiculo.patente}`, text: texto, url });
        return;
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") return;
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setEstado("copiado");
      window.setTimeout(() => setEstado("idle"), 2500);
    } catch {
      setEstado("error");
    }
  }

  return <button type="button" onClick={() => void compartir()} className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${estado === "error" ? "border-rose-200 text-rose-600 dark:border-rose-900/60 dark:text-rose-300" : "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900/60 dark:text-emerald-300 dark:hover:bg-emerald-950/30"}`}>{estado === "copiado" ? "Link copiado" : estado === "error" ? "Sin portal" : "Compartir"}</button>;
}

function EmptyState() {
  return <div className="flex flex-col items-center px-6 py-14 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-xl dark:bg-slate-800">⌕</div><h2 className="mt-4 font-bold text-slate-900 dark:text-white">No encontramos coincidencias</h2><p className="mt-1 text-sm text-slate-500">Probá otra búsqueda o cargá un cliente con su vehículo.</p><Link href="/clientes/nuevo" className="mt-4 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white dark:bg-brand-600">Cliente y vehículo</Link></div>;
}

function LoadingRows() {
  return <div className="space-y-3 p-4">{[1, 2, 3].map((item) => <div key={item} className="h-32 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />)}</div>;
}
