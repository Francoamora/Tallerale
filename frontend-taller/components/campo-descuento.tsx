"use client";

import { formatCurrency } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ModoDescuento = "%" | "$";

function numero(valor: string) {
  const n = Number.parseFloat(valor.replace(",", "."));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * El descuento en pesos que se guarda. En "%" se calcula sobre el subtotal
 * y se redondea al peso; el backend siempre recibe un monto.
 */
export function montoDescuento(modo: ModoDescuento, valor: string, subtotal: number) {
  const n = numero(valor);
  if (modo === "%") return Math.round((subtotal * Math.min(n, 100)) / 100);
  return n;
}

/**
 * Campo de descuento con selector % / $. Arranca en porcentaje, que es como
 * lo piensa el taller ("le hago un 10%"); el equivalente en pesos se muestra
 * abajo para que no haya sorpresas.
 */
export function CampoDescuento({
  id,
  modo,
  valor,
  subtotal,
  onModo,
  onValor,
  invalido = false,
}: {
  id: string;
  modo: ModoDescuento;
  valor: string;
  subtotal: number;
  onModo: (modo: ModoDescuento) => void;
  onValor: (valor: string) => void;
  invalido?: boolean;
}) {
  const monto = montoDescuento(modo, valor, subtotal);

  function cambiarModo(nuevo: ModoDescuento) {
    if (nuevo === modo) return;
    // Se convierte lo que ya estaba cargado para no perderlo.
    if (numero(valor) > 0 && subtotal > 0) {
      onValor(nuevo === "$" ? String(monto) : String(Math.round((monto / subtotal) * 1000) / 10));
    }
    onModo(nuevo);
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-1.5">
        <div className="flex h-9 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-900" role="group" aria-label="Tipo de descuento">
          {(["%", "$"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => cambiarModo(m)}
              aria-pressed={modo === m}
              title={m === "%" ? "Descuento en porcentaje" : "Descuento en pesos"}
              className={cn(
                "w-8 rounded-md text-sm font-semibold transition",
                modo === m ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400",
              )}
            >
              {m}
            </button>
          ))}
        </div>
        <input
          id={id}
          type="number"
          inputMode="decimal"
          min="0"
          max={modo === "%" ? 100 : undefined}
          step="any"
          placeholder="0"
          value={valor}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => onValor(e.target.value)}
          aria-invalid={invalido}
          className={cn(
            "h-9 w-24 rounded-lg border bg-white px-3 text-right text-sm tabular-nums text-slate-900 outline-none transition focus:ring-4 focus:ring-brand-500/10 dark:bg-slate-900 dark:text-white",
            "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none",
            invalido ? "border-red-400 focus:border-red-500" : "border-slate-200 focus:border-brand-500 dark:border-slate-700",
          )}
        />
      </div>
      {modo === "%" && monto > 0 && <span className="text-xs tabular-nums text-emerald-700 dark:text-emerald-400">− {formatCurrency(monto)}</span>}
    </div>
  );
}
