"use client";

/**
 * components/trial-banner.tsx
 *
 * Banner de prueba gratuita mostrado en la parte superior del AppShell.
 * - Verde / ámbar / rojo según días restantes
 * - Al expirar: modal bloqueante con WhatsApp
 */

import { useEffect, useState } from "react";
import { getTrialInfo, buildActivationWALink, type TrialInfo } from "@/lib/trial";

// ─── Modal de prueba vencida ──────────────────────────────────────────────────
function ModalVencida({ tallerNombre }: { tallerNombre: string }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-md">
      <div className="w-full max-w-sm overflow-hidden rounded-3xl bg-white shadow-2xl">
        {/* Header naranja */}
        <div className="bg-gradient-to-br from-orange-500 to-orange-600 px-6 py-8 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/20">
            <span className="text-3xl">⏰</span>
          </div>
          <h2 className="text-xl font-black text-white">Período de prueba finalizado</h2>
          <p className="mt-1 text-sm font-medium text-orange-100">
            Taller: <strong>{tallerNombre}</strong>
          </p>
        </div>

        {/* Body */}
        <div className="px-6 py-7 text-center">
          <p className="text-sm leading-relaxed text-slate-600">
            Tu prueba gratuita de <strong>7 días</strong> ha terminado. Para seguir usando
            TallerOS y no perder ningún dato, activá tu cuenta ahora.
          </p>

          <p className="mt-4 text-sm font-semibold text-slate-700">
            Escribínos y en minutos te activamos:
          </p>

          <a
            href={buildActivationWALink(tallerNombre)}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] py-4 text-base font-black text-white shadow-lg shadow-emerald-500/30 transition hover:bg-[#1ebe5d] active:scale-[0.98]"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Activar mi cuenta ahora
          </a>

          <p className="mt-4 text-[11px] text-slate-400">
            Tus datos están guardados y listos para cuando actives.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Banner de cuenta regresiva ───────────────────────────────────────────────
export function TrialBanner() {
  const [info, setInfo] = useState<TrialInfo | null>(null);

  useEffect(() => {
    setInfo(getTrialInfo());
    // Refresca cada 5 minutos para detectar expiración
    const id = setInterval(() => setInfo(getTrialInfo()), 5 * 60 * 1000);
    return () => clearInterval(id);
  }, []);

  if (!info || !info.isLoggedIn) return null;

  // Modal bloqueante si expiró
  if (info.isExpired) {
    return <ModalVencida tallerNombre={info.tallerNombre} />;
  }

  // Colores según urgencia
  const colors = {
    safe:    "bg-emerald-600 text-white",
    warning: "bg-amber-500 text-white",
    danger:  "bg-red-600 text-white",
  }[info.urgency];

  const icon = {
    safe:    "🟢",
    warning: "🟡",
    danger:  "🔴",
  }[info.urgency];

  const label =
    info.daysRemaining === 1 && info.hoursRemaining > 0
      ? `Te quedan ${info.hoursRemaining} hs de prueba`
      : info.daysRemaining === 0
      ? "Tu prueba vence hoy"
      : `Te quedan ${info.daysRemaining} días de prueba gratuita`;

  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-semibold ${colors}`}>
      <span className="flex items-center gap-2">
        <span>{icon}</span>
        <span>{label}</span>
      </span>
      <a
        href={buildActivationWALink(info.tallerNombre)}
        target="_blank"
        rel="noopener noreferrer"
        className="shrink-0 rounded-lg bg-white/20 px-3 py-1 text-xs font-black transition hover:bg-white/30 active:scale-95"
      >
        Activar cuenta →
      </a>
    </div>
  );
}
