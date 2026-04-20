/**
 * app/p/not-found.tsx
 *
 * 404 para el Client Portal — se muestra cuando el token es inválido o expiró.
 */
import Link from "next/link";

export default function PortalNotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {/* Icono */}
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-slate-100 text-4xl">
        🔍
      </div>

      {/* Título */}
      <h1 className="text-2xl font-black text-slate-900">
        Link no encontrado
      </h1>

      {/* Descripción */}
      <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-500">
        Este enlace no existe, ya expiró o fue revocado por el taller.
        Si creés que es un error, contactanos directamente.
      </p>

      {/* Divider decorativo */}
      <div className="my-8 h-px w-16 bg-gradient-to-r from-transparent via-slate-300 to-transparent" />

      {/* CTA: volver al inicio */}
      <Link
        href="/"
        className="flex items-center gap-2 rounded-2xl bg-orange-500 px-6 py-3 text-sm font-bold text-white shadow-sm transition active:scale-95 hover:bg-orange-600"
      >
        Ir al inicio
      </Link>

      {/* Info genérica */}
      <div className="mt-8 rounded-2xl bg-slate-50 px-6 py-4 text-left">
        <p className="text-xs font-bold uppercase tracking-widest text-slate-400">¿Necesitás ayuda?</p>
        <p className="mt-1.5 text-sm text-slate-500">
          Contactá directamente al taller que te envió el link y pedile que te reenvíe un link nuevo.
        </p>
      </div>
    </div>
  );
}
