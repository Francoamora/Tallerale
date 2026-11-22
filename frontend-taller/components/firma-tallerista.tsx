/**
 * Firma al pie de las páginas que ve el cliente (presupuesto y vehículo):
 * discreta, para que la marca protagonista siga siendo la del taller.
 */
export function FirmaTallerista({ className = "" }: { className?: string }) {
  return (
    <div className={`text-center text-xs text-slate-400 ${className}`}>
      <p>
        <span className="font-semibold text-slate-500">Tallerista</span> · La herramienta amiga de los talleres
      </p>
      <p className="mt-1">
        Creado por{" "}
        <a
          href="https://famdesarrollos.com.ar"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-slate-500 underline-offset-2 transition hover:text-brand-600 hover:underline"
        >
          FAM Desarrollos
        </a>
      </p>
    </div>
  );
}
