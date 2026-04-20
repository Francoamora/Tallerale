/**
 * app/p/layout.tsx
 *
 * Layout mínimo para el Client Portal (/p/...).
 * Sin sidebar, sin navegación interna — solo branding y contenido centrado.
 * Mobile-first: ancho máximo 520px centrado, padding lateral 16px.
 */
import type { ReactNode } from "react";

export const metadata = {
  title: {
    default: "Portal del Cliente · TallerOS",
    template: "%s · Portal del Cliente",
  },
  description: "Tu portal personal de seguimiento de vehículo y presupuestos.",
};

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-orange-50/30">
      {/* ── Header mínimo ── */}
      {/* El nombre del taller se muestra en cada page desde el response del API */}
      <header className="border-b border-slate-200/80 bg-white/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-4">
          {/* Logo TallerOS */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-sm">
            <span className="text-xs font-black tracking-tight text-white">OS</span>
          </div>
          <div>
            <p className="text-sm font-black leading-tight text-slate-900">TallerOS</p>
            <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">Portal del Cliente</p>
          </div>

          {/* Badge */}
          <div className="ml-auto">
            <span className="rounded-full bg-orange-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-orange-600 ring-1 ring-orange-200">
              Portal
            </span>
          </div>
        </div>
      </header>

      {/* ── Contenido ── */}
      <main className="mx-auto max-w-lg px-4 py-6 pb-32">
        {children}
      </main>

      {/* ── Footer mínimo ── */}
      <footer className="border-t border-slate-200/80 bg-white/60 py-6 text-center">
        <p className="text-[11px] text-slate-400">
          © {new Date().getFullYear()} TallerOS · Todos los derechos reservados
        </p>
        <p className="mt-1 text-[10px] text-slate-300">
          Este portal es de uso exclusivo del titular del vehículo
        </p>
      </footer>
    </div>
  );
}
