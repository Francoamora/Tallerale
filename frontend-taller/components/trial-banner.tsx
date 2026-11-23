"use client";

/**
 * components/trial-banner.tsx
 *
 * Franja de la prueba gratuita: cuántos días quedan (el color marca la
 * urgencia) y el botón para activar por WhatsApp. Modal bloqueante al vencer.
 */

import { useEffect, useState } from "react";
import { getTrialInfo, getSession, saveSession, buildActivationWALink, type TrialInfo } from "@/lib/trial";
import { getSesionDjango } from "@/lib/api";

// ─── Ícono WhatsApp ───────────────────────────────────────────────────────────
function IconWA({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

// ─── Modal de prueba vencida ──────────────────────────────────────────────────
function ModalVencida({ tallerNombre, actualizando, error, onActualizar }: { tallerNombre: string; actualizando: boolean; error: string; onActualizar: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl dark:bg-slate-900">
        {/* Header */}
        <div className="relative overflow-hidden bg-gradient-to-br from-orange-500 to-orange-600 px-6 py-8 text-center">
          {/* Círculo decorativo */}
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
          <div className="pointer-events-none absolute -bottom-6 -left-6 h-24 w-24 rounded-full bg-white/10" />
          <div className="relative mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
            <svg className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h2 className="relative text-xl font-black text-white">Período de prueba finalizado</h2>
          <p className="relative mt-1 text-sm font-medium text-orange-100">
            {tallerNombre}
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-7 text-center">
          <p className="text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Tu prueba gratuita de <strong className="text-slate-800 dark:text-white">7 días</strong> ha terminado.
            Para seguir usando Tallerista sin perder ningún dato, activá tu cuenta ahora.
          </p>

          <a
            href={buildActivationWALink(tallerNombre)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[#25D366] py-4 text-base font-black text-white shadow-lg shadow-emerald-500/30 transition hover:bg-[#1ebe5d] active:scale-[0.98]"
          >
            <IconWA className="h-5 w-5" />
            Activar mi cuenta ahora
          </a>

          <button
            type="button"
            onClick={onActualizar}
            disabled={actualizando}
            className="mt-3 w-full rounded-2xl border border-slate-200 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {actualizando ? "Actualizando estado…" : "Ya activé mi cuenta · Actualizar estado"}
          </button>

          {error && <p className="mt-3 text-xs font-semibold text-rose-500">{error}</p>}

          <p className="mt-4 text-[11px] text-slate-400">
            Tus datos están guardados y seguros.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Banner premium de cuenta regresiva ──────────────────────────────────────
export function TrialBanner() {
  const [info, setInfo] = useState<TrialInfo | null>(null);
  const [actualizando, setActualizando] = useState(false);
  const [errorActualizacion, setErrorActualizacion] = useState("");

  async function sincronizarEstado() {
    const session = getSession();
    if (!session) return;
    setActualizando(true);
    setErrorActualizacion("");
    try {
      const estado = await getSesionDjango();
      // Django es la fuente de verdad. Conservamos únicamente la preferencia
      // local del onboarding, que no pertenece al estado comercial.
      saveSession({
        ...session,
        ...estado,
        onboarding_done: session.onboarding_done,
      });
      setInfo(getTrialInfo());
    } catch {
      setErrorActualizacion("Todavía no vemos una activación vigente. Si ya la gestionaste, probá de nuevo en unos segundos.");
    } finally {
      setActualizando(false);
    }
  }

  useEffect(() => {
    const frame = requestAnimationFrame(() => setInfo(getTrialInfo()));
    // Consulta el backend al abrir y periódicamente: así una activación hecha
    // desde el Centro CEO se refleja sin obligar al taller a cerrar sesión.
    void sincronizarEstado();
    const id = setInterval(() => { void sincronizarEstado(); }, 5 * 60 * 1000);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(id);
    };
  }, []);

  if (!info || !info.isLoggedIn) return null;
  if (info.isPlanActivo) return null;

  if (info.isExpired) {
    return <ModalVencida tallerNombre={info.tallerNombre} actualizando={actualizando} error={errorActualizacion} onActualizar={() => { void sincronizarEstado(); }} />;
  }

  // El color sólo marca la urgencia en el número de días.
  const color = {
    safe: "text-emerald-600 dark:text-emerald-400",
    warning: "text-amber-600 dark:text-amber-400",
    danger: "text-red-600 dark:text-red-400",
  }[info.urgency];

  const cuanto =
    info.daysRemaining === 0
      ? "vence hoy"
      : info.daysRemaining === 1 && info.hoursRemaining > 0
      ? `te quedan ${info.hoursRemaining} horas`
      : `te quedan ${info.daysRemaining} días`;

  return (
    <div className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <div className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8">
        <p className="min-w-0 truncate text-sm text-slate-600 dark:text-slate-300">
          <span className="font-semibold text-slate-900 dark:text-white">Prueba gratis:</span>{" "}
          <span className={`font-semibold ${color}`}>{cuanto}</span>
          <span className="hidden sm:inline">. Si te sirve, la activás por WhatsApp y seguís con todo lo cargado.</span>
        </p>

        <a
          href={buildActivationWALink(info.tallerNombre)}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-full bg-emerald-600 px-4 text-sm font-semibold text-white shadow-sm shadow-emerald-600/20 transition hover:bg-emerald-700 active:scale-95"
        >
          <IconWA className="h-4 w-4" />
          <span className="hidden sm:inline">Activar por WhatsApp</span>
          <span className="sm:hidden">Activar</span>
        </a>
      </div>
    </div>
  );
}
