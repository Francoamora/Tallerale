"use client";

/**
 * Presupuesto que ve el cliente por link (/p/presupuesto/[token]).
 *
 * Formato de recibo: la marca es el taller, el total va bien grande y el
 * detalle se lee como un ticket. En el celular es una sola columna con la
 * decisión fija abajo (con el total a la vista); en la computadora la tarjeta
 * se ensancha en dos partes, como un ticket con talón: a la izquierda el
 * taller, el auto, el total y los botones; a la derecha el detalle.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { actualizarEstadoPublicPresupuesto, PublicApiError } from "@/lib/api-public";
import type { PublicPresupuesto } from "@/lib/api-public";
import { numeroPresupuesto } from "@/lib/documentos";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { FirmaTallerista } from "@/components/firma-tallerista";

const ARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const pesos = (v: number | string) => ARS.format(Number(v));
/** Validez que se le informa al cliente (la misma que dice el PDF). */
const VALIDEZ_DIAS = 15;

const TIPOS: { tipo: string; titulo: string }[] = [
  { tipo: "MANO_OBRA", titulo: "Trabajos" },
  { tipo: "REPUESTO", titulo: "Repuestos" },
  { tipo: "INSUMO", titulo: "Insumos" },
  { tipo: "OTRO", titulo: "Otros" },
];

type Decision = "APROBADO" | "RECHAZADO";

// ─── Confeti al aprobar (canvas, sin dependencias) ───────────────────────────
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  color: string;
  size: number;
  angle: number;
  spin: number;
  alpha: number;
}

function lanzarConfetti(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const COLORS = ["#f97316","#fb923c","#fbbf24","#34d399","#60a5fa","#a78bfa","#f472b6"];
  const COUNT  = 160;

  const particles: Particle[] = Array.from({ length: COUNT }, () => ({
    x:     Math.random() * canvas.width,
    y:     -10 - Math.random() * 120,
    vx:    (Math.random() - 0.5) * 4,
    vy:    2 + Math.random() * 4,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    size:  6 + Math.random() * 8,
    angle: Math.random() * Math.PI * 2,
    spin:  (Math.random() - 0.5) * 0.2,
    alpha: 1,
  }));

  let rafId: number;
  let tick = 0;

  function draw() {
    ctx!.clearRect(0, 0, canvas.width, canvas.height);

    for (const p of particles) {
      p.x     += p.vx;
      p.y     += p.vy;
      p.angle += p.spin;
      p.vy    += 0.07; // gravedad suave

      // Fade out en los últimos 40 ticks
      if (tick > 80) p.alpha = Math.max(0, p.alpha - 0.015);

      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.angle);
      ctx!.globalAlpha = p.alpha;
      ctx!.fillStyle = p.color;
      ctx!.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
      ctx!.restore();
    }

    tick++;
    if (tick < 130) {
      rafId = requestAnimationFrame(draw);
    } else {
      ctx!.clearRect(0, 0, canvas.width, canvas.height);
    }
  }

  rafId = requestAnimationFrame(draw);
  return () => cancelAnimationFrame(rafId);
}


// ─── Datos y acción ──────────────────────────────────────────────────────────
function usePresupuesto(p: PublicPresupuesto, canvasRef: React.RefObject<HTMLCanvasElement | null>) {
  const [estado, setEstado] = useState(p.estado);
  const [cargando, setCargando] = useState<Decision | null>(null);
  const [error, setError] = useState("");
  const limpiarConfetti = useRef<(() => void) | undefined>(undefined);
  useEffect(() => () => limpiarConfetti.current?.(), []);

  const decidir = useCallback(async (decision: Decision) => {
    if (cargando || (estado !== "ENVIADO" && estado !== "BORRADOR")) return;
    const previo = estado;
    setEstado(decision);
    setCargando(decision);
    setError("");
    try {
      await actualizarEstadoPublicPresupuesto(p.token, decision);
      if (decision === "APROBADO" && canvasRef.current) limpiarConfetti.current = lanzarConfetti(canvasRef.current) ?? undefined;
    } catch (e) {
      setEstado(previo);
      setError(e instanceof PublicApiError ? e.message : "No pudimos registrar tu respuesta. Probá de nuevo.");
    } finally {
      setCargando(null);
    }
  }, [cargando, estado, p.token, canvasRef]);

  const emitido = new Date(p.fecha_creacion);
  const vence = new Date(emitido.getTime() + VALIDEZ_DIAS * 86_400_000);
  const taller = p.taller_nombre || "Tu taller";
  const auto = p.vehiculo ? `${p.vehiculo.marca} ${p.vehiculo.modelo}` : "tu vehículo";
  return {
    estado, cargando, error, decidir, emitido, vence, taller, auto,
    vencido: Date.now() > vence.getTime(),
    pendiente: estado === "ENVIADO" || estado === "BORRADOR",
    num: numeroPresupuesto(p.id),
    primerNombre: (p.cliente?.nombre_completo || "").split(" ")[0],
    grupos: TIPOS.map((t) => ({ ...t, items: p.items.filter((i) => i.tipo === t.tipo) })).filter((g) => g.items.length),
    consultaUrl: p.taller_tel
      ? buildWhatsAppUrl(`Hola ${taller}, tengo una consulta sobre el presupuesto ${numeroPresupuesto(p.id)} de mi ${auto}.`, p.taller_tel)
      : "",
  };
}

type Ctx = ReturnType<typeof usePresupuesto>;
const fechaLarga = (d: Date) => d.toLocaleDateString("es-AR", { day: "numeric", month: "long" });

// ─── Vista ───────────────────────────────────────────────────────────────────
export function PresupuestoRecibo({ presupuesto: p }: { presupuesto: PublicPresupuesto }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const c = usePresupuesto(p, canvasRef);

  return (
    <>
      <canvas ref={canvasRef} className="pointer-events-none fixed inset-0 z-[999]" aria-hidden="true" />
      <div className={`min-h-screen bg-gradient-to-b from-slate-100 to-slate-200/70 px-4 pt-8 sm:pt-12 lg:px-8 lg:pb-16 lg:pt-16 ${c.pendiente ? "pb-56" : "pb-16"}`}>
        <article className="mx-auto max-w-xl overflow-hidden rounded-[28px] bg-white shadow-[0_24px_60px_-20px_rgba(15,23,42,.25)] ring-1 ring-slate-200/70 lg:grid lg:max-w-5xl lg:grid-cols-[400px_minmax(0,1fr)]">
          {/* ── Talón: taller, auto, total y decisión ── */}
          <div className="flex flex-col lg:bg-slate-50/70">
            <header className="flex items-center gap-3 px-6 pt-6 sm:px-8 sm:pt-8">
              <LogoTaller p={p} c={c} />
              <div className="min-w-0">
                <p className="truncate font-semibold text-slate-900">{c.taller}</p>
                {p.taller_tel && <a href={`tel:${p.taller_tel}`} className="text-sm text-slate-500 hover:text-slate-800">{p.taller_tel}</a>}
              </div>
              <span className="ml-auto shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 lg:bg-white lg:ring-1 lg:ring-slate-200">{c.num}</span>
            </header>

            <section className="px-6 pb-6 pt-8 text-center sm:px-8 lg:flex-1 lg:pt-12 lg:text-left">
              <p className="text-sm text-slate-500">{c.primerNombre ? `${c.primerNombre}, este` : "Este"} es el presupuesto para tu</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">
                {c.auto}{p.vehiculo?.anio ? <span className="font-normal text-slate-500"> · {p.vehiculo.anio}</span> : null}
              </p>
              {p.vehiculo && (
                <p className="mt-1 text-sm text-slate-500">
                  Patente <span className="font-semibold tracking-wide text-slate-700">{p.vehiculo.patente}</span>
                  {p.vehiculo.kilometraje_actual ? ` · ${p.vehiculo.kilometraje_actual.toLocaleString("es-AR")} km` : ""}
                </p>
              )}
              <p className="mt-6 text-sm text-slate-500 lg:mt-10">Total</p>
              <p className="font-display text-6xl font-extrabold leading-none tracking-tight text-slate-900 tabular-nums sm:text-7xl">{pesos(p.total)}</p>
              <div className="mt-3"><Vigencia c={c} /></div>
            </section>

            {/* Decisión en la computadora: al pie del talón */}
            <div className="hidden px-8 pb-8 lg:block"><Botones c={c} /></div>
          </div>

          {/* ── Corte del ticket: horizontal en el celular, vertical en la computadora ── */}
          <div className="relative lg:hidden" aria-hidden="true">
            <div className="absolute -left-3 top-0 h-6 w-6 -translate-y-1/2 rounded-full bg-slate-100" />
            <div className="absolute -right-3 top-0 h-6 w-6 -translate-y-1/2 rounded-full bg-slate-100" />
            <div className="mx-6 border-t-2 border-dashed border-slate-200 sm:mx-8" />
          </div>

          {/* ── Detalle ── */}
          <section className="relative px-6 py-6 sm:px-8 lg:border-l-2 lg:border-dashed lg:border-slate-200 lg:px-10 lg:py-10">
            <span className="absolute -left-3.5 -top-3 hidden h-6 w-6 rounded-full bg-slate-100 lg:block" aria-hidden="true" />
            <span className="absolute -bottom-3 -left-3.5 hidden h-6 w-6 rounded-full bg-slate-200/70 lg:block" aria-hidden="true" />

            <p className="text-xs font-medium text-slate-500">Qué incluye</p>
            {p.resumen_corto && <h1 className="mt-1 text-xl font-semibold text-slate-900">{p.resumen_corto}</h1>}

            {c.grupos.length === 0 ? (
              <p className="mt-6 text-sm text-slate-500">El taller no detalló los ítems. Si tenés dudas, consultalo antes de aprobar.</p>
            ) : (
              <div className="mt-5 space-y-6">
                {c.grupos.map((g) => (
                  <div key={g.tipo}>
                    <p className="mb-2.5 flex items-center gap-2 text-xs font-medium text-slate-500">
                      <IconoTipo tipo={g.tipo} />
                      {g.titulo}
                    </p>
                    <ul className="space-y-3">
                      {g.items.map((it, i) => (
                        <li key={i} className="flex items-baseline gap-3 text-[15px]">
                          <span className="min-w-0 text-slate-800">
                            {it.descripcion}
                            {Number(it.cantidad) > 1 && <span className="text-slate-400"> × {Number(it.cantidad)}</span>}
                          </span>
                          <span className="flex-1 border-b border-dotted border-slate-300" aria-hidden="true" />
                          <span className="shrink-0 tabular-nums text-slate-900">{pesos(it.subtotal)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            )}

            <dl className="mt-8 space-y-1.5 border-t border-slate-100 pt-4 text-sm">
              <div className="flex justify-between text-slate-500"><dt>Mano de obra</dt><dd className="tabular-nums">{pesos(p.total_mano_obra)}</dd></div>
              <div className="flex justify-between text-slate-500"><dt>Repuestos e insumos</dt><dd className="tabular-nums">{pesos(p.total_repuestos)}</dd></div>
              {Number(p.descuento) > 0 && <div className="flex justify-between text-emerald-700"><dt>Descuento</dt><dd className="tabular-nums">− {pesos(p.descuento)}</dd></div>}
              <div className="flex items-baseline justify-between pt-2 font-semibold text-slate-900"><dt>Total</dt><dd className="font-display text-2xl font-extrabold tabular-nums">{pesos(p.total)}</dd></div>
            </dl>
            <p className="mt-6 text-xs text-slate-400">Emitido el {fechaLarga(c.emitido)}. Los precios de repuestos pueden variar según disponibilidad.</p>
          </section>

          {/* Decisión en tablet (sin barra fija) */}
          <section className="hidden bg-slate-50 px-8 py-6 sm:block lg:hidden"><Botones c={c} /></section>
        </article>
        <FirmaTallerista className="mt-8" />
      </div>

      {/* Celular: decisión fija abajo, con el total siempre a la vista */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 p-4 backdrop-blur sm:hidden">
        {c.pendiente && (
          <div className="mb-3 flex items-baseline justify-between">
            <span className="text-sm text-slate-500">Total</span>
            <span className="font-display text-3xl font-extrabold tabular-nums text-slate-900">{pesos(p.total)}</span>
          </div>
        )}
        <Botones c={c} />
      </div>
    </>
  );
}

// ─── Piezas ──────────────────────────────────────────────────────────────────
function LogoTaller({ p, c }: { p: PublicPresupuesto; c: Ctx }) {
  if (p.taller_logo_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={p.taller_logo_url} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />;
  }
  const ini = c.taller.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  return <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-600 text-sm font-bold text-white" aria-hidden="true">{ini}</span>;
}

function IconoTipo({ tipo }: { tipo: string }) {
  const trabajo = tipo === "MANO_OBRA" || tipo === "OTRO";
  return (
    <span className={`grid h-6 w-6 place-items-center rounded-md ${trabajo ? "bg-slate-100 text-slate-600" : "bg-sky-50 text-sky-700"}`} aria-hidden="true">
      {trabajo ? (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085" /></svg>
      ) : (
        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" /></svg>
      )}
    </span>
  );
}

function Vigencia({ c }: { c: Ctx }) {
  if (!c.pendiente) return null;
  return c.vencido ? (
    <p className="text-sm font-medium text-amber-700">Venció el {fechaLarga(c.vence)}: confirmá precios con el taller antes de aprobar.</p>
  ) : (
    <p className="text-sm text-slate-500">Válido hasta el {fechaLarga(c.vence)}</p>
  );
}

function Botones({ c }: { c: Ctx }) {
  if (c.estado === "APROBADO") {
    return (
      <div className="rounded-2xl bg-emerald-50 p-4 text-center text-emerald-800">
        <p className="font-semibold">Aprobaste el presupuesto</p>
        <p className="mt-0.5 text-sm opacity-80">{c.taller} ya está avisado y te va a escribir para coordinar.</p>
      </div>
    );
  }
  if (c.estado === "RECHAZADO") {
    return (
      <div className="rounded-2xl bg-slate-100 p-4 text-center text-slate-700">
        <p className="font-semibold">Rechazaste el presupuesto</p>
        <p className="mt-0.5 text-sm opacity-80">Si querés ajustarlo, escribile al taller.</p>
      </div>
    );
  }
  if (!c.pendiente) return null;
  const spinner = <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />;
  return (
    <div className="space-y-2.5">
      <button
        onClick={() => c.decidir("APROBADO")}
        disabled={!!c.cargando}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-600/25 transition hover:bg-emerald-700 active:scale-[.98] disabled:opacity-60"
      >
        {c.cargando === "APROBADO" ? spinner : null}
        Aprobar presupuesto
      </button>
      <div className="flex gap-2.5">
        <button
          onClick={() => c.decidir("RECHAZADO")}
          disabled={!!c.cargando}
          className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[.98] disabled:opacity-60"
        >
          {c.cargando === "RECHAZADO" ? spinner : null}
          Rechazar
        </button>
        {c.consultaUrl && (
          <a href={c.consultaUrl} target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
            Tengo una duda
          </a>
        )}
      </div>
      {c.error && <p className="text-center text-sm font-medium text-red-600">{c.error}</p>}
    </div>
  );
}
