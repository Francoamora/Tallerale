import type { ReactNode } from "react";
import { FirmaTallerista } from "@/components/firma-tallerista";

/**
 * Encabezado y pie del portal del cliente (/p/...). Antes vivían en el layout;
 * ahora cada vista decide si los usa, para que los diseños del presupuesto
 * puedan ocupar la página entera.
 */
export function MarcoPortal({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-4 lg:max-w-5xl lg:px-8">
          <div>
            <p className="text-sm font-black leading-tight text-slate-900">Tallerista</p>
            <p className="text-[10px] font-medium uppercase tracking-widest text-slate-400">Portal del Cliente</p>
          </div>
          <div className="ml-auto">
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-amber-700">
              Portal
            </span>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6 lg:max-w-5xl lg:px-8 lg:py-10">{children}</main>
      <footer className="border-t border-slate-200 bg-white py-6">
        <FirmaTallerista />
      </footer>
    </div>
  );
}
