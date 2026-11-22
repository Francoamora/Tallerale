/**
 * La marca de Tallerista: una "T" hecha con una llave cruz y su tubo.
 * Es la misma figura del favicon (app/icon.svg); si cambia una, cambiar la otra.
 */
export function MarcaTallerista({ className = "h-9 w-9", title }: { className?: string; title?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} role={title ? "img" : undefined} aria-hidden={title ? undefined : true} aria-label={title}>
      <rect width="64" height="64" rx="15" fill="#EA580C" />
      <rect x="12" y="14" width="40" height="10" rx="5" fill="#fff" />
      <rect x="27" y="16" width="10" height="24" fill="#fff" />
      <circle cx="32" cy="44" r="9" fill="#fff" />
      <polygon points="35.98,46.3 32,48.6 28.02,46.3 28.02,41.7 32,39.4 35.98,41.7" fill="#EA580C" />
    </svg>
  );
}

/** Marca + nombre, para la web pública, el login y el registro. */
export function LogoTallerista({ className = "", oscuro = false }: { className?: string; oscuro?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className}`}>
      <MarcaTallerista className="h-8 w-8 shrink-0" />
      <span className={`font-display text-xl font-extrabold tracking-tight ${oscuro ? "text-white" : "text-slate-900"}`}>Tallerista</span>
    </span>
  );
}
