"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BuscadorCliente } from "@/components/buscador-cliente";
import { Campo, campoClase, sinFlechas, Tarjeta } from "@/components/formulario";
import { crearVehiculo, getClientes } from "@/lib/api";
import type { Cliente } from "@/lib/types";
import { cn } from "@/lib/utils";

function FormularioVehiculo() {
  const router = useRouter();
  const clientePreId = useSearchParams().get("cliente");

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState(clientePreId ?? "");
  const [v, setV] = useState({ patente: "", marca: "", modelo: "", anio: "", color: "", kilometraje: "", proximoService: "" });
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState<null | "guardar" | "orden">(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getClientes()
      .then(setClientes)
      .catch(() => setError("No pudimos cargar los clientes. Recargá la página."))
      .finally(() => setCargando(false));
  }, []);

  const cambiar = (campo: keyof typeof v, valor: string) => setV((x) => ({ ...x, [campo]: valor }));
  const km = Number(v.kilometraje) || 0;
  const titular = clientes.find((c) => String(c.id) === clienteId);

  async function guardar(destino: "guardar" | "orden") {
    setError("");
    if (!clienteId) return setError("Elegí de quién es el auto.");
    if (!v.patente.trim()) return setError("Falta la patente.");
    if (!v.marca.trim()) return setError("Falta la marca.");
    setGuardando(destino);
    try {
      const creado = await crearVehiculo({
        cliente_id: Number(clienteId),
        patente: v.patente.trim().toUpperCase(),
        marca: v.marca.trim(),
        modelo: v.modelo.trim() || "S/D",
        anio: v.anio ? Number(v.anio) : null,
        color: v.color.trim(),
        kilometraje_actual: km,
        proximo_service_km: v.proximoService ? Number(v.proximoService) : null,
      });
      router.push(destino === "orden" ? `/trabajos/nuevo?vehiculo=${creado.id}` : `/clientes?id=${clienteId}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No pudimos guardar el vehículo.");
      setGuardando(null);
    }
  }

  if (cargando) {
    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
        <div className="h-56 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
      </div>
    );
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void guardar("guardar"); }} className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{error}</div>}

        <Tarjeta titulo="¿De quién es?" descripcion="Buscá el cliente. Si no está, cargalo primero como cliente nuevo.">
          <BuscadorCliente
            clientes={clientes}
            clienteId={clienteId}
            onElegir={(c) => setClienteId(c ? String(c.id) : "")}
            autoFocus={!clientePreId}
            onNoEncontrado={() => router.push("/clientes/nuevo")}
          />
        </Tarjeta>

        <Tarjeta titulo="El auto">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <Campo etiqueta="Patente" obligatorio>
              <input autoFocus={Boolean(clientePreId)} value={v.patente} onChange={(e) => cambiar("patente", e.target.value.toUpperCase().replace(/\s/g, ""))} placeholder="Ej: AB123CD" maxLength={10} className={cn(campoClase, "font-semibold uppercase tracking-wider placeholder:normal-case placeholder:font-normal placeholder:tracking-normal")} />
            </Campo>
            <Campo etiqueta="Marca" obligatorio>
              <input value={v.marca} onChange={(e) => cambiar("marca", e.target.value)} placeholder="Ej: Toyota" className={campoClase} />
            </Campo>
            <Campo etiqueta="Modelo">
              <input value={v.modelo} onChange={(e) => cambiar("modelo", e.target.value)} placeholder="Ej: Hilux" className={campoClase} />
            </Campo>
            <Campo etiqueta="Año">
              <input type="number" inputMode="numeric" value={v.anio} onChange={(e) => cambiar("anio", e.target.value)} placeholder="Ej: 2018" min={1950} max={2035} className={cn(campoClase, sinFlechas)} />
            </Campo>
            <Campo etiqueta="Color">
              <input value={v.color} onChange={(e) => cambiar("color", e.target.value)} placeholder="Ej: Blanco" className={campoClase} />
            </Campo>
            <Campo etiqueta="Kilometraje">
              <input type="number" inputMode="numeric" value={v.kilometraje} onChange={(e) => cambiar("kilometraje", e.target.value)} placeholder="Ej: 85000" min={0} className={cn(campoClase, sinFlechas)} />
            </Campo>
            <div className="sm:col-span-2 xl:col-span-3">
              <Campo etiqueta="Próximo service (km)" ayuda="Opcional. El cliente ve cuánto le falta en su link.">
                <div className="flex flex-wrap items-center gap-2">
                  <input type="number" inputMode="numeric" value={v.proximoService} onChange={(e) => cambiar("proximoService", e.target.value)} placeholder="Ej: 95000" min={0} className={cn(campoClase, sinFlechas, "max-w-[200px]")} />
                  {km > 0 && [5_000, 10_000, 15_000].map((mas) => (
                    <button key={mas} type="button" onClick={() => cambiar("proximoService", String(km + mas))} className="h-9 rounded-full px-3 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-700">
                      +{(mas / 1000).toLocaleString("es-AR")} mil
                    </button>
                  ))}
                </div>
              </Campo>
            </div>
          </div>
        </Tarjeta>
      </div>

      <aside className="lg:sticky lg:top-24">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">Así queda</p>
          <p className="mt-2 font-display text-2xl font-extrabold leading-tight text-slate-900 dark:text-white">{[v.marca, v.modelo].filter(Boolean).join(" ") || "El auto"}</p>
          <p className="text-sm uppercase tracking-wide text-slate-500">{v.patente || "Patente"}{v.anio ? ` · ${v.anio}` : ""}</p>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{titular ? `De ${titular.nombre_completo}` : "Falta elegir el dueño"}</p>
          <div className="mt-5 grid gap-2">
            <button type="button" onClick={() => void guardar("orden")} disabled={guardando !== null} className="inline-flex h-11 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60">
              {guardando === "orden" ? "Guardando…" : "Guardar y abrir orden →"}
            </button>
            <button type="submit" disabled={guardando !== null} className="inline-flex h-11 items-center justify-center rounded-xl text-sm font-bold text-slate-800 ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50 disabled:opacity-60 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-700">
              {guardando === "guardar" ? "Guardando…" : "Guardar vehículo"}
            </button>
            <Link href={clienteId ? `/clientes?id=${clienteId}` : "/clientes"} className="inline-flex h-10 items-center justify-center rounded-xl text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">Cancelar</Link>
          </div>
        </section>
      </aside>
    </form>
  );
}

export default function NuevoVehiculoPage() {
  return (
    <AppShell currentPath="/clientes" compact badge="Clientes" title="Nuevo vehículo" description="Sumale un auto a un cliente que ya tenés cargado.">
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />}>
        <FormularioVehiculo />
      </Suspense>
    </AppShell>
  );
}
