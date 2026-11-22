"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { getClienteById, getVehiculosPorCliente, getTrabajosPorCliente, getMovimientosCliente, editarCliente, renovarPortalVehiculo } from "@/lib/api";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import type { Cliente, Trabajo, Vehiculo, MovimientoCuenta } from "@/lib/types";
import { cn } from "@/lib/utils";
import { normalizeWhatsAppPhone } from "@/lib/whatsapp";
import { numeroOrden } from "@/lib/documentos";
import { Patente } from "@/components/patente";

/**
 * Ficha del cliente. La misma se usa en dos lugares:
 * - "pagina": /clientes/[id], con el encabezado y los botones en la cabecera.
 * - "panel": a la derecha de la lista de Clientes; trae su propio encabezado
 *   y se acomoda a un ancho menor (todo en una columna).
 */
export function FichaCliente({
  clienteId,
  variante = "pagina",
  onCliente,
  onError,
  onCambio,
}: {
  clienteId: number;
  variante?: "pagina" | "panel";
  /** Avisa los datos del cliente apenas cargan (la página los usa en la cabecera). */
  onCliente?: (cliente: Cliente) => void;
  onError?: (mensaje: string) => void;
  /** Avisa cuando se editaron los datos (la lista actualiza el nombre). */
  onCambio?: (cliente: Cliente) => void;
}) {
  const enPanel = variante === "panel";
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [trabajos, setTrabajos] = useState<Trabajo[]>([]);
  const [movimientos, setMovimientos] = useState<MovimientoCuenta[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notificacion, setNotificacion] = useState({ msg: "", isError: false });
  const [tabActiva, setTabActiva] = useState<"historial" | "cuenta">("historial");

  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({ nombre: "", apellido: "", telefono: "", email: "", dni: "" });

  useEffect(() => {
    async function cargarPerfil() {
      try {
        setLoading(true);
        const [clienteData, vehiculosData, trabajosData, movimientosData] = await Promise.all([
          getClienteById(clienteId),
          getVehiculosPorCliente(clienteId),
          getTrabajosPorCliente(clienteId),
          getMovimientosCliente(clienteId),
        ]);

        setCliente(clienteData);
        onCliente?.(clienteData);
        setFormData({
          nombre: clienteData.nombre,
          apellido: clienteData.apellido || "",
          telefono: clienteData.telefono || "",
          email: clienteData.email || "",
          dni: clienteData.dni || "",
        });
        setVehiculos(vehiculosData);
        setTrabajos(trabajosData);
        setMovimientos(movimientosData);
      } catch {
        setError("No se pudo cargar el expediente del cliente.");
        onError?.("No se pudo cargar el expediente del cliente.");
      } finally {
        setLoading(false);
      }
    }
    setIsEditing(false);
    setTabActiva("historial");
    cargarPerfil();
    // onCliente/onError son avisos: recargar sólo cuando cambia el cliente.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteId]);

  async function handleGuardar() {
    if (!formData.nombre.trim()) {
      mostrarNotificacion("El nombre es obligatorio", true);
      return;
    }
    if (formData.telefono.trim() && !normalizeWhatsAppPhone(formData.telefono)) {
      mostrarNotificacion("Revisá el celular: usá código de área + número, sin el 15.", true);
      return;
    }
    setIsSaving(true);
    try {
      const clienteActualizado = await editarCliente(clienteId, formData);
      setCliente(clienteActualizado);
      onCambio?.(clienteActualizado);
      setIsEditing(false);
      mostrarNotificacion("Perfil actualizado correctamente");
    } catch (error) {
      mostrarNotificacion(error instanceof Error ? error.message : "Error al actualizar", true);
    } finally {
      setIsSaving(false);
    }
  }

  function mostrarNotificacion(msg: string, isError = false) {
    setNotificacion({ msg, isError });
    setTimeout(() => setNotificacion({ msg: "", isError: false }), 3000);
  }


  if (loading) {
    return (
      <div className="flex h-[40vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
      </div>
    );
  }

  if (error || !cliente) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-800 dark:border-red-900/50 dark:bg-red-950/20 dark:text-red-300">
        <p className="font-bold">{error || "El cliente especificado no existe."}</p>
      </div>
    );
  }

  const saldo = Number(cliente.saldo_balance);
  const tieneDeuda = saldo > 0;
  const inputStyle = "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white";
  const trabajosValidos = trabajos.filter((t) => t.estado !== "ANULADO");
  const totalFacturado = trabajosValidos.reduce((acc, t) => acc + Number(t.total), 0);
  const ultimaVisita = trabajosValidos.reduce<string | null>((max, t) => (!max || t.fecha_ingreso > max ? t.fecha_ingreso : max), null);
  const fecha = (valor: string) => formatDateTime(valor).split(",")[0];

  return (
      <div className="space-y-5">
        {/* ── Encabezado: nombre y datos de contacto en una sola tarjeta;
            "Editar" los abre ahí mismo ── */}
        <section className={cn("rounded-2xl border bg-white p-5 shadow-sm transition dark:bg-slate-800", isEditing ? "border-brand-400 ring-4 ring-brand-500/10" : "border-slate-200 dark:border-slate-700")}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              {enPanel && (
                <h2 className="truncate font-display text-3xl font-extrabold uppercase leading-none tracking-tight text-slate-900 dark:text-white">{cliente.nombre_completo}</h2>
              )}
              {!isEditing && (
                <dl className={cn("flex flex-wrap gap-x-6 gap-y-2 text-sm", enPanel && "mt-3")}>
                  <DatoEnLinea etiqueta="Celular" valor={cliente.telefono} faltante="Cargar celular" onFaltante={() => setIsEditing(true)} />
                  <DatoEnLinea etiqueta="Email" valor={cliente.email} />
                  <DatoEnLinea etiqueta="DNI o CUIT" valor={cliente.dni} />
                  <div className="flex items-end">
                    <button onClick={() => setIsEditing(true)} className="text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">Editar datos</button>
                  </div>
                </dl>
              )}
            </div>
            {enPanel && (
              <div className="flex flex-wrap items-center gap-2">
                <AccionesCliente cliente={cliente} />
              </div>
            )}
          </div>

          {isEditing && (
            <div className={cn("grid gap-3 sm:grid-cols-2 xl:grid-cols-3", enPanel && "mt-4")}>
              <CampoEditable etiqueta="Nombre">
                <input type="text" value={formData.nombre} onChange={(e) => setFormData({ ...formData, nombre: e.target.value })} className={inputStyle} />
              </CampoEditable>
              <CampoEditable etiqueta="Apellido o razón social">
                <input type="text" value={formData.apellido} onChange={(e) => setFormData({ ...formData, apellido: e.target.value })} className={inputStyle} />
              </CampoEditable>
              <CampoEditable etiqueta="Celular" ayuda="Código de área + número, sin el 15. Se usa para WhatsApp.">
                <input type="tel" inputMode="tel" autoComplete="tel" value={formData.telefono} onChange={(e) => setFormData({ ...formData, telefono: e.target.value })} placeholder="Ej: 342 5551234" className={inputStyle} />
              </CampoEditable>
              <CampoEditable etiqueta="DNI o CUIT">
                <input type="text" value={formData.dni} onChange={(e) => setFormData({ ...formData, dni: e.target.value })} className={inputStyle} />
              </CampoEditable>
              <CampoEditable etiqueta="Email">
                <input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className={inputStyle} />
              </CampoEditable>
              <div className="flex items-end gap-2">
                <button onClick={() => setIsEditing(false)} className="flex-1 rounded-xl border border-slate-200 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700">Cancelar</button>
                <button onClick={handleGuardar} disabled={isSaving} className="flex-1 rounded-xl bg-brand-600 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50">
                  {isSaving ? "Guardando…" : "Guardar"}
                </button>
              </div>
            </div>
          )}
        </section>
        {notificacion.msg && (
          <div role="status" className={cn("fixed bottom-6 right-6 z-50 rounded-lg px-5 py-3 text-sm font-semibold text-white shadow-2xl", notificacion.isError ? "bg-red-600" : "bg-slate-900 dark:bg-brand-600")}>
            {notificacion.msg}
          </div>
        )}

        {/* ── Resumen ── */}
        <div className={cn("grid grid-cols-2 gap-3", enPanel ? "xl:grid-cols-4" : "lg:grid-cols-4")}>
          <div className={cn("rounded-2xl border p-4", tieneDeuda ? "border-red-200 bg-red-50/70 dark:border-red-900/40 dark:bg-red-950/20" : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800")}>
            <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{tieneDeuda ? "Debe" : saldo < 0 ? "Saldo a favor" : "Cuenta corriente"}</p>
            <p className={cn("mt-1 font-display text-3xl font-extrabold leading-none tabular-nums", tieneDeuda ? "text-red-700 dark:text-red-400" : "text-slate-900 dark:text-white")}>
              {tieneDeuda || saldo < 0 ? formatCurrency(Math.abs(saldo)) : "Al día"}
            </p>
            {tieneDeuda ? (
              <Link href={`/pagos/registrar?cliente=${cliente.id}`} className="mt-1 inline-block text-xs font-semibold text-red-700 hover:underline dark:text-red-400">Registrar pago →</Link>
            ) : (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Sin deuda pendiente</p>
            )}
          </div>
          <Resumen titulo="Vehículos" valor={String(vehiculos.length)} detalle={vehiculos.length === 1 ? "registrado" : "registrados"} />
          <Resumen titulo="Órdenes" valor={String(trabajosValidos.length)} detalle={ultimaVisita ? `Última visita ${fecha(ultimaVisita)}` : "Todavía sin visitas"} />
          <Resumen titulo="Facturado" valor={formatCurrency(totalFacturado)} detalle="Suma de sus órdenes" />
        </div>

        <div className="min-w-0 space-y-5">
            {/* ── Vehículos ── */}
            <SectionCard
              compact
              title="Vehículos"
              action={<Link href={`/vehiculos/nuevo?cliente=${cliente.id}`} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700">+ Agregar vehículo</Link>}
            >
              {vehiculos.length > 0 ? (
                <div className={cn("mt-1 grid gap-3 sm:grid-cols-2", !enPanel && "xl:grid-cols-3")}>
                  {vehiculos.map((v) => (
                    <div key={v.id} className="flex min-w-0 flex-col rounded-xl border border-slate-200 p-3.5 dark:border-slate-700">
                      <Patente valor={v.patente} className="self-start" />
                      <p className="mt-2 truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
                        {v.marca} {v.modelo}{v.anio ? <span className="font-normal text-slate-500"> · {v.anio}</span> : null}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                        {formatNumber(v.kilometraje_actual)} km{v.proximo_service_km ? ` · próximo service ${formatNumber(v.proximo_service_km)} km` : ""}
                      </p>
                      <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3 text-xs font-semibold dark:border-slate-700/60">
                        <Link href={`/trabajos/nuevo?vehiculo=${v.id}`} className="text-brand-600 hover:text-brand-700 dark:text-brand-400">Nueva orden</Link>
                        <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">·</span>
                        <Link href={`/vehiculos/${v.id}/historial`} className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">Historial</Link>
                        <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">·</span>
                        <CompartirPortal vehiculo={v} />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-1 flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
                  <p className="text-sm text-slate-500">Este cliente todavía no tiene vehículos.</p>
                  <Link href={`/vehiculos/nuevo?cliente=${cliente.id}`} className="rounded-lg bg-brand-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-brand-700">
                    Registrar el primer vehículo
                  </Link>
                </div>
              )}
            </SectionCard>

            {/* ── Órdenes y cuenta corriente ── */}
            <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <div className="flex items-center gap-1 border-b border-slate-100 px-2 pt-2 dark:border-slate-700" role="tablist">
                {([["historial", "Órdenes de trabajo", trabajos.length], ["cuenta", "Cuenta corriente", movimientos.length]] as const).map(([clave, etiqueta, cantidad]) => (
                  <button
                    key={clave}
                    role="tab"
                    aria-selected={tabActiva === clave}
                    onClick={() => setTabActiva(clave)}
                    className={cn(
                      "-mb-px border-b-2 px-3 py-2.5 text-sm font-semibold transition-colors",
                      tabActiva === clave ? "border-brand-600 text-slate-900 dark:text-white" : "border-transparent text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200",
                    )}
                  >
                    {etiqueta} <span className="ml-1 text-xs font-medium text-slate-400">{cantidad}</span>
                  </button>
                ))}
              </div>

              {tabActiva === "historial" ? (
                trabajos.length > 0 ? (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {trabajos.map((t) => (
                      <li key={t.id}>
                        <Link href={`/trabajos/${t.id}`} className="flex items-center justify-between gap-4 px-4 py-3 transition hover:bg-slate-50 dark:hover:bg-slate-700/30">
                          <div className="flex min-w-0 items-center gap-3">
                            <Patente valor={t.patente} className="hidden text-xs sm:inline-flex" />
                            <div className="min-w-0">
                              <p className="flex items-center gap-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
                                {numeroOrden(t.id)} <StatusBadge status={t.estado} />
                              </p>
                              <p className="text-xs text-slate-500 dark:text-slate-400">{fecha(t.fecha_ingreso)}<span className="sm:hidden"> · {t.patente}</span></p>
                            </div>
                          </div>
                          <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{formatCurrency(t.total)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="px-4 py-10 text-center text-sm text-slate-500">Todavía no hay órdenes para este cliente.</p>
                )
              ) : movimientos.length > 0 ? (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {movimientos.map((m) => {
                    const esPago = m.tipo === "PAGO";
                    return (
                      <li key={m.id} className="flex items-center justify-between gap-4 px-4 py-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{m.descripcion || (esPago ? "Pago" : "Cargo a cuenta")}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{fecha(m.fecha)}{m.metodo_pago ? ` · ${m.metodo_pago.toLowerCase()}` : ""}</p>
                        </div>
                        <span className={cn("shrink-0 text-sm font-semibold tabular-nums", esPago ? "text-emerald-700 dark:text-emerald-400" : "text-red-700 dark:text-red-400")}>
                          {esPago ? "−" : "+"}{formatCurrency(m.monto)}
                          <span className="sr-only">{esPago ? " (pago)" : " (cargo)"}</span>
                        </span>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="px-4 py-10 text-center text-sm text-slate-500">Sin movimientos en la cuenta corriente.</p>
              )}
            </section>
        </div>
      </div>
  );
}

/** Botones de la ficha: en la página van en la cabecera; en el panel, arriba. */
export function AccionesCliente({ cliente }: { cliente: Cliente }) {
  const normalizado = normalizeWhatsAppPhone(cliente.telefono);
  const waLink = normalizado ? `https://wa.me/${normalizado}` : null;
  return (
    <>
      {waLink && (
        <a href={waLink} target="_blank" rel="noreferrer" className="inline-flex h-9 items-center gap-2 rounded-xl border border-emerald-200 px-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-400 dark:hover:bg-emerald-950/30">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
          WhatsApp
        </a>
      )}
      <Link href={`/turnos/nuevo?cliente=${cliente.id}`} className="inline-flex h-9 items-center rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
        Turno
      </Link>
      <Link href={`/presupuestos/nuevo?cliente=${cliente.id}`} className="inline-flex h-9 items-center rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
        Presupuesto
      </Link>
      <Link href={`/trabajos/nuevo?cliente=${cliente.id}`} className="inline-flex h-9 items-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700">
        + Nueva orden
      </Link>
    </>
  );
}

function Resumen({ titulo, valor, detalle }: { titulo: string; valor: string; detalle: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
      <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">{titulo}</p>
      <p className="mt-1 font-display text-3xl font-extrabold leading-none tabular-nums text-slate-900 dark:text-white">{valor}</p>
      <p className="mt-1 truncate text-xs text-slate-500 dark:text-slate-400">{detalle}</p>
    </div>
  );
}

function CampoEditable({ etiqueta, ayuda, children }: { etiqueta: string; ayuda?: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-xs font-medium text-slate-600 dark:text-slate-300">{etiqueta}</span>
      {children}
      {ayuda && <span className="block text-[11px] text-slate-500 dark:text-slate-400">{ayuda}</span>}
    </label>
  );
}

function DatoEnLinea({ etiqueta, valor, faltante, onFaltante }: { etiqueta: string; valor?: string | null; faltante?: string; onFaltante?: () => void }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-slate-500 dark:text-slate-400">{etiqueta}</dt>
      <dd className="mt-0.5 truncate font-medium text-slate-900 dark:text-white">
        {valor || (faltante && onFaltante ? (
          <button onClick={onFaltante} className="font-medium text-amber-700 hover:underline dark:text-amber-400">{faltante}</button>
        ) : (
          <span className="font-normal text-slate-400">Sin cargar</span>
        ))}
      </dd>
    </div>
  );
}

/**
 * Comparte el link del portal del vehículo (historial y seguimiento). Usa el
 * menú de compartir del celular si existe; si no, copia el link.
 */
function CompartirPortal({ vehiculo }: { vehiculo: Vehiculo }) {
  // "sin-portal" y "sin-copia" son distintos: un fallo del portapapeles no
  // significa que el vehículo no tenga link.
  const [estado, setEstado] = useState<"idle" | "copiado" | "sin-portal" | "sin-copia">("idle");

  async function compartir() {
    if (!vehiculo.token || vehiculo.portal_activo === false) {
      setEstado("sin-portal");
      window.setTimeout(() => setEstado("idle"), 2500);
      return;
    }
    // Se renueva sin esperar la respuesta: ver renovarPortalVehiculo.
    void renovarPortalVehiculo(vehiculo.id).catch(() => {});
    const url = `${window.location.origin}/p/vehiculo/${vehiculo.token}`;
    const texto = `Hola! Te compartimos el historial y seguimiento de tu ${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.patente}).\n\n${url}`;
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
    } catch {
      setEstado("sin-copia");
    }
    window.setTimeout(() => setEstado("idle"), 2500);
  }

  return (
    <button
      type="button"
      onClick={() => void compartir()}
      className={cn("font-semibold", estado === "sin-portal" || estado === "sin-copia" ? "text-rose-600 dark:text-rose-400" : estado === "copiado" ? "text-emerald-700 dark:text-emerald-400" : "text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white")}
    >
      {estado === "copiado" ? "Link copiado" : estado === "sin-portal" ? "Sin portal" : estado === "sin-copia" ? "No se pudo copiar" : "Compartir"}
    </button>
  );
}
