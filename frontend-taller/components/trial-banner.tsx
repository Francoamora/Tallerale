"use client";

/**
 * components/trial-banner.tsx
 *
 * Banner de prueba gratuita — diseño premium.
 * - Gradiente sutil, tipografía limpia, pill de días restantes.
 * - Modal bloqueante al expirar.
 */

import { useEffect, useState } from "react";
import { getTrialInfo, buildActivationWALink, type TrialInfo } from "@/lib/trial";

// ─── Ícono WhatsApp ───────────────────────────────────────────────────────────
function IconWA({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  );
}

// ─── Modal de prueba vencida ──────────────────────────────────────────────────
function ModalVencida({ tallerNombre }: { tallerNombre: string }) {
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
            Para seguir usando TallerOS sin perder ningún dato, activá tu cuenta ahora.
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

  useEffect(() => {
    setInfo(getTrialInfo());
    const id = setInterval(() => setInfo(getTrialInfo()), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  if (!info || !info.isLoggedIn) return null;

  if (info.isExpired) {
    return <ModalVencida tallerNombre={info.tallerNombre} />;
  }

  // Estilos por urgencia
  const themes = {
    safe: {
      bar:    "bg-gradient-to-r from-emerald-950 via-emerald-900 to-emerald-950 border-b border-emerald-800/60",
      dot:    "bg-emerald-400",
      pill:   "bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/30",
      label:  "text-emerald-100",
      sub:    "text-emerald-400/80",
      btn:    "bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-900/50",
    },
    warning: {
      bar:    "bg-gradient-to-r from-amber-950 via-amber-900 to-amber-950 border-b border-amber-800/60",
      dot:    "bg-amber-400",
      pill:   "bg-amber-500/20 text-amber-300 ring-1 ring-amber-500/30",
      label:  "text-amber-100",
      sub:    "text-amber-400/80",
      btn:    "bg-amber-500 hover:bg-amber-400 text-white shadow-amber-900/50",
    },
    danger: {
      bar:    "bg-gradient-to-r from-red-950 via-red-900 to-red-950 border-b border-red-800/60",
      dot:    "bg-red-400",
      pill:   "bg-red-500/20 text-red-300 ring-1 ring-red-500/30",
      label:  "text-red-100",
      sub:    "text-red-400/80",
      btn:    "bg-red-500 hover:bg-red-400 text-white shadow-red-900/50",
    },
  }[info.urgency];

  const countdownLabel =
    info.daysRemaining === 0
      ? "Vence hoy"
      : info.daysRemaining === 1 && info.hoursRemaining > 0
      ? `${info.hoursRemaining} hs`
      : `${info.daysRemaining} días`;

  const message =
    info.daysRemaining === 0
      ? "Tu prueba gratuita vence hoy"
      : info.daysRemaining === 1 && info.hoursRemaining > 0
      ? `Quedan ${info.hoursRemaining} horas de tu prueba gratuita`
      : `Quedan ${info.daysRemaining} días de tu prueba gratuita`;

  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-2 ${themes.bar}`}>

      {/* Izquierda: dot animado + texto */}
      <div className="flex items-center gap-3 min-w-0">
        {/* Dot con pulso */}
        <span className="relative flex h-2 w-2 shrink-0">
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${themes.dot}`} />
          <span className={`relative inline-flex h-2 w-2 rounded-full ${themes.dot}`} />
        </span>

        {/* Texto */}
        <span className={`text-sm font-semibold truncate ${themes.label}`}>
          {message}
        </span>

        {/* Pill de cuenta regresiva */}
        <span className={`hidden sm:inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-black tracking-wide ${themes.pill}`}>
          {countdownLabel}
        </span>
      </div>

      {/* Derecha: botón activar */}
      <a
        href={buildActivationWALink(info.tallerNombre)}
        target="_blank"
        rel="noopener noreferrer"
        className={`shrink-0 flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-black shadow-sm transition active:scale-95 ${themes.btn}`}
      >
        <IconWA className="h-3 w-3" />
        <span className="hidden sm:inline">Activar cuenta</span>
        <span className="sm:hidden">Activar</span>
      </a>
    </div>
  );
}
