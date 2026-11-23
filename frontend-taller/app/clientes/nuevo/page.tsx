"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Campo, campoClase, sinFlechas, Tarjeta } from "@/components/formulario";
import { crearCliente, crearClienteConVehiculo } from "@/lib/api";
import { cn } from "@/lib/utils";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp";
import { CONDICIONES_IVA_CLIENTE } from "@/lib/fiscal";

export default function NuevoClientePage() {
  const router = useRouter();
  const [cliente, setCliente] = useState({ nombre: "", apellido: "", telefono: "", dni: "", email: "", condicion_iva: "CONSUMIDOR_FINAL" });
  const [vehiculo, setVehiculo] = useState({ patente: "", marca: "", modelo: "", anio: "", color: "", kilometraje: "", proximoService: "" });
  const [sinAuto, setSinAuto] = useState(false);
  const [guardando, setGuardando] = useState<null | "guardar" | "orden">(null);
  const [error, setError] = useState("");

  const cambiarCliente = (campo: keyof typeof cliente) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setCliente((c) => ({ ...c, [campo]: e.target.value }));
  const cambiarVehiculo = (campo: keyof typeof vehiculo, valor: string) => setVehiculo((v) => ({ ...v, [campo]: valor }));

  const digitos = cliente.telefono.replace(/\D/g, "");
  const telefonoOk = Boolean(cliente.telefono.trim() && normalizeWhatsAppPhone(cliente.telefono));
  const telefonoMal = digitos.length >= 8 && !telefonoOk;
  const km = Number(vehiculo.kilometraje) || 0;

  async function guardar(destino: "guardar" | "orden") {
    setError("");
    if (!cliente.nombre.trim()) return setError("Escribí el nombre del cliente.");
    if (cliente.telefono.trim() && !telefonoOk) return setError("Revisá el celular: código de área + número, sin el 15. Ej: 342 555 1234.");
    if (!sinAuto && !vehiculo.patente.trim()) return setError("Falta la patente del auto.");
    if (!sinAuto && !vehiculo.marca.trim()) return setError("Falta la marca del auto.");

    setGuardando(destino);
    const datosCliente = {
      nombre: cliente.nombre.trim(),
      apellido: cliente.apellido.trim(),
      telefono: cliente.telefono.trim(),
      email: cliente.email.trim(),
      dni: cliente.dni.trim(),
      condicion_iva: cliente.condicion_iva,
    };
    try {
      if (sinAuto) {
        const creado = await crearCliente(datosCliente);
        router.push(`/clientes?id=${creado.id}`);
        return;
      }
      const creado = await crearClienteConVehiculo({
        cliente: datosCliente,
        vehiculo: {
          patente: vehiculo.patente.trim().toUpperCase(),
          marca: vehiculo.marca.trim(),
          modelo: vehiculo.modelo.trim() || "S/D",
          anio: vehiculo.anio ? Number(vehiculo.anio) : null,
          color: vehiculo.color.trim(),
          kilometraje_actual: km,
          proximo_service_km: vehiculo.proximoService ? Number(vehiculo.proximoService) : null,
        },
      });
      router.push(destino === "orden" ? `/trabajos/nuevo?vehiculo=${creado.vehiculo.id}` : `/clientes?id=${creado.cliente.id}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No pudimos guardar el cliente.");
      setGuardando(null);
    }
  }

  const nombreCompleto = [cliente.nombre, cliente.apellido].map((x) => x.trim()).filter(Boolean).join(" ");

  return (
    <AppShell currentPath="/clientes" compact badge="Clientes" title="Nuevo cliente" description="Sus datos y su auto en un solo paso. Después le podés sumar más vehículos.">
      <form onSubmit={(e) => { e.preventDefault(); void guardar("guardar"); }} className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-4">
          {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{error}</div>}

          <Tarjeta titulo="Cliente" descripcion="Con el celular le llegan presupuestos, avisos y el link de su auto por WhatsApp.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Nombre" obligatorio>
                <input autoFocus value={cliente.nombre} onChange={cambiarCliente("nombre")} placeholder="Ej: Juan" autoComplete="off" className={campoClase} />
              </Campo>
              <Campo etiqueta="Apellido">
                <input value={cliente.apellido} onChange={cambiarCliente("apellido")} placeholder="Ej: Pérez" autoComplete="off" className={campoClase} />
              </Campo>
              <Campo
                etiqueta="Celular (WhatsApp)"
                error={telefonoMal ? "Revisalo: código de área + número, sin el 15." : ""}
                ok={telefonoOk ? "✓ Le van a llegar los WhatsApp" : ""}
                ayuda="Código de área + número, sin el 15."
              >
                <input type="tel" inputMode="tel" value={cliente.telefono} onChange={cambiarCliente("telefono")} placeholder="Ej: 342 555 1234" className={cn(campoClase, telefonoMal && "border-red-400 focus:border-red-500")} />
              </Campo>
              <Campo etiqueta="DNI / CUIT" ayuda="Opcional. Lo usa el contador para facturar.">
                <input value={cliente.dni} onChange={cambiarCliente("dni")} placeholder="Ej: 30123456" className={campoClase} />
              </Campo>
              <Campo etiqueta="Email" ayuda="Opcional.">
                <input type="email" value={cliente.email} onChange={cambiarCliente("email")} placeholder="Ej: juan@gmail.com" className={campoClase} />
              </Campo>
              <Campo etiqueta="Condición frente al IVA" ayuda="Si no sabés, dejalo en consumidor final.">
                <select value={cliente.condicion_iva} onChange={cambiarCliente("condicion_iva")} className={campoClase}>
                  {CONDICIONES_IVA_CLIENTE.map((c) => <option key={c.valor} value={c.valor}>{c.etiqueta}</option>)}
                </select>
              </Campo>
            </div>
          </Tarjeta>

          <Tarjeta
            titulo="Su auto"
            descripcion={sinAuto ? "Se lo agregás después desde su ficha." : "El que trae ahora. Si tiene más, se suman desde su ficha."}
            extra={
              <label className="flex shrink-0 cursor-pointer items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={sinAuto} onChange={(e) => setSinAuto(e.target.checked)} className="h-4 w-4 accent-brand-600" />
                Todavía no
              </label>
            }
          >
            {!sinAuto && (
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Campo etiqueta="Patente" obligatorio>
                  <input value={vehiculo.patente} onChange={(e) => cambiarVehiculo("patente", e.target.value.toUpperCase().replace(/\s/g, ""))} placeholder="Ej: AB123CD" maxLength={10} className={cn(campoClase, "font-semibold uppercase tracking-wider placeholder:normal-case placeholder:font-normal placeholder:tracking-normal")} />
                </Campo>
                <Campo etiqueta="Marca" obligatorio>
                  <input value={vehiculo.marca} onChange={(e) => cambiarVehiculo("marca", e.target.value)} placeholder="Ej: Toyota" className={campoClase} />
                </Campo>
                <Campo etiqueta="Modelo">
                  <input value={vehiculo.modelo} onChange={(e) => cambiarVehiculo("modelo", e.target.value)} placeholder="Ej: Hilux" className={campoClase} />
                </Campo>
                <Campo etiqueta="Año">
                  <input type="number" inputMode="numeric" value={vehiculo.anio} onChange={(e) => cambiarVehiculo("anio", e.target.value)} placeholder="Ej: 2018" min={1950} max={2035} className={cn(campoClase, sinFlechas)} />
                </Campo>
                <Campo etiqueta="Color">
                  <input value={vehiculo.color} onChange={(e) => cambiarVehiculo("color", e.target.value)} placeholder="Ej: Blanco" className={campoClase} />
                </Campo>
                <Campo etiqueta="Kilometraje">
                  <input type="number" inputMode="numeric" value={vehiculo.kilometraje} onChange={(e) => cambiarVehiculo("kilometraje", e.target.value)} placeholder="Ej: 85000" min={0} className={cn(campoClase, sinFlechas)} />
                </Campo>
                <div className="sm:col-span-2 xl:col-span-3">
                  <Campo etiqueta="Próximo service (km)" ayuda="Opcional. Con esto el cliente ve cuánto le falta en su link.">
                    <div className="flex flex-wrap items-center gap-2">
                      <input type="number" inputMode="numeric" value={vehiculo.proximoService} onChange={(e) => cambiarVehiculo("proximoService", e.target.value)} placeholder="Ej: 95000" min={0} className={cn(campoClase, sinFlechas, "max-w-[200px]")} />
                      {km > 0 && [5_000, 10_000, 15_000].map((mas) => (
                        <button key={mas} type="button" onClick={() => cambiarVehiculo("proximoService", String(km + mas))} className="h-9 rounded-full px-3 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-700">
                          +{(mas / 1000).toLocaleString("es-AR")} mil
                        </button>
                      ))}
                    </div>
                  </Campo>
                </div>
              </div>
            )}
          </Tarjeta>
        </div>

        <aside className="space-y-4 lg:sticky lg:top-24">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <p className="text-xs text-slate-500 dark:text-slate-400">Así queda</p>
            <div className="mt-3 flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 font-bold text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">{(nombreCompleto || "?").charAt(0).toUpperCase()}</span>
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900 dark:text-white">{nombreCompleto || "Nombre del cliente"}</p>
                <p className="truncate text-sm text-slate-500 dark:text-slate-400">{cliente.telefono || "Sin celular"}</p>
              </div>
            </div>
            {!sinAuto && (
              <div className="mt-3 rounded-xl bg-slate-50 px-3.5 py-2.5 dark:bg-slate-900/50">
                <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{[vehiculo.marca, vehiculo.modelo].filter(Boolean).join(" ") || "Su auto"}{vehiculo.anio ? ` ${vehiculo.anio}` : ""}</p>
                <p className="text-xs uppercase tracking-wide text-slate-500">{vehiculo.patente || "Patente"}{km ? ` · ${km.toLocaleString("es-AR")} km` : ""}</p>
              </div>
            )}
            <div className="mt-5 grid gap-2">
              {!sinAuto && (
                <button type="button" onClick={() => void guardar("orden")} disabled={guardando !== null} className="inline-flex h-11 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60">
                  {guardando === "orden" ? "Guardando…" : "Guardar y abrir orden →"}
                </button>
              )}
              <button type="submit" disabled={guardando !== null} className={cn("inline-flex h-11 items-center justify-center rounded-xl text-sm font-bold transition disabled:opacity-60", sinAuto ? "bg-brand-600 text-white shadow-sm hover:bg-brand-700" : "text-slate-800 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-700")}>
                {guardando === "guardar" ? "Guardando…" : "Guardar cliente"}
              </button>
              <Link href="/clientes" className="inline-flex h-10 items-center justify-center rounded-xl text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">Cancelar</Link>
            </div>
            {!sinAuto && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">&quot;Abrir orden&quot; es para cuando el auto ya está en el taller.</p>}
          </section>
        </aside>
      </form>
    </AppShell>
  );
}
