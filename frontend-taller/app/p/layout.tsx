/**
 * app/p/layout.tsx
 *
 * Layout del Client Portal (/p/...).
 * Sin sidebar, sin navegación interna — solo branding y contenido.
 * Mobile-first (ancho angosto, tarjetas apiladas); en desktop el contenido
 * se ensancha para aprovechar la pantalla en vez de quedar en una columna
 * angosta y centrada.
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
    <div className="flex min-h-screen flex-col bg-slate-50">
      {/* ── Header mínimo ── */}
      {/* El nombre del taller se muestra en cada page desde el response del API */}
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-4 lg:max-w-5xl lg:px-8">
          {/* Logo TallerOS */}
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900">
            <span className="text-xs font-black tracking-tight text-white">OS</span>
          </div>
          <div>
            <p className="text-sm font-black leading-tight text-slate-900">TallerOS</p>
            <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">Portal del Cliente</p>
          </div>

          {/* Badge */}
          <div className="ml-auto">
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-700">
              Portal
            </span>
          </div>
        </div>
      </header>

      {/* ── Contenido ── */}
      {/* flex-1 empuja el footer al fondo del viewport en páginas cortas.
          Sin padding-bottom fijo: la vista con barra flotante de Aprobar/Rechazar
          (PresupuestoView) reserva su propio espacio solo cuando corresponde. */}
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6 lg:max-w-5xl lg:px-8 lg:py-10">
        {children}
      </main>

      {/* ── Footer mínimo ── */}
      <footer className="border-t border-slate-200 bg-white py-6 text-center">
        <p className="text-[11px] text-slate-400">
          © {new Date().getFullYear()} TallerOS · Desarrollado por FAM Desarrollos
        </p>
        <p className="mt-1 text-[10px] text-slate-300">
          La herramienta amiga de los talleres
        </p>
      </footer>
    </div>
  );
}
