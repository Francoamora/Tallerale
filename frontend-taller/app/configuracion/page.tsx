"use client";

/**
 * Configuración del taller: datos comerciales, datos fiscales (los que usa el
 * contador para facturar en ARCA) y el contacto del contador.
 */

import { useEffect, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { ExportarContador } from "@/components/exportar-contador";
import { eliminarLogoTaller, getEquipo, getPerfilTaller, subirLogoTaller, updatePerfilTaller, type CondicionIva } from "@/lib/api";
import { validarCuit } from "@/lib/cuit";
import { getSession, saveSession } from "@/lib/trial";
import { cn } from "@/lib/utils";

const CONDICIONES: { value: CondicionIva; label: string; ayuda: string }[] = [
  { value: "MONOTRIBUTO", label: "Monotributo", ayuda: "Factura C" },
  { value: "RESPONSABLE_INSCRIPTO", label: "Responsable inscripto", ayuda: "Factura A o B, discrimina IVA" },
  { value: "EXENTO", label: "Exento", ayuda: "No cobra IVA" },
];

const campo =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white";

export default function ConfiguracionPage() {
  const router = useRouter();

  const [nombre, setNombre] = useState("");
  const [tallerNombre, setTallerNombre] = useState("");
  const [tallerCiudad, setTallerCiudad] = useState("");
  const [tallerTel, setTallerTel] = useState("");
  const [tallerEmail, setTallerEmail] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);

  const [razonSocial, setRazonSocial] = useState("");
  const [cuit, setCuit] = useState("");
  const [condicionIva, setCondicionIva] = useState<CondicionIva>("");
  const [ingresosBrutos, setIngresosBrutos] = useState("");
  const [inicioActividades, setInicioActividades] = useState("");
  const [domicilioFiscal, setDomicilioFiscal] = useState("");
  const [telefonoContador, setTelefonoContador] = useState("");
  const [equipo, setEquipo] = useState<{ total: number; activos: number } | null>(null);
  const [mostrarIva, setMostrarIva] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cambios, setCambios] = useState(false);
  const [aviso, setAviso] = useState<{ texto: string; error?: boolean } | null>(null);
  const [logoSubiendo, setLogoSubiendo] = useState(false);
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/login");
      return;
    }
    setNombre(session.owner_nombre || "");
    setTallerNombre(session.taller_nombre || "");
    setTallerCiudad(session.taller_ciudad || "");
    setTallerTel(session.taller_tel || "");
    setCuit(session.taller_cuit || "");
    setLogoUrl(session.taller_logo_url || null);

    getPerfilTaller()
      .then((p) => {
        setNombre(p.nombre);
        setTallerNombre(p.taller_nombre);
        setTallerCiudad(p.taller_ciudad);
        setTallerTel(p.taller_tel);
        setCuit(p.taller_cuit);
        setLogoUrl(p.logo_url || null);
        setTallerEmail(p.taller_email ?? "");
        setRazonSocial(p.razon_social ?? "");
        setCondicionIva(p.condicion_iva ?? "");
        setIngresosBrutos(p.ingresos_brutos ?? "");
        setInicioActividades(p.inicio_actividades ?? "");
        setDomicilioFiscal(p.domicilio_fiscal ?? "");
        setTelefonoContador(p.telefono_contador ?? "");
        setMostrarIva(Boolean(p.mostrar_iva));
      })
      .catch(() => {
        // Con los datos de la sesión alcanza para mostrar el formulario.
      })
      .finally(() => setLoading(false));
    getEquipo()
      .then((m) => setEquipo({ total: m.length, activos: m.filter((x) => x.activo).length }))
      .catch(() => {});
  }, [router]);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 3500);
    return () => window.clearTimeout(t);
  }, [aviso]);

  // Cualquier cambio marca el formulario como pendiente de guardar.
  function cambiar<T>(setter: (v: T) => void) {
    return (valor: T) => {
      setter(valor);
      setCambios(true);
    };
  }

  const estadoCuit = validarCuit(cuit);
  const datosFiscalesCompletos = Boolean(estadoCuit.ok && cuit && condicionIva && (razonSocial || tallerNombre) && domicilioFiscal);

  async function guardar(e: FormEvent) {
    e.preventDefault();
    if (!tallerNombre.trim()) return setAviso({ texto: "El nombre del taller es obligatorio.", error: true });
    if (!estadoCuit.ok) return setAviso({ texto: `CUIT: ${estadoCuit.mensaje}`, error: true });
    setSaving(true);
    try {
      const p = await updatePerfilTaller({
        nombre: nombre.trim(),
        taller_nombre: tallerNombre.trim(),
        taller_ciudad: tallerCiudad.trim(),
        taller_tel: tallerTel.trim(),
        taller_cuit: estadoCuit.formateado,
        taller_email: tallerEmail.trim(),
        razon_social: razonSocial.trim(),
        condicion_iva: condicionIva,
        ingresos_brutos: ingresosBrutos.trim(),
        inicio_actividades: inicioActividades || null,
        domicilio_fiscal: domicilioFiscal.trim(),
        telefono_contador: telefonoContador.trim(),
        mostrar_iva: mostrarIva,
      });
      setCuit(p.taller_cuit);
      const session = getSession();
      if (session) {
        saveSession({ ...session, owner_nombre: p.nombre, taller_nombre: p.taller_nombre, taller_ciudad: p.taller_ciudad, taller_tel: p.taller_tel, taller_cuit: p.taller_cuit });
      }
      setCambios(false);
      setAviso({ texto: "Guardado. Los presupuestos y órdenes ya salen con estos datos." });
    } catch (err) {
      setAviso({ texto: err instanceof Error ? err.message : "No pudimos guardar.", error: true });
    } finally {
      setSaving(false);
    }
  }

  function sincronizarLogo(url: string | null) {
    setLogoUrl(url);
    const session = getSession();
    if (session) saveSession({ ...session, taller_logo_url: url });
  }

  async function elegirLogo(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = "";
    if (!archivo) return;
    if (archivo.size > 3 * 1024 * 1024) return setAviso({ texto: "El logo pesa más de 3MB. Probá con una imagen más liviana.", error: true });
    setLogoSubiendo(true);
    try {
      sincronizarLogo((await subirLogoTaller(archivo)).logo_url || null);
    } catch (err) {
      setAviso({ texto: err instanceof Error ? err.message : "No se pudo subir el logo.", error: true });
    } finally {
      setLogoSubiendo(false);
    }
  }

  async function quitarLogo() {
    setLogoSubiendo(true);
    try {
      await eliminarLogoTaller();
      sincronizarLogo(null);
    } catch (err) {
      setAviso({ texto: err instanceof Error ? err.message : "No se pudo quitar el logo.", error: true });
    } finally {
      setLogoSubiendo(false);
    }
  }

  const iniciales = (tallerNombre || "T").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  const condicionLabel = CONDICIONES.find((c) => c.value === condicionIva)?.label;

  return (
    <AppShell
      currentPath="/configuracion"
      compact
      badge="Cuenta"
      title="Configuración del taller"
      description="Los datos de tu taller, los fiscales para el contador y cómo salen en tus comprobantes."
    >
      {aviso && (
        <div role="status" className={cn("fixed bottom-6 right-6 z-50 max-w-sm rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-2xl", aviso.error ? "bg-red-600" : "bg-slate-900 dark:bg-slate-700")}>
          {aviso.texto}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="h-96 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
          <div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
        </div>
      ) : (
        <form onSubmit={guardar} className="grid items-start gap-4 pb-24 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="min-w-0 space-y-4">
            {/* Tu taller */}
            <Tarjeta
              titulo="Tu taller"
              descripcion="Así te ven tus clientes en presupuestos, órdenes y el link que les mandás."
              extra={
                <div className="flex shrink-0 items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl bg-brand-600 text-base font-extrabold text-white">
                    {/* eslint-disable-next-line @next/next/no-img-element -- logo subido por el taller, cualquier dominio */}
                    {logoUrl ? <img src={logoUrl} alt="Logo del taller" className="h-full w-full object-cover" /> : iniciales}
                  </div>
                  <div className="flex flex-col items-start">
                    <label className={cn("cursor-pointer text-sm font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-300", logoSubiendo && "pointer-events-none opacity-60")} title="PNG, JPG o WEBP, hasta 3MB">
                      {logoSubiendo ? "Subiendo…" : logoUrl ? "Cambiar logo" : "Subir logo"}
                      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={elegirLogo} className="sr-only" />
                    </label>
                    {logoUrl ? (
                      <button type="button" onClick={() => void quitarLogo()} disabled={logoSubiendo} className="text-xs text-slate-500 hover:text-red-600 disabled:opacity-60">Quitar</button>
                    ) : (
                      <span className="text-xs text-slate-400">PNG o JPG, hasta 3MB</span>
                    )}
                  </div>
                </div>
              }
            >
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Campo etiqueta="Nombre del taller" obligatorio className="sm:col-span-2">
                  <input value={tallerNombre} onChange={(e) => cambiar(setTallerNombre)(e.target.value)} placeholder="Ej: Taller San Martín" className={campo} />
                </Campo>
                <Campo etiqueta="Teléfono / WhatsApp">
                  <input type="tel" value={tallerTel} onChange={(e) => cambiar(setTallerTel)(e.target.value)} placeholder="Ej: 342 456 7890" className={campo} />
                </Campo>
                <Campo etiqueta="Ciudad">
                  <input value={tallerCiudad} onChange={(e) => cambiar(setTallerCiudad)(e.target.value)} placeholder="Ej: Santa Fe" className={campo} />
                </Campo>
                <Campo etiqueta="Email del taller" ayuda="Opcional." className="sm:col-span-2">
                  <input type="email" value={tallerEmail} onChange={(e) => cambiar(setTallerEmail)(e.target.value)} placeholder="Ej: tallersanmartin@gmail.com" className={campo} />
                </Campo>
              </div>
            </Tarjeta>

            {/* Datos fiscales */}
            <Tarjeta
              titulo="Datos fiscales"
              descripcion="Los usa tu contador para facturar en ARCA. Si no los tenés a mano, pedíselos a él."
              extra={datosFiscalesCompletos
                ? <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900">Completos</span>
                : <span className="inline-flex rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-900">Faltan datos</span>}
            >
              <div>
                <p className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">Condición frente al IVA</p>
                <div className="grid gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Condición frente al IVA">
                  {CONDICIONES.map((c) => {
                    const activa = condicionIva === c.value;
                    return (
                      <button
                        key={c.value}
                        type="button"
                        role="radio"
                        aria-checked={activa}
                        onClick={() => cambiar(setCondicionIva)(c.value)}
                        className={cn("rounded-xl px-3.5 py-2.5 text-left ring-1 ring-inset transition", activa ? "bg-brand-50 ring-2 ring-brand-500 dark:bg-brand-950/30" : "ring-slate-200 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-700/40")}
                      >
                        <span className="block text-sm font-semibold text-slate-900 dark:text-white">{c.label}</span>
                        <span className="block text-xs text-slate-500 dark:text-slate-400">{c.ayuda}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <Campo etiqueta="Razón social" ayuda={condicionIva === "MONOTRIBUTO" ? "Si sos monotributista suele ser tu nombre y apellido." : "Como figura en ARCA."} className="sm:col-span-2">
                  <input value={razonSocial} onChange={(e) => cambiar(setRazonSocial)(e.target.value)} placeholder={tallerNombre || "Ej: San Martín Servicios SRL"} className={campo} />
                </Campo>
                <Campo etiqueta="CUIT" error={!estadoCuit.ok ? estadoCuit.mensaje : ""} ayuda={estadoCuit.ok && cuit ? "✓ CUIT válido" : "11 números, con o sin guiones."}>
                  <input
                    value={cuit}
                    onChange={(e) => cambiar(setCuit)(e.target.value)}
                    onBlur={() => { if (estadoCuit.ok && estadoCuit.formateado) setCuit(estadoCuit.formateado); }}
                    inputMode="numeric"
                    placeholder="20-12345678-6"
                    aria-invalid={!estadoCuit.ok}
                    className={cn(campo, "tabular-nums", !estadoCuit.ok && "border-red-400 focus:border-red-500 focus:ring-red-500/10")}
                  />
                </Campo>
                <Campo etiqueta="Ingresos brutos" ayuda="Número de inscripción (opcional).">
                  <input value={ingresosBrutos} onChange={(e) => cambiar(setIngresosBrutos)(e.target.value)} placeholder="Ej: 921-123456-7" className={campo} />
                </Campo>
                <Campo etiqueta="Domicilio fiscal" className="sm:col-span-2">
                  <input value={domicilioFiscal} onChange={(e) => cambiar(setDomicilioFiscal)(e.target.value)} placeholder="Ej: Av. San Martín 1234, Santa Fe" className={campo} />
                </Campo>
                <Campo etiqueta="Inicio de actividades" ayuda="Opcional. Figura en las facturas.">
                  <input type="date" value={inicioActividades} max={new Date().toISOString().slice(0, 10)} onChange={(e) => cambiar(setInicioActividades)(e.target.value)} className={cn(campo, "dark:[color-scheme:dark]")} />
                </Campo>
                {condicionIva === "RESPONSABLE_INSCRIPTO" && (
                  <div className="flex items-start justify-between gap-4 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-900/50 sm:col-span-2 xl:col-span-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">Mostrar el IVA en presupuestos y órdenes <span className="font-normal text-slate-500">(opcional)</span></p>
                      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Los totales salen con neto gravado + IVA 21%. Tus precios se toman con IVA incluido, así que el total no cambia.</p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={mostrarIva}
                      aria-label="Mostrar el IVA discriminado"
                      onClick={() => cambiar(setMostrarIva)(!mostrarIva)}
                      className={cn("relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition", mostrarIva ? "bg-brand-600" : "bg-slate-300 dark:bg-slate-600")}
                    >
                      <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all", mostrarIva ? "left-[22px]" : "left-0.5")} />
                    </button>
                  </div>
                )}
              </div>
            </Tarjeta>

          </div>

          {/* Columna derecha */}
          <aside className="space-y-4 lg:sticky lg:top-24">
            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <p className="px-5 pt-4 text-xs font-medium text-slate-500 dark:text-slate-400">Así sale en tus comprobantes</p>
              <div className="m-4 rounded-xl border border-slate-200 bg-white p-4 text-slate-900 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-brand-600 text-sm font-extrabold text-white">
                    {/* eslint-disable-next-line @next/next/no-img-element -- logo subido por el taller */}
                    {logoUrl ? <img src={logoUrl} alt="" className="h-full w-full object-cover" /> : iniciales}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold">{tallerNombre || "Tu taller"}</p>
                    <p className="truncate text-[11px] text-slate-500">{[tallerCiudad, tallerTel].filter(Boolean).join(" · ") || "Ciudad · teléfono"}</p>
                  </div>
                </div>
                <div className="mt-3 space-y-0.5 border-t border-slate-100 pt-3 text-[11px] text-slate-500">
                  <p>{razonSocial || tallerNombre || "Razón social"}</p>
                  <p>{cuit ? `CUIT ${estadoCuit.formateado || cuit}` : "CUIT sin cargar"}{condicionLabel ? ` · ${condicionLabel}` : ""}</p>
                  {domicilioFiscal && <p className="truncate">{domicilioFiscal}</p>}
                  {condicionIva === "RESPONSABLE_INSCRIPTO" && mostrarIva && <p className="pt-1 text-slate-600">Total: neto + IVA 21%</p>}
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Tu contador</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">La planilla del mes con ventas, cobros y compras, mandada por WhatsApp para que facture en ARCA.</p>
              <div className="mt-4">
                <Campo etiqueta="WhatsApp del contador" ayuda="Así le abrimos el chat directo.">
                  <input type="tel" value={telefonoContador} onChange={(e) => cambiar(setTelefonoContador)(e.target.value)} placeholder="Ej: 342 555 1234" className={campo} />
                </Campo>
              </div>
              <button type="button" onClick={() => setExportando(true)} className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-slate-800 ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-700">
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v12m0 0-4-4m4 4 4-4M5 20h14" /></svg>
                Planilla para el contador
              </button>
              {!datosFiscalesCompletos && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">Completá los datos fiscales para que salgan en la planilla.</p>}
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">¿Preferís que la baje él? Dale un usuario de <span className="font-semibold">Contador</span> en <Link href="/equipo" className="font-semibold text-brand-700 hover:underline dark:text-brand-300">Equipo</Link>.</p>
            </section>

            <Link href="/equipo" className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600">
              <div>
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Equipo y accesos</h2>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  {equipo ? `${equipo.activos} ${equipo.activos === 1 ? "persona entra" : "personas entran"} al sistema` : "Usuarios y permisos de tu gente"}
                </p>
              </div>
              <span className="text-sm font-semibold text-brand-700 dark:text-brand-300">Administrar →</span>
            </Link>
          </aside>

          {/* Barra de guardar: aparece cuando hay cambios */}
          <div className={cn("fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur transition-transform dark:border-slate-700 dark:bg-slate-900/95 max-lg:bottom-14", cambios ? "translate-y-0" : "translate-y-full")}>
            <div className="mx-auto flex max-w-[1400px] items-center justify-end gap-3 px-4 py-3 sm:px-6">
              <span className="mr-auto text-sm text-slate-600 dark:text-slate-300">Tenés cambios sin guardar.</span>
              <button type="submit" disabled={saving} className="inline-flex h-10 items-center rounded-xl bg-brand-600 px-5 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60">
                {saving ? "Guardando…" : "Guardar cambios"}
              </button>
            </div>
          </div>
        </form>
      )}

      <ExportarContador abierto={exportando} onCerrar={() => setExportando(false)} telefonoContador={telefonoContador} nombreTaller={tallerNombre} />
    </AppShell>
  );
}

function Tarjeta({ titulo, descripcion, extra, children }: { titulo: string; descripcion: string; extra?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-6">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{titulo}</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{descripcion}</p>
        </div>
        {extra}
      </div>
      {children}
    </section>
  );
}

function Campo({ etiqueta, obligatorio = false, ayuda, error, className, children }: { etiqueta: string; obligatorio?: boolean; ayuda?: string; error?: string; className?: string; children: ReactNode }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {etiqueta}
        {obligatorio && <span className="text-brand-600"> *</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-medium text-red-600 dark:text-red-400">{error}</span>
      ) : ayuda ? (
        <span className={cn("mt-1 block text-xs", ayuda.startsWith("✓") ? "text-emerald-700 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400")}>{ayuda}</span>
      ) : null}
    </label>
  );
}
