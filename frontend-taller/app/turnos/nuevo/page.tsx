"use client";

import { Suspense, useEffect, useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SearchableSelect } from "@/components/searchable-select";
import { crearTurno, editarTurno, getClientes, getTurnoById, getVehiculos } from "@/lib/api";
import type { Cliente, Vehiculo } from "@/lib/types";
import { cn } from "@/lib/utils";

const inputBase = "h-11 w-full rounded-xl bg-slate-50 px-4 text-sm text-slate-900 outline-none ring-1 ring-slate-200 transition focus:bg-white focus:ring-2 focus:ring-brand-400 dark:bg-slate-950 dark:text-white dark:ring-slate-800 dark:focus:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50";

function FormularioTurno() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const clientePreId = searchParams.get("cliente");
  const vehiculoPreId = searchParams.get("vehiculo");

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [vehiculosFiltrados, setVehiculosFiltrados] = useState<Vehiculo[]>([]);
  const [modoCliente, setModoCliente] = useState<"DIRECTORIO" | "EXPRESS">("DIRECTORIO");

  const [fechaHora, setFechaHora] = useState("");
  const [motivo, setMotivo] = useState("");
  const [notas, setNotas] = useState("");
  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState("");
  const [vehiculoSeleccionadoId, setVehiculoSeleccionadoId] = useState("");
  const [expressNombre, setExpressNombre] = useState("");
  const [expressTelefono, setExpressTelefono] = useState("");
  const [expressPatente, setExpressPatente] = useState("");
  const [expressMarca, setExpressMarca] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRedirecting, startRedirect] = useTransition();
  const [feedback, setFeedback] = useState({ tone: "idle", message: "" });

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const [clientesData, vehiculosData] = await Promise.all([getClientes(), getVehiculos()]);
        if (!active) return;
        setClientes(clientesData);
        setVehiculos(vehiculosData);

        if (editId) {
          const turno = await getTurnoById(Number(editId));
          if (!active) return;
          const fecha = new Date(turno.fecha_hora);
          setFechaHora(new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60000).toISOString().slice(0, 16));
          setMotivo(turno.motivo);
          setNotas(turno.notas || "");
          const cliente = clientesData.find((item) => turno.cliente_nombre?.includes(item.nombre));
          if (cliente) {
            const autos = vehiculosData.filter((vehiculo) => vehiculo.cliente_id === cliente.id);
            const auto = autos.find((vehiculo) => turno.vehiculo_desc?.includes(vehiculo.patente) || turno.patente === vehiculo.patente);
            setClienteSeleccionadoId(cliente.id.toString());
            setVehiculosFiltrados(autos);
            if (auto) setVehiculoSeleccionadoId(auto.id.toString());
          }
        } else if (vehiculoPreId) {
          const auto = vehiculosData.find((vehiculo) => vehiculo.id === Number(vehiculoPreId));
          if (auto) {
            setClienteSeleccionadoId(auto.cliente_id.toString());
            setVehiculoSeleccionadoId(auto.id.toString());
            setVehiculosFiltrados(vehiculosData.filter((vehiculo) => vehiculo.cliente_id === auto.cliente_id));
          }
        } else if (clientePreId) {
          const clienteExiste = clientesData.some((cliente) => cliente.id === Number(clientePreId));
          if (clienteExiste) {
            setClienteSeleccionadoId(clientePreId);
            setVehiculosFiltrados(vehiculosData.filter((vehiculo) => vehiculo.cliente_id === Number(clientePreId)));
          }
        }
      } catch {
        if (active) setFeedback({ tone: "error", message: "No pudimos cargar los datos necesarios para programar el turno." });
      } finally {
        if (active) setIsLoading(false);
      }
    }
    init();
    return () => { active = false; };
  }, [clientePreId, editId, vehiculoPreId]);

  function handleClienteChange(id: string) {
    setClienteSeleccionadoId(id);
    setVehiculoSeleccionadoId("");
    setVehiculosFiltrados(id ? vehiculos.filter((vehiculo) => vehiculo.cliente_id === Number(id)) : []);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback({ tone: "idle", message: "" });
    if (!fechaHora) return setFeedback({ tone: "error", message: "Elegí la fecha y la hora del turno." });
    if (!motivo.trim()) return setFeedback({ tone: "error", message: "Indicá el motivo del ingreso." });
    if ((modoCliente === "DIRECTORIO" || editId) && (!clienteSeleccionadoId || !vehiculoSeleccionadoId)) {
      return setFeedback({ tone: "error", message: "Seleccioná el cliente y el vehículo." });
    }
    if (modoCliente === "EXPRESS" && !editId && (!expressNombre.trim() || !expressPatente.trim() || !expressMarca.trim())) {
      return setFeedback({ tone: "error", message: "Completá nombre, patente y vehículo para el alta rápida." });
    }

    setIsSaving(true);
    const payload = {
      fecha_hora: new Date(fechaHora).toISOString(),
      motivo: motivo.trim(),
      notas: notas.trim(),
      cliente_id: modoCliente === "DIRECTORIO" || editId ? Number(clienteSeleccionadoId) : undefined,
      vehiculo_id: modoCliente === "DIRECTORIO" || editId ? Number(vehiculoSeleccionadoId) : undefined,
      cliente_express: modoCliente === "EXPRESS" && !editId ? { nombre: expressNombre.trim(), telefono: expressTelefono.trim() } : undefined,
      vehiculo_express: modoCliente === "EXPRESS" && !editId ? { patente: expressPatente.trim().toUpperCase(), marca: expressMarca.trim() } : undefined,
    };

    try {
      if (editId) await editarTurno(Number(editId), payload);
      else await crearTurno(payload);
      setFeedback({ tone: "success", message: editId ? "Turno actualizado." : "Turno agendado." });
      startRedirect(() => router.push("/turnos"));
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No pudimos guardar el turno." });
      setIsSaving(false);
    }
  }

  if (isLoading) return <div className="grid gap-4 lg:grid-cols-2"><div className="h-80 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" /><div className="h-80 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" /></div>;

  const clienteActual = clientes.find((cliente) => cliente.id === Number(clienteSeleccionadoId));
  const vehiculoActual = vehiculos.find((vehiculo) => vehiculo.id === Number(vehiculoSeleccionadoId));

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 xl:grid-cols-2">
      {feedback.message && (
        <div className={cn("rounded-xl px-4 py-3 text-sm font-semibold xl:col-span-2", feedback.tone === "success" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-300" : "bg-red-50 text-red-700 dark:bg-red-950/30 dark:text-red-300")}>
          {feedback.message}
        </div>
      )}

      <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400">Paso 1</p>
            <h2 className="mt-1 text-lg font-black text-slate-900 dark:text-white">Cliente y vehículo</h2>
            <p className="text-xs text-slate-500">Elegí un registro existente o cargá uno al momento.</p>
          </div>
          {!editId && (
            <div className="flex shrink-0 rounded-xl bg-slate-100 p-1 dark:bg-slate-950">
              <ModeButton active={modoCliente === "DIRECTORIO"} onClick={() => setModoCliente("DIRECTORIO")}>Directorio</ModeButton>
              <ModeButton active={modoCliente === "EXPRESS"} onClick={() => setModoCliente("EXPRESS")}>Alta rápida</ModeButton>
            </div>
          )}
        </div>

        {modoCliente === "DIRECTORIO" || editId ? (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Cliente titular">
              <SearchableSelect
                value={clienteSeleccionadoId}
                onChange={handleClienteChange}
                disabled={!!editId}
                placeholder="Seleccionar cliente…"
                searchPlaceholder="Buscar por nombre, teléfono o DNI…"
                emptyMessage="No encontramos clientes con esa búsqueda."
                options={clientes.map((cliente) => ({
                  value: cliente.id.toString(),
                  label: cliente.nombre_completo,
                  sublabel: cliente.telefono || cliente.email || undefined,
                }))}
              />
            </Field>
            <Field label="Vehículo">
              <SearchableSelect
                value={vehiculoSeleccionadoId}
                onChange={setVehiculoSeleccionadoId}
                disabled={!clienteSeleccionadoId || !!editId}
                placeholder={clienteSeleccionadoId ? "Seleccionar vehículo…" : "Elegí primero el cliente"}
                searchPlaceholder="Buscar por patente, marca o modelo…"
                emptyMessage="No encontramos vehículos con esa búsqueda."
                options={vehiculosFiltrados.map((vehiculo) => ({
                  value: vehiculo.id.toString(),
                  label: `${vehiculo.patente} · ${vehiculo.marca} ${vehiculo.modelo}`,
                }))}
              />
            </Field>
            <div className="rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-950 sm:col-span-2">
              {clienteActual ? (
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div><p className="text-xs font-black text-slate-800 dark:text-slate-100">{clienteActual.nombre_completo}</p><p className="text-[11px] text-slate-500">{clienteActual.telefono || clienteActual.email || "Sin contacto registrado"}</p></div>
                  {vehiculoActual ? <div className="text-right"><p className="font-mono text-xs font-black text-slate-800 dark:text-slate-100">{vehiculoActual.patente}</p><p className="text-[11px] text-slate-500">{vehiculoActual.marca} {vehiculoActual.modelo}</p></div> : <span className="text-[11px] text-slate-400">Falta seleccionar el vehículo</span>}
                </div>
              ) : <p className="text-xs text-slate-400">La información seleccionada aparecerá acá.</p>}
            </div>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <Field label="Nombre y apellido"><input value={expressNombre} onChange={(event) => setExpressNombre(event.target.value)} placeholder="Ej. Juan Pérez" className={inputBase} /></Field>
            <Field label="Teléfono"><input value={expressTelefono} onChange={(event) => setExpressTelefono(event.target.value)} placeholder="Opcional" className={inputBase} /></Field>
            <Field label="Patente"><input value={expressPatente} onChange={(event) => setExpressPatente(event.target.value.toUpperCase())} placeholder="AB123CD" className={cn(inputBase, "font-mono font-bold uppercase")} /></Field>
            <Field label="Marca y modelo"><input value={expressMarca} onChange={(event) => setExpressMarca(event.target.value)} placeholder="Ej. Toyota Corolla" className={inputBase} /></Field>
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm dark:bg-slate-900 sm:p-6">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-brand-600 dark:text-brand-400">Paso 2</p>
          <h2 className="mt-1 text-lg font-black text-slate-900 dark:text-white">Fecha y trabajo previsto</h2>
          <p className="text-xs text-slate-500">Definí cuándo llega y qué necesita el vehículo.</p>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-[220px_minmax(0,1fr)]">
          <Field label="Fecha y hora">
            <input type="datetime-local" required value={fechaHora} onChange={(event) => setFechaHora(event.target.value)} className={cn(inputBase, "font-semibold")} />
          </Field>
          <Field label="Motivo principal">
            <input required value={motivo} onChange={(event) => setMotivo(event.target.value)} placeholder="Ej. Cambio de aceite y filtros" className={inputBase} />
          </Field>
          <Field label="Notas internas" className="sm:col-span-2">
            <textarea value={notas} onChange={(event) => setNotas(event.target.value)} placeholder="Indicaciones, disponibilidad del cliente o información adicional…" rows={4} className={cn(inputBase, "h-28 resize-none py-3")} />
          </Field>
        </div>
      </section>

      <div className="flex flex-col-reverse items-center justify-end gap-2 rounded-2xl bg-white p-3 shadow-sm dark:bg-slate-900 sm:flex-row xl:col-span-2">
        <Link href="/turnos" className="w-full rounded-xl px-5 py-3 text-center text-sm font-bold text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-800 dark:hover:text-white sm:w-auto">Cancelar</Link>
        <button type="submit" disabled={isSaving || isRedirecting} className="w-full min-w-44 rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500 sm:w-auto">
          {isSaving ? "Guardando…" : isRedirecting ? "Abriendo agenda…" : editId ? "Guardar cambios" : "Confirmar turno"}
        </button>
      </div>
    </form>
  );
}

function ModeButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return <button type="button" onClick={onClick} className={cn("rounded-lg px-3 py-2 text-xs font-bold transition", active ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-white" : "text-slate-500 dark:text-slate-400")}>{children}</button>;
}

function Field({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return <label className={cn("space-y-1.5", className)}><span className="text-xs font-bold text-slate-700 dark:text-slate-300">{label}</span>{children}</label>;
}

export default function NuevoTurnoPage() {
  return (
    <AppShell currentPath="/turnos" badge="Agenda" title="Programar turno" description="Cliente, vehículo y horario en una sola vista.">
      <div className="mx-auto max-w-7xl">
        <Suspense fallback={<div className="grid gap-4 lg:grid-cols-2"><div className="h-80 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" /><div className="h-80 animate-pulse rounded-2xl bg-slate-200 dark:bg-slate-800" /></div>}>
          <FormularioTurno />
        </Suspense>
      </div>
    </AppShell>
  );
}
