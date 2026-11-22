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
    default: "Portal del Cliente · Tallerista",
    template: "%s · Portal del Cliente",
  },
  description: "Tu portal personal de seguimiento de vehículo y presupuestos.",
};

export default function PortalLayout({ children }: { children: ReactNode }) {
  // El marco (encabezado y pie) lo pone cada vista: ver components/marco-portal.tsx.
  return <div className="min-h-screen bg-slate-50">{children}</div>;
}
