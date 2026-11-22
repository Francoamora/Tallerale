import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Estilo de los campos de texto de los formularios del sistema. */
export const campoClase =
  "h-11 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white";

/** Sin las flechitas del navegador en los campos de números. */
export const sinFlechas = "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";

export function Tarjeta({ titulo, descripcion, extra, children, className }: { titulo: string; descripcion?: string; extra?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-6", className)}>
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{titulo}</h2>
          {descripcion && <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{descripcion}</p>}
        </div>
        {extra}
      </div>
      {children}
    </section>
  );
}

export function Campo({ etiqueta, obligatorio = false, ayuda, error, ok, className, children }: { etiqueta: string; obligatorio?: boolean; ayuda?: string; error?: string; ok?: string; className?: string; children: ReactNode }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
        {etiqueta}
        {obligatorio && <span className="text-brand-600"> *</span>}
      </span>
      {children}
      {error ? (
        <span className="mt-1 block text-xs font-medium text-red-600 dark:text-red-400">{error}</span>
      ) : ok ? (
        <span className="mt-1 block text-xs text-emerald-700 dark:text-emerald-400">{ok}</span>
      ) : ayuda ? (
        <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">{ayuda}</span>
      ) : null}
    </label>
  );
}
