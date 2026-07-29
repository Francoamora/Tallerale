"use client";

/**
 * app/configuracion/page.tsx
 *
 * Configuración del perfil del taller.
 * Permite editar: nombre del dueño, nombre del taller, ciudad y teléfono.
 * Los cambios se sincronizan con Django (PUT /api/perfil/) y con la sesión local.
 */

import { useState, useEffect, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession, saveSession } from "@/lib/trial";
import { getPerfilTaller, updatePerfilTaller, subirLogoTaller, eliminarLogoTaller } from "@/lib/api";

export default function ConfiguracionPage() {
  const router = useRouter();

  // Form state
  const [nombre,       setNombre]       = useState("");
  const [tallerNombre, setTallerNombre] = useState("");
  const [tallerCiudad, setTallerCiudad] = useState("");
  const [tallerTel,    setTallerTel]    = useState("");
  const [tallerCuit,   setTallerCuit]   = useState("");
  const [logoUrl,      setLogoUrl]      = useState<string | null>(null);

  // UI state
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [success,  setSuccess]  = useState(false);
  const [error,    setError]    = useState("");
  const [logoSubiendo, setLogoSubiendo] = useState(false);
  const [logoError,    setLogoError]    = useState("");

  // Cargar datos desde sesión (inmediato) + API (fuente de verdad)
  useEffect(() => {
    const session = getSession();
    if (!session) { router.replace("/login"); return; }

    // Pre-fill desde localStorage para que el form no aparezca vacío
    setNombre(session.owner_nombre       || "");
    setTallerNombre(session.taller_nombre || "");
    setTallerCiudad(session.taller_ciudad || "");
    setTallerTel(session.taller_tel       || "");
    setTallerCuit(session.taller_cuit     || "");
    setLogoUrl(session.taller_logo_url    || null);

    // Luego sobreescribir con datos frescos del backend
    getPerfilTaller()
      .then(p => {
        setNombre(p.nombre);
        setTallerNombre(p.taller_nombre);
        setTallerCiudad(p.taller_ciudad);
        setTallerTel(p.taller_tel);
        setTallerCuit(p.taller_cuit);
        setLogoUrl(p.logo_url || null);
      })
      .catch(() => { /* Si falla, los datos de sesión son suficientes */ })
      .finally(() => setLoading(false));
  }, [router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSuccess(false);

    if (!tallerNombre.trim()) {
      setError("El nombre del taller es obligatorio.");
      return;
    }

    setSaving(true);
    try {
      const updated = await updatePerfilTaller({
        nombre:       nombre.trim(),
        taller_nombre: tallerNombre.trim(),
        taller_ciudad: tallerCiudad.trim(),
        taller_tel:    tallerTel.trim(),
        taller_cuit:   tallerCuit.trim(),
      });

      // Actualizar sesión local para que AppShell y comprobantes lo reflejen al instante
      const session = getSession();
      if (session) {
        saveSession({
          ...session,
          owner_nombre:  updated.nombre,
          taller_nombre: updated.taller_nombre,
          taller_ciudad: updated.taller_ciudad,
          taller_tel:    updated.taller_tel,
          taller_cuit:   updated.taller_cuit,
        });
      }

      setSuccess(true);
      // Scroll to top para ver el mensaje
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al guardar el perfil.");
    } finally {
      setSaving(false);
    }
  }

  function sincronizarLogoEnSesion(url: string | null) {
    setLogoUrl(url);
    const session = getSession();
    if (session) saveSession({ ...session, taller_logo_url: url });
  }

  async function handleLogoSeleccionado(e: ChangeEvent<HTMLInputElement>) {
    const archivo = e.target.files?.[0];
    e.target.value = ""; // permite volver a elegir el mismo archivo después
    if (!archivo) return;

    setLogoError("");
    if (archivo.size > 3 * 1024 * 1024) {
      setLogoError("El archivo pesa más de 3MB. Subí una imagen más liviana.");
      return;
    }

    setLogoSubiendo(true);
    try {
      const updated = await subirLogoTaller(archivo);
      sincronizarLogoEnSesion(updated.logo_url || null);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "No se pudo subir el logo.");
    } finally {
      setLogoSubiendo(false);
    }
  }

  async function handleQuitarLogo() {
    setLogoError("");
    setLogoSubiendo(true);
    try {
      await eliminarLogoTaller();
      sincronizarLogoEnSesion(null);
    } catch (err) {
      setLogoError(err instanceof Error ? err.message : "No se pudo quitar el logo.");
    } finally {
      setLogoSubiendo(false);
    }
  }

  const currentPath = "/configuracion";

  return (
    <AppShell
      currentPath={currentPath}
      badge="Cuenta"
      title="Configuración del Taller"
      description="Actualizá los datos de tu taller. Estos datos aparecen en los presupuestos y órdenes de trabajo."
    >
      <div className="mx-auto max-w-3xl">

        {/* ── Mensaje de éxito ── */}
        {success && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-200 animate-in slide-in-from-top-2 dark:bg-emerald-900/20 dark:text-emerald-400 dark:ring-emerald-800">
            <svg className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            ¡Perfil actualizado correctamente! Los cambios ya se reflejan en todos los comprobantes.
          </div>
        )}

        {/* ── Card principal ── */}
        <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">

              {/* ── Dos columnas en desktop: operador angosto | taller ancho ── */}
              <div className="grid gap-6 lg:grid-cols-[220px_1px_1fr] lg:gap-8">

                {/* ── Sección: Dueño ── */}
                <div>
                  <p className="mb-4 text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    Datos del operador
                  </p>
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Tu nombre
                    </label>
                    <input
                      type="text"
                      value={nombre}
                      onChange={e => { setNombre(e.target.value); setSuccess(false); }}
                      placeholder="Franco Mora"
                      className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                    <p className="mt-1 text-[11px] text-slate-400">
                      Aparece en el saludo del panel y en la sesión.
                    </p>
                  </div>
                </div>

                {/* Separador: horizontal en mobile, vertical en desktop */}
                <div className="border-t border-slate-100 dark:border-slate-800 lg:h-full lg:border-t-0 lg:border-l" />

                {/* ── Sección: Taller ── */}
                <div className="space-y-5">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                    Datos del taller
                  </p>

                  {/* Logo */}
                  <div>
                    <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                      Logo del taller
                    </label>
                    <div className="flex items-center gap-4">
                      <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800">
                        {logoUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element -- viene de Django, dominio dinámico según entorno
                          <img src={logoUrl} alt="Logo del taller" className="h-full w-full object-contain" />
                        ) : (
                          <svg className="h-6 w-6 text-slate-300 dark:text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14M14 8h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="cursor-pointer rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800">
                          {logoSubiendo ? "Subiendo…" : logoUrl ? "Cambiar" : "Subir logo"}
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={handleLogoSeleccionado}
                            disabled={logoSubiendo}
                            className="hidden"
                          />
                        </label>
                        {logoUrl && (
                          <button
                            type="button"
                            onClick={handleQuitarLogo}
                            disabled={logoSubiendo}
                            className="rounded-xl px-3 py-2.5 text-sm font-bold text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/20"
                          >
                            Quitar
                          </button>
                        )}
                      </div>
                    </div>
                    {logoError && <p className="mt-2 text-[11px] font-semibold text-red-600 dark:text-red-400">{logoError}</p>}
                    <p className="mt-2 text-[11px] text-slate-400">
                      Opcional — si no subís uno, los comprobantes muestran las iniciales del taller. PNG, JPG, WEBP o SVG, hasta 3MB.
                    </p>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    {/* Nombre del taller */}
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Nombre del taller <span className="text-orange-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={tallerNombre}
                        onChange={e => { setTallerNombre(e.target.value); setSuccess(false); }}
                        placeholder="Taller Mecánico Franco"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                      <p className="mt-1 text-[11px] text-slate-400">
                        Aparece en el encabezado de presupuestos y órdenes de trabajo.
                      </p>
                    </div>

                    {/* CUIT */}
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                        CUIT
                      </label>
                      <input
                        type="text"
                        value={tallerCuit}
                        onChange={e => { setTallerCuit(e.target.value); setSuccess(false); }}
                        placeholder="20-12345678-9"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                      <p className="mt-1 text-[11px] text-slate-400">
                        Aparece en presupuestos y comprobantes. Opcional.
                      </p>
                    </div>

                    {/* Ciudad */}
                    <div>
                      <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Ciudad
                      </label>
                      <input
                        type="text"
                        value={tallerCiudad}
                        onChange={e => { setTallerCiudad(e.target.value); setSuccess(false); }}
                        placeholder="Reconquista, Santa Fe"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                      <p className="mt-1 text-[11px] text-slate-400">
                        Aparece como subtítulo en los comprobantes.
                      </p>
                    </div>

                    {/* Teléfono */}
                    <div className="sm:col-span-2">
                      <label className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-300">
                        Teléfono del taller
                      </label>
                      <input
                        type="tel"
                        value={tallerTel}
                        onChange={e => { setTallerTel(e.target.value); setSuccess(false); }}
                        placeholder="3482 123456"
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-900 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 ring-1 ring-red-200 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-800">
                  {error}
                </div>
              )}

              {/* Submit */}
              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-500/20 transition hover:from-orange-600 hover:to-orange-700 disabled:opacity-60 active:scale-[0.98] lg:w-auto lg:px-10"
                >
                  {saving ? (
                    <span className="flex items-center justify-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-300 border-t-white" />
                      Guardando...
                    </span>
                  ) : "Guardar cambios"}
                </button>
              </div>
            </form>
          )}
        </div>

      </div>
    </AppShell>
  );
}
