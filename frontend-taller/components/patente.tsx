import { cn } from "@/lib/utils";

/**
 * La patente como texto: en mayúsculas y con algo de aire entre letras para
 * que se lea de un vistazo, sin el recuadro de chapa.
 */
export function Patente({ valor, className }: { valor: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-sm font-semibold uppercase tracking-wide text-slate-500 tabular-nums dark:text-slate-400",
        className,
      )}
    >
      {valor}
    </span>
  );
}
