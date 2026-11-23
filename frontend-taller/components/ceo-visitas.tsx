"use client";

/**
 * Panel CEO · Visitas al sitio: cuánta gente entra a la landing, el login y
 * el registro, de dónde viene y cuántos terminan registrándose.
 * Un solo color (naranja de marca, validado en claro y oscuro) para la
 * magnitud; los textos van siempre en tinta, nunca en el color de la barra.
 */
import { useEffect, useState } from "react";
import { getCeoVisitas, type CeoConteo, type CeoVisitas } from "@/lib/api";
import { cn } from "@/lib/utils";

const PERIODOS = [7, 30, 90] as const;
const diaCorto = new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short" });
const diaLargo = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" });
const numero = new Intl.NumberFormat("es-AR");

// Las fechas llegan como "2026-11-22": se leen como fecha local, no UTC.
const comoFecha = (iso: string) => {
  const [a, m, d] = iso.split("-").map(Number);
  return new Date(a, m - 1, d);
};

function Dato({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle?: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4 dark:bg-slate-900/60">
      <p className="text-sm text-slate-500 dark:text-slate-400">{etiqueta}</p>
      <p className="mt-1 font-display text-3xl font-extrabold leading-none tabular-nums text-slate-900 dark:text-white">{valor}</p>
      {detalle && <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">{detalle}</p>}
    </div>
  );
}

function Lista({ titulo, filas, total }: { titulo: string; filas: CeoConteo[]; total: number }) {
  const max = Math.max(1, ...filas.map((f) => f.visitas));
  return (
    <div>
      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{titulo}</h3>
      {filas.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">Sin datos todavía.</p>
      ) : (
        <ul className="mt-3 space-y-2.5">
          {filas.map((f) => (
            <li key={f.nombre}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate text-slate-700 dark:text-slate-200">{f.nombre}</span>
                <span className="shrink-0 tabular-nums text-slate-900 dark:text-white">
                  {numero.format(f.visitas)} <span className="text-xs text-slate-400">· {Math.round((f.visitas * 100) / Math.max(1, total))}%</span>
                </span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700/60">
                <div className="h-full rounded-full bg-[#ea580c]" style={{ width: `${(f.visitas / max) * 100}%` }} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function GraficoPorDia({ dias }: { dias: CeoVisitas["por_dia"] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...dias.map((d) => d.visitas));
  // Tres líneas de referencia redondas (0, mitad y tope) en vez de una grilla cargada.
  const tope = max <= 4 ? 4 : max <= 10 ? Math.ceil(max / 2) * 2 : Math.ceil(max / 10) * 10;
  const marcas = [0, tope / 2, tope];
  const etiquetaCada = dias.length <= 7 ? 1 : dias.length <= 31 ? 5 : 15;
  const activo = hover !== null ? dias[hover] : null;

  return (
    <figure>
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-sm font-semibold text-slate-900 dark:text-white">Visitas por día</span>
        <span className="text-xs text-slate-500 dark:text-slate-400" aria-live="polite">
          {activo ? `${diaLargo.format(comoFecha(activo.fecha))}: ${numero.format(activo.visitas)} visitas · ${numero.format(activo.visitantes)} visitantes` : "Pasá el mouse por una barra"}
        </span>
      </figcaption>
      <div className="relative mt-4 h-44 pl-8">
        {/* Líneas de referencia, apenas visibles */}
        {marcas.map((m) => (
          <div key={m} className="absolute inset-x-0 left-8 border-t border-slate-200/70 dark:border-slate-700/60" style={{ bottom: `${(m / tope) * 100}%` }}>
            <span className="absolute -left-8 -top-2 w-6 text-right text-[11px] tabular-nums text-slate-400">{m}</span>
          </div>
        ))}
        <div className="absolute inset-y-0 left-8 right-0 flex items-end gap-[2px]" onMouseLeave={() => setHover(null)}>
          {dias.map((d, i) => (
            <button
              key={d.fecha}
              type="button"
              onMouseEnter={() => setHover(i)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
              aria-label={`${diaLargo.format(comoFecha(d.fecha))}: ${d.visitas} visitas, ${d.visitantes} visitantes`}
              // La zona que se toca es toda la columna, no sólo la barra.
              className="group relative flex h-full min-w-0 flex-1 items-end outline-none"
            >
              <span
                className={cn("block w-full rounded-t-[4px] bg-[#ea580c] transition-opacity", hover !== null && hover !== i && "opacity-45", "group-focus-visible:ring-2 group-focus-visible:ring-slate-900 dark:group-focus-visible:ring-white")}
                style={{ height: d.visitas ? `max(3px, ${(d.visitas / tope) * 100}%)` : "0" }}
              />
            </button>
          ))}
        </div>
      </div>
      <div className="mt-2 flex pl-8 text-[11px] text-slate-400">
        {dias.map((d, i) => (
          <span key={d.fecha} className="min-w-0 flex-1 whitespace-nowrap text-center">
            {i % etiquetaCada === 0 || i === dias.length - 1 ? diaCorto.format(comoFecha(d.fecha)) : ""}
          </span>
        ))}
      </div>
      <details className="mt-3 text-sm">
        <summary className="cursor-pointer text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white">Ver como tabla</summary>
        <div className="mt-2 max-h-60 overflow-auto rounded-xl ring-1 ring-slate-200 dark:ring-slate-700">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr><th className="px-3 py-2 font-semibold">Día</th><th className="px-3 py-2 text-right font-semibold">Visitas</th><th className="px-3 py-2 text-right font-semibold">Visitantes</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {[...dias].reverse().map((d) => (
                <tr key={d.fecha}><td className="px-3 py-1.5 text-slate-700 dark:text-slate-200">{diaCorto.format(comoFecha(d.fecha))}</td><td className="px-3 py-1.5 text-right tabular-nums">{d.visitas}</td><td className="px-3 py-1.5 text-right tabular-nums">{d.visitantes}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

export function CeoVisitas() {
  const [dias, setDias] = useState<(typeof PERIODOS)[number]>(30);
  const [datos, setDatos] = useState<CeoVisitas | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let vivo = true;
    getCeoVisitas(dias)
      .then((d) => { if (vivo) { setDatos(d); setError(""); } })
      .catch(() => { if (vivo) setError("No pudimos cargar las visitas."); });
    return () => { vivo = false; };
  }, [dias]);

  const cambio = datos && datos.visitas_periodo_anterior > 0
    ? Math.round(((datos.visitas - datos.visitas_periodo_anterior) * 100) / datos.visitas_periodo_anterior)
    : null;

  return (
    <section className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-800 dark:ring-slate-700 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">Visitas al sitio</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">Landing, login y registro. Sin cookies ni robots.</p>
        </div>
        <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-900" role="group" aria-label="Período">
          {PERIODOS.map((p) => (
            <button key={p} type="button" onClick={() => setDias(p)} aria-pressed={dias === p} className={cn("h-9 rounded-lg px-3.5 text-sm font-semibold transition", dias === p ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white")}>
              {p} días
            </button>
          ))}
        </div>
      </div>

      {error && <p className="mt-4 rounded-xl bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">{error}</p>}

      {!datos ? (
        <div className="mt-5 h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-900/60" />
      ) : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Dato
              etiqueta="Visitas"
              valor={numero.format(datos.visitas)}
              detalle={cambio === null ? `${numero.format(datos.hoy)} hoy` : <><span className={cambio >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}>{cambio >= 0 ? "▲" : "▼"} {Math.abs(cambio)}%</span> vs. los {datos.dias} días anteriores · {numero.format(datos.hoy)} hoy</>}
            />
            <Dato etiqueta="Visitantes únicos" valor={numero.format(datos.visitantes)} detalle="personas distintas" />
            <Dato etiqueta="Registros" valor={numero.format(datos.registros)} detalle="talleres nuevos en el período" />
            <Dato etiqueta="Conversión" valor={`${datos.conversion.toLocaleString("es-AR")}%`} detalle="de visitantes a registro" />
          </div>

          {datos.visitas === 0 ? (
            <p className="mt-6 rounded-2xl border border-dashed border-slate-200 px-5 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
              Todavía no hay visitas en este período. Se cuentan desde que se activó el contador.
            </p>
          ) : (
            <>
              <div className="mt-6"><GraficoPorDia dias={datos.por_dia} /></div>
              <div className="mt-8 grid gap-8 md:grid-cols-3">
                <Lista titulo="De dónde vienen" filas={datos.fuentes} total={datos.visitas} />
                <Lista titulo="Qué páginas ven" filas={datos.paginas} total={datos.visitas} />
                <Lista titulo="Desde qué dispositivo" filas={datos.dispositivos} total={datos.visitas} />
              </div>
            </>
          )}
        </>
      )}
    </section>
  );
}
