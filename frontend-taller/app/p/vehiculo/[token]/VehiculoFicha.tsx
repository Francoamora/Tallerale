"use client";

/**
 * Portal del vehículo: la ficha que recibe el cliente por WhatsApp.
 * A la izquierda el auto, el próximo service y el turno (fija al bajar en la
 * compu); a la derecha lo que se le hizo, agrupado por año y con buscador
 * para que aguante muchos años de visitas.
 */

import { useState } from "react";
import type { PublicOTResumen, PublicVehiculo } from "@/lib/api-public";
import { FirmaTallerista } from "@/components/firma-tallerista";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

// ─── Ayudas compartidas ──────────────────────────────────────────────────────
const km = (n: number) => `${Math.round(n).toLocaleString("es-AR")} km`;
const pesos = (n: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(n);
const fecha = (s: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }) => new Date(s).toLocaleDateString("es-AR", opts).replace(".", "");

function datos(v: PublicVehiculo) {
  const historial = [...v.historial].sort((a, b) => new Date(b.fecha_realizado).getTime() - new Date(a.fecha_realizado).getTime());
  const taller = v.taller_nombre || "El taller";
  const auto = `${v.marca} ${v.modelo}`.trim();
  const primerNombre = v.cliente_nombre?.split(" ")[0] ?? "";
  const faltan = v.proximo_service_km ? v.proximo_service_km - v.kilometraje_actual : null;
  // Barra del próximo service: del último service al próximo.
  const desde = historial[0]?.kilometraje ?? 0;
  const tramo = v.proximo_service_km ? Math.max(v.proximo_service_km - desde, 1) : 1;
  const avance = v.proximo_service_km ? Math.min(100, Math.max(0, ((v.kilometraje_actual - desde) / tramo) * 100)) : 0;
  const recomendacion = historial.find((h) => h.recomendaciones_proximo_service)?.recomendaciones_proximo_service ?? "";
  const turno = v.taller_tel ? buildWhatsAppUrl(`Hola! Quiero sacar turno para mi ${auto} (${v.patente}).`, v.taller_tel) : "";
  const iniciales = taller.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  return { historial, taller, auto, primerNombre, faltan, avance, recomendacion, turno, iniciales };
}

type D = ReturnType<typeof datos>;

function Logo({ v, d, className = "h-11 w-11" }: { v: PublicVehiculo; d: D; className?: string }) {
  if (v.taller_logo_url) {
    // eslint-disable-next-line @next/next/no-img-element -- logo del taller servido por la app
    return <img src={v.taller_logo_url} alt="" className={cn(className, "shrink-0 rounded-xl object-cover")} />;
  }
  return <span className={cn(className, "grid shrink-0 place-items-center rounded-xl bg-brand-600 text-sm font-bold text-white")} aria-hidden="true">{d.iniciales}</span>;
}

function BotonTurno({ d, className = "" }: { d: D; className?: string }) {
  if (!d.turno) return null;
  return (
    <a href={d.turno} target="_blank" rel="noopener noreferrer" className={cn("flex h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-600 text-[15px] font-semibold text-white shadow-lg shadow-emerald-600/20 transition hover:bg-emerald-700", className)}>
      <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35ZM12.04 21.5a9.45 9.45 0 0 1-4.82-1.32l-.35-.2-3.58.94.96-3.49-.23-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.22 4.25-9.47 9.48-9.47a9.47 9.47 0 0 1 9.47 9.48c0 5.22-4.25 9.46-9.47 9.46Zm8.06-17.53A11.3 11.3 0 0 0 12.04.63C5.76.63.65 5.74.65 12.02c0 2 .52 3.96 1.52 5.69L.55 23.6l6.04-1.58a11.4 11.4 0 0 0 5.44 1.39c6.28 0 11.39-5.11 11.39-11.39 0-3.04-1.19-5.9-3.34-8.05Z" /></svg>
      Pedir turno por WhatsApp
    </a>
  );
}

function Saldo({ v }: { v: PublicVehiculo }) {
  return v.saldo_pendiente > 0 ? (
    <p className="text-sm text-amber-700">Tenés {pesos(v.saldo_pendiente)} pendientes con el taller.</p>
  ) : (
    <p className="text-sm text-emerald-700">Tu cuenta está al día ✓</p>
  );
}

// ─── Ficha (mismo estilo que el presupuesto) ─────────────────────────────────
export function VehiculoFicha({ vehiculo: v }: { vehiculo: PublicVehiculo }) {
  const d = datos(v);
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-100 to-slate-200/70 px-4 py-8 lg:px-8 lg:py-14">
      {/* Sin overflow-hidden: la columna del auto queda fija al bajar en la compu. */}
      <article className="mx-auto max-w-xl rounded-[28px] bg-white shadow-[0_24px_60px_-20px_rgba(15,23,42,.25)] ring-1 ring-slate-200/70 lg:grid lg:max-w-5xl lg:grid-cols-[380px_minmax(0,1fr)]">
        <div className="lg:rounded-l-[28px] lg:bg-slate-50/70">
        <div className="flex flex-col lg:sticky lg:top-4">
          <header className="flex items-center gap-3 px-6 pt-6 sm:px-8 sm:pt-8">
            <Logo v={v} d={d} />
            <div className="min-w-0">
              <p className="truncate font-semibold text-slate-900">{d.taller}</p>
              {v.taller_tel && <a href={`tel:${v.taller_tel}`} className="text-sm text-slate-500">{v.taller_tel}</a>}
            </div>
          </header>
          <section className="px-6 pb-6 pt-8 sm:px-8 lg:flex-1">
            <p className="text-sm text-slate-500">{d.primerNombre ? `${d.primerNombre}, esta es la ficha de tu` : "Ficha de tu"}</p>
            <p className="mt-1 font-display text-3xl font-extrabold leading-tight text-slate-900">{d.auto}</p>
            <p className="mt-1 text-sm text-slate-500">
              {v.anio ? `${v.anio} · ` : ""}Patente <span className="font-semibold tracking-wide text-slate-700">{v.patente}</span>
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 lg:bg-white">
                <p className="text-xs text-slate-500">Kilometraje</p>
                <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-slate-900">{km(v.kilometraje_actual)}</p>
              </div>
              <div className="rounded-2xl bg-white p-4 ring-1 ring-slate-200">
                <p className="text-xs text-slate-500">Visitas al taller</p>
                <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-slate-900">{d.historial.length}</p>
              </div>
            </div>
            {v.proximo_service_km && d.faltan !== null && (
              <div className={cn("mt-3 rounded-2xl p-4", d.faltan <= 1000 ? "bg-amber-50 ring-1 ring-amber-200" : "bg-white ring-1 ring-slate-200")}>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-semibold text-slate-900">Próximo service</p>
                  <p className={cn("text-sm font-semibold", d.faltan <= 1000 ? "text-amber-700" : "text-slate-600")}>{d.faltan > 0 ? `faltan ${km(d.faltan)}` : "¡ya toca!"}</p>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100"><div className={cn("h-full rounded-full", d.faltan <= 1000 ? "bg-amber-500" : "bg-emerald-500")} style={{ width: `${d.avance}%` }} /></div>
                <p className="mt-2 text-xs text-slate-500">A los {km(v.proximo_service_km)}</p>
              </div>
            )}
            <div className="mt-5"><Saldo v={v} /></div>
          </section>
          <div className="px-6 pb-6 sm:px-8 lg:pb-8"><BotonTurno d={d} /></div>
        </div>
        </div>

        <section className="border-t-2 border-dashed border-slate-200 px-6 py-6 sm:px-8 lg:border-l-2 lg:border-t-0 lg:px-10 lg:py-10">
          <p className="text-xs font-medium text-slate-500">Lo que le hicimos</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-900">Historial de tu {v.modelo}</h2>
          {d.recomendacion && (
            <div className="mt-4 rounded-2xl bg-brand-50 px-4 py-3 text-sm text-brand-900">
              <span className="font-semibold">El taller te recomienda: </span>{d.recomendacion}
            </div>
          )}
          <HistorialAgrupado historial={d.historial} />
        </section>
      </article>
      <FirmaTallerista className="mt-8" />
    </div>
  );
}

/**
 * Historial que aguanta muchos años de visitas: agrupado por año (el más
 * reciente abierto), con buscador cuando hay más de 6 visitas.
 */
function HistorialAgrupado({ historial }: { historial: PublicOTResumen[] }) {
  const [busqueda, setBusqueda] = useState("");
  const [abierta, setAbierta] = useState<number | null>(historial[0]?.id ?? null);
  const anioReciente = historial[0] ? new Date(historial[0].fecha_realizado).getFullYear() : 0;
  const [aniosAbiertos, setAniosAbiertos] = useState<Set<number>>(() => new Set([anioReciente]));

  const q = busqueda.trim().toLowerCase();
  const visibles = q
    ? historial.filter((h) => (h.resumen_trabajos ?? "").toLowerCase().includes(q) || h.items.some((it) => it.descripcion.toLowerCase().includes(q)))
    : historial;
  const porAnio = new Map<number, PublicOTResumen[]>();
  for (const h of visibles) {
    const anio = new Date(h.fecha_realizado).getFullYear();
    porAnio.set(anio, [...(porAnio.get(anio) ?? []), h]);
  }

  function alternarAnio(anio: number) {
    setAniosAbiertos((actual) => {
      const nuevo = new Set(actual);
      if (nuevo.has(anio)) nuevo.delete(anio);
      else nuevo.add(anio);
      return nuevo;
    });
  }

  return (
    <div className="mt-5">
      {historial.length > 6 && (
        <div className="relative mb-4">
          <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" /></svg>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar: frenos, aceite, distribución…"
            aria-label="Buscar en el historial"
            className="h-11 w-full rounded-xl bg-slate-50 pl-10 pr-4 text-[15px] text-slate-900 outline-none ring-1 ring-slate-200 transition placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-brand-500"
          />
        </div>
      )}
      {q && <p className="mb-2 text-sm text-slate-500">{visibles.length ? `${visibles.length} ${visibles.length === 1 ? "visita" : "visitas"} con "${busqueda.trim()}"` : `Nada con "${busqueda.trim()}".`}</p>}

      <div className="space-y-2">
        {[...porAnio.entries()].map(([anio, visitas]) => {
          const abierto = Boolean(q) || aniosAbiertos.has(anio) || porAnio.size === 1;
          return (
            <section key={anio}>
              {porAnio.size > 1 && (
                <button type="button" onClick={() => alternarAnio(anio)} aria-expanded={abierto} className="flex w-full items-center gap-3 rounded-xl px-1 py-2 text-left">
                  <span className="font-display text-xl font-extrabold text-slate-900">{anio}</span>
                  <span className="text-sm text-slate-500">{visitas.length} {visitas.length === 1 ? "visita" : "visitas"}</span>
                  <span className="h-px flex-1 bg-slate-100" aria-hidden="true" />
                  {!q && <span className={cn("text-slate-400 transition", abierto && "rotate-180")} aria-hidden="true">⌄</span>}
                </button>
              )}
              {abierto && (
                <ul className="divide-y divide-slate-100">
                  {visitas.map((h) => {
                    const open = abierta === h.id;
                    return (
                      <li key={h.id}>
                        <button type="button" onClick={() => setAbierta(open ? null : h.id)} className="flex w-full items-center gap-4 py-3.5 text-left">
                          <span className="w-14 shrink-0 text-sm tabular-nums text-slate-500">{fecha(h.fecha_realizado, { day: "numeric", month: "short" })}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate font-medium text-slate-900">{h.resumen_trabajos || "Service"}</span>
                            <span className="block text-sm text-slate-500">{km(h.kilometraje)}</span>
                          </span>
                          <span className={cn("text-slate-400 transition", open && "rotate-180")} aria-hidden="true">⌄</span>
                        </button>
                        {open && (
                          <ul className="mb-4 ml-[72px] space-y-1.5 text-sm text-slate-600">
                            {h.items.length ? h.items.map((it, i) => <li key={i} className="flex gap-2"><span className="text-emerald-600">✓</span>{it.descripcion}</li>) : <li className="text-slate-400">Sin detalle cargado.</li>}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
