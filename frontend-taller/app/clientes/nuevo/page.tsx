"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { crearClienteConVehiculo } from "@/lib/api";
import { cn } from "@/lib/utils";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp";

const inputBase = "h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-950/50 dark:text-white dark:focus:border-brand-500";

export default function NuevoClientePage() {
  const router = useRouter();
  const [cliente, setCliente] = useState({ nombre: "", apellido: "", telefono: "", dni: "", email: "" });
  const [vehiculo, setVehiculo] = useState({ patente: "", marca: "", modelo: "", anio: "", color: "", kilometraje: "0", proximoService: "" });
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  function updateCliente(field: keyof typeof cliente, value: string) {
    setCliente((current) => ({ ...current, [field]: value }));
  }

  function updateVehiculo(field: keyof typeof vehiculo, value: string) {
    setVehiculo((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!cliente.nombre.trim()) return setError("Ingresá el nombre del cliente.");
    if (cliente.telefono.trim() && !normalizeWhatsAppPhone(cliente.telefono)) {
      return setError("Revisá el celular: ingresá código de área + número, sin el 15. Ejemplo: 342 5551234.");
    }
    if (!vehiculo.patente.trim()) return setError("Ingresá la patente del vehículo.");
    if (!vehiculo.marca.trim()) return setError("Ingresá la marca del vehículo.");

    setIsSaving(true);
    setError("");
    try {
      const creado = await crearClienteConVehiculo({
        cliente: {
          nombre: cliente.nombre.trim(),
          apellido: cliente.apellido.trim(),
          telefono: cliente.telefono.trim(),
          email: cliente.email.trim(),
          dni: cliente.dni.trim(),
        },
        vehiculo: {
          patente: vehiculo.patente.trim().toUpperCase(),
          marca: vehiculo.marca.trim(),
          modelo: vehiculo.modelo.trim() || "S/D",
          anio: vehiculo.anio ? Number(vehiculo.anio) : null,
          color: vehiculo.color.trim(),
          kilometraje_actual: Number(vehiculo.kilometraje) || 0,
          proximo_service_km: vehiculo.proximoService ? Number(vehiculo.proximoService) : null,
        },
      });
      router.push(`/clientes/${creado.cliente.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No pudimos guardar el cliente y su vehículo.");
      setIsSaving(false);
    }
  }

  return (
    <AppShell
      currentPath="/clientes"
      badge="Alta completa"
      title="Nuevo cliente y vehículo"
      description="Un solo formulario, un solo guardado y todo queda vinculado desde el inicio."
    >
      <form onSubmit={handleSubmit} className="mx-auto max-w-6xl">
        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        <div className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70 lg:grid-cols-2">
          <section className="border-b border-slate-200 p-5 dark:border-slate-800 sm:p-6 lg:border-b-0 lg:border-r">
            <SectionHeading number="1" title="Cliente" detail="Quién es y cómo contactarlo." />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Field label="Nombre" required>
                <input required autoFocus value={cliente.nombre} onChange={(event) => updateCliente("nombre", event.target.value)} placeholder="Ej: Juan" className={inputBase} />
              </Field>
              <Field label="Apellido">
                <input value={cliente.apellido} onChange={(event) => updateCliente("apellido", event.target.value)} placeholder="Ej: Pérez" className={inputBase} />
              </Field>
              <Field label="Teléfono">
                <input
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={cliente.telefono}
                  onChange={(event) => updateCliente("telefono", event.target.value)}
                  placeholder="Ej: 342 5551234"
                  className={inputBase}
                />
              </Field>
              <Field label="DNI / CUIT">
                <input value={cliente.dni} onChange={(event) => updateCliente("dni", event.target.value)} placeholder="Ej: 30-12345678-9" className={inputBase} />
              </Field>
              <Field label="Email" wide>
                <input type="email" value={cliente.email} onChange={(event) => updateCliente("email", event.target.value)} placeholder="Ej: juan@ejemplo.com" className={inputBase} />
              </Field>
              <div className="sm:col-span-2 flex items-start gap-2.5 rounded-xl bg-emerald-50 px-3.5 py-3 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
                <svg className="mt-0.5 h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                </svg>
                <p className="text-xs leading-5">
                  <strong>Importante para WhatsApp:</strong> cargá el celular real con código de área y sin el 15. Los presupuestos y comprobantes se enviarán directamente a ese chat.
                </p>
              </div>
            </div>
          </section>

          <section className="p-5 sm:p-6">
            <SectionHeading number="2" title="Primer vehículo" detail="Datos básicos y próximo mantenimiento." />
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <Field label="Patente" required>
                <input required value={vehiculo.patente} onChange={(event) => updateVehiculo("patente", event.target.value.toUpperCase())} placeholder="Ej: AB123CD" maxLength={10} className={cn(inputBase, "font-mono font-black uppercase tracking-widest")} />
              </Field>
              <Field label="Marca" required>
                <input required value={vehiculo.marca} onChange={(event) => updateVehiculo("marca", event.target.value)} placeholder="Ej: Toyota" className={inputBase} />
              </Field>
              <Field label="Modelo">
                <input value={vehiculo.modelo} onChange={(event) => updateVehiculo("modelo", event.target.value)} placeholder="Ej: Corolla" className={inputBase} />
              </Field>
              <Field label="Año">
                <input type="number" value={vehiculo.anio} onChange={(event) => updateVehiculo("anio", event.target.value)} placeholder="Ej: 2018" min={1950} max={2035} className={inputBase} />
              </Field>
              <Field label="Color">
                <input value={vehiculo.color} onChange={(event) => updateVehiculo("color", event.target.value)} placeholder="Ej: Blanco" className={inputBase} />
              </Field>
              <Field label="Kilometraje actual">
                <input type="number" value={vehiculo.kilometraje} onChange={(event) => updateVehiculo("kilometraje", event.target.value)} min={0} className={inputBase} />
              </Field>
              <Field label="Próximo service (km)" wide>
                <input type="number" value={vehiculo.proximoService} onChange={(event) => updateVehiculo("proximoService", event.target.value)} placeholder="Se puede definir más adelante" min={0} className={inputBase} />
              </Field>
            </div>
          </section>
        </div>

        <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">Ambos registros se guardan juntos. Si algo falla, no queda información incompleta.</p>
          <div className="flex gap-2">
            <Link href="/clientes" className="inline-flex justify-center rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">Cancelar</Link>
            <button type="submit" disabled={isSaving} className="inline-flex min-w-52 justify-center rounded-xl bg-slate-900 px-6 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500">
              {isSaving ? "Guardando…" : "Crear cliente y vehículo →"}
            </button>
          </div>
        </div>
      </form>
    </AppShell>
  );
}

function SectionHeading({ number, title, detail }: { number: string; title: string; detail: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-sm font-black text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">{number}</span>
      <div>
        <h2 className="text-lg font-black text-slate-900 dark:text-white">{title}</h2>
        <p className="text-xs text-slate-500">{detail}</p>
      </div>
    </div>
  );
}

function Field({ label, required = false, wide = false, children }: { label: string; required?: boolean; wide?: boolean; children: React.ReactNode }) {
  return (
    <label className={cn("space-y-1.5", wide && "sm:col-span-2")}>
      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{label}{required && <span className="text-brand-600"> *</span>}</span>
      {children}
    </label>
  );
}
