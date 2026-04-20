"use client";

/**
 * app/configuracion/page.tsx
 *
 * Configuración del perfil del taller.
 * Permite editar: nombre del dueño, nombre del taller, ciudad y teléfono.
 * Los cambios se sincronizan con Django (PUT /api/perfil/) y con la sesión local.
 */

import { useState, useEffect, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession, saveSession } from "@/lib/trial";
import { getPerfilTaller, updatePerfilTaller } from "@/lib/api";

export default function ConfiguracionPage() {
  const router = useRouter();

  // Form state
  const [nombre,       setNombre]       = useState("");
  const [tallerNombre, setTallerNombre] = useState("");
  const [tallerCiudad, setTallerCiudad] = useState("");
  const [tallerTel,    setTallerTel]    = useState("");

  // UI state
  const [loading,  setLoading]  = useState(true);
  const [saving,   setSaving]   = useState(false);
  const [success,  setSuccess]  = useState(false);
  const [error,    setError]    = useState("");

  // Cargar datos desde sesión (inmediato) + API (fuente de verdad)
  useEffect(() => {
    const session = getSession();
    if (!session?.token) { router.replace("/login"); return; }

    // Pre-fill desde localStorage para que el form no aparezca vacío
    setNombre(session.owner_nombre       || "");
    setTallerNombre(session.taller_nombre || "");
    setTallerCiudad(session.taller_ciudad || "");
    setTallerTel(session.taller_tel       || "");

    // Luego sobreescribir con datos frescos del backend
    getPerfilTaller()
      .then(p => {
        setNombre(p.nombre);
        setTallerNombre(p.taller_nombre);
        setTallerCiudad(p.taller_ciudad);
        setTallerTel(p.taller_tel);
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

  const currentPath = "/configuracion";

  return (
    <AppShell
      currentPath={currentPath}
      badge="Cuenta"
      title="Configuración del Taller"
      description="Actualizá los datos de tu taller. Estos datos aparecen en los presupuestos y órdenes de trabajo."
    >
      <div className="mx-auto max-w-xl">

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

              <div className="border-t border-slate-100 dark:border-slate-800" />

              {/* ── Sección: Taller ── */}
              <div className="space-y-5">
                <p className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                  Datos del taller
                </p>

                {/* Nombre del taller */}
                <div>
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
                <div>
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

              {/* Error */}
              {error && (
                <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-600 ring-1 ring-red-200 dark:bg-red-900/20 dark:text-red-400 dark:ring-red-800">
                  {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-500/20 transition hover:from-orange-600 hover:to-orange-700 disabled:opacity-60 active:scale-[0.98]"
              >
                {saving ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-300 border-t-white" />
                    Guardando...
                  </span>
                ) : "Guardar cambios"}
              </button>
            </form>
          )}
        </div>

        {/* ── Acceso al Admin Django ── */}
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-900/50">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-200 dark:bg-slate-700">
              <svg className="h-4 w-4 text-slate-600 dark:text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-slate-800 dark:text-white">Panel de administración Django</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Para gestionar usuarios, ver registros y administrar la base de datos.
              </p>
              <a
                href="https://tallerale-production.up.railway.app/admin/"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-slate-800 px-3 py-2 text-xs font-bold text-white transition hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                Abrir Admin Django
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </div>
          </div>
        </div>

      </div>
    </AppShell>
  );
}
