"use client";

/**
 * app/p/presupuesto/[token]/PresupuestoView.tsx — CLIENT COMPONENT
 *
 * Vista del presupuesto para el cliente final:
 *  · Muestra detalle completo (items, totales, datos vehículo)
 *  · Desktop: layout de dos columnas (detalle + resumen fijo). Mobile:
 *    tarjetas apiladas + sticky bottom bar.
 *  · Sticky bottom bar con Aprobar / Rechazar (solo si estado === "ENVIADO")
 *  · Optimistic UI: estado cambia al instante, rollback en error
 *  · Confetti Canvas puro (sin dependencias npm) en aprobación
 *  · Link al portal del vehículo si el token del vehículo está disponible
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  actualizarEstadoPublicPresupuesto,
  PublicApiError,
} from "@/lib/api-public";
import type { PublicPresupuesto } from "@/lib/api-public";
import { CarIcon, CheckIcon, XIcon } from "@/components/icons";
import { PublicTallerBrand } from "@/components/public-taller-brand";

// ─── Formateo ─────────────────────────────────────────────────────────────────
const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

function formatCurrency(v: number | string) {
  return ARS.format(Number(v));
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

// ─── Badge de estado ──────────────────────────────────────────────────────────
const ESTADO_CONFIG: Record<
  string,
  { label: string; dot: string; text: string; border: string }
> = {
  BORRADOR:  { label: "Borrador",  dot: "bg-slate-400",   text: "text-slate-600",   border: "border-slate-300" },
  ENVIADO:   { label: "Enviado",   dot: "bg-sky-500",     text: "text-sky-700",     border: "border-sky-300"   },
  APROBADO:  { label: "Aprobado",  dot: "bg-emerald-500", text: "text-emerald-700", border: "border-emerald-300" },
  RECHAZADO: { label: "Rechazado", dot: "bg-red-500",     text: "text-red-700",     border: "border-red-300"   },
};

// ─── Confetti Canvas puro ─────────────────────────────────────────────────────
interface Particle {
  x: number; y: number;
  vx: number; vy: number;
  color: string;
  size: number;
  angle: number;
  spin: number;
  alpha: number;
}

function launchConfetti(canvas: HTMLCanvasElement) {
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

// ─── Componente principal ─────────────────────────────────────────────────────
interface Props {
  presupuesto: PublicPresupuesto;
}

export function PresupuestoView({ presupuesto: inicial }: Props) {
  const [estado, setEstado]         = useState(inicial.estado);
  const [cargando, setCargando]     = useState<"APROBADO" | "RECHAZADO" | null>(null);
  const [toast, setToast]           = useState<{ msg: string; tipo: "ok" | "error" } | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cleanupRef = useRef<(() => void) | undefined>(undefined);

  const num = `P-${String(inicial.id).padStart(4, "0")}`;

  const cfg = ESTADO_CONFIG[estado] ?? ESTADO_CONFIG.BORRADOR;

  // Limpiar confetti al desmontar
  useEffect(() => () => { cleanupRef.current?.(); }, []);

  function showToast(msg: string, tipo: "ok" | "error") {
    setToast({ msg, tipo });
    setTimeout(() => setToast(null), 4000);
  }

  const handleDecision = useCallback(
    async (decision: "APROBADO" | "RECHAZADO") => {
      if (cargando || estado !== "ENVIADO") return;

      // Optimistic
      const prevEstado = estado;
      setEstado(decision);
      setCargando(decision);

      try {
        await actualizarEstadoPublicPresupuesto(inicial.token, decision);

        if (decision === "APROBADO") {
          if (canvasRef.current) {
            cleanupRef.current = launchConfetti(canvasRef.current) ?? undefined;
          }
          showToast("¡Presupuesto aprobado! El taller fue notificado.", "ok");
        } else {
          showToast("Presupuesto rechazado. Podés contactarnos para ajustarlo.", "ok");
        }
      } catch (err) {
        // Rollback
        setEstado(prevEstado);
        const msg =
          err instanceof PublicApiError
            ? err.message
            : "Error de conexión. Intentá de nuevo.";
        showToast(msg, "error");
      } finally {
        setCargando(null);
      }
    },
    [cargando, estado, inicial.token],
  );

  // ── Agrupar items por tipo ───────────────────────────────────────────────────
  const TIPO_LABELS: Record<string, string> = {
    MANO_OBRA: "Mano de Obra",
    REPUESTO:  "Repuestos",
    INSUMO:    "Insumos",
    OTRO:      "Otros",
  };
  const TIPO_ORDER = ["MANO_OBRA", "REPUESTO", "INSUMO", "OTRO"];

  const grupos = TIPO_ORDER
    .map(tipo => ({
      tipo,
      label: TIPO_LABELS[tipo] ?? tipo,
      items: inicial.items.filter(i => i.tipo === tipo),
    }))
    .filter(g => g.items.length > 0);

  const puedeDecidirAun = estado === "ENVIADO";

  // ── Botones de decisión (compartidos entre sidebar desktop y bottom bar mobile) ──
  const decisionButtons = (
    <div className="flex gap-3">
      <button
        onClick={() => handleDecision("RECHAZADO")}
        disabled={!!cargando}
        className="flex flex-1 items-center justify-center gap-2 rounded-xl border-2 border-slate-200 bg-white py-3.5 text-sm font-black text-slate-600 transition disabled:opacity-50 active:scale-95 hover:border-slate-300 hover:bg-slate-50"
      >
        {cargando === "RECHAZADO" ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
        ) : (
          <XIcon className="h-4 w-4" />
        )}
        Rechazar
      </button>
      <button
        onClick={() => handleDecision("APROBADO")}
        disabled={!!cargando}
        className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 py-3.5 text-sm font-black text-white shadow-sm shadow-emerald-600/20 transition disabled:opacity-50 active:scale-95 hover:bg-emerald-700"
      >
        {cargando === "APROBADO" ? (
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-300 border-t-white" />
        ) : (
          <CheckIcon className="h-4 w-4" />
        )}
        Aprobar
      </button>
    </div>
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Canvas confetti — encima de todo, pointer-none */}
      <canvas
        ref={canvasRef}
        className="pointer-events-none fixed inset-0 z-[999]"
        aria-hidden="true"
      />

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-28 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 fade-in rounded-2xl px-5 py-3.5 text-sm font-bold text-white shadow-2xl lg:bottom-6 lg:left-auto lg:right-6 lg:max-w-sm ${
            toast.tipo === "ok" ? "bg-slate-900" : "bg-red-600"
          }`}
        >
          {toast.msg}
        </div>
      )}

      <div className="lg:grid lg:grid-cols-3 lg:items-start lg:gap-6">
        {/* ── COLUMNA PRINCIPAL ── */}
        <div className="space-y-4 lg:col-span-2">

          {/* ── ENCABEZADO ── */}
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 sm:p-6">
            <PublicTallerBrand
              nombre={inicial.taller_nombre}
              logoUrl={inicial.taller_logo_url}
            />
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-amber-700">
                  Presupuesto
                </p>
                <h1 className="mt-1 font-mono text-2xl font-black text-slate-900 sm:text-3xl">
                  {num}
                </h1>
                {inicial.resumen_corto && (
                  <p className="mt-1.5 text-sm font-medium leading-snug text-slate-600">
                    {inicial.resumen_corto}
                  </p>
                )}
                <p className="mt-2 text-xs text-slate-400">
                  Emitido el {formatDate(inicial.fecha_creacion)}
                  {inicial.taller_nombre && <> · {inicial.taller_nombre}</>}
                </p>
              </div>

              {/* Badge de estado */}
              <div className={`inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-white px-3 py-1.5 ${cfg.border}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                <span className={`text-[10px] font-black uppercase tracking-widest ${cfg.text}`}>
                  {cfg.label}
                </span>
              </div>
            </div>

            {/* Banner de estado especial */}
            {estado === "APROBADO" && (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-center">
                <p className="text-sm font-bold text-emerald-700">
                  ¡Presupuesto aprobado! El taller ya fue notificado y coordinará el trabajo con vos.
                </p>
              </div>
            )}
            {estado === "RECHAZADO" && (
              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-center">
                <p className="text-sm font-semibold text-slate-600">
                  Presupuesto rechazado. Contactanos si querés modificar algo.
                </p>
              </div>
            )}
          </div>

          {/* ── CLIENTE + VEHÍCULO ── */}
          {(inicial.cliente || inicial.vehiculo) && (
            <div className={`grid gap-4 ${inicial.cliente && inicial.vehiculo ? "sm:grid-cols-2" : ""}`}>
              {inicial.cliente && (
                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Cliente
                  </p>
                  <div className="flex items-center gap-3">
                    {/* Avatar letra */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-lg font-black text-orange-600">
                      {inicial.cliente.nombre_completo.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">{inicial.cliente.nombre_completo}</p>
                      {inicial.cliente.telefono && (
                        <p className="text-xs text-slate-500">{inicial.cliente.telefono}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {inicial.vehiculo && (
                <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
                  <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    Vehículo
                  </p>
                  <div className="flex items-center gap-3">
                    {/* Ícono auto */}
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500">
                      <CarIcon className="h-5 w-5" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-black tracking-widest font-mono text-slate-900">
                        {inicial.vehiculo.patente}
                      </p>
                      <p className="text-sm font-medium text-slate-600">
                        {inicial.vehiculo.marca} {inicial.vehiculo.modelo}
                        {inicial.vehiculo.anio && (
                          <span className="text-slate-400"> · {inicial.vehiculo.anio}</span>
                        )}
                      </p>
                      <p className="text-xs text-slate-400">
                        {inicial.vehiculo.kilometraje_actual.toLocaleString("es-AR")} km actuales
                      </p>
                    </div>
                  </div>

                  {/* Link al portal del vehículo */}
                  {inicial.vehiculo.token && (
                    <Link
                      href={`/p/vehiculo/${inicial.vehiculo.token}`}
                      className="mt-3 inline-flex items-center gap-1 text-[11px] font-bold text-slate-600 transition hover:text-slate-900"
                    >
                      Ver historial completo →
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ── ITEMS ── */}
          <div className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 overflow-hidden">
            <div className="px-5 pt-5 pb-3 sm:px-6">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Detalle del trabajo
              </p>
            </div>

            {grupos.length === 0 ? (
              <p className="px-5 pb-5 text-sm italic text-slate-400 sm:px-6">Sin ítems cargados.</p>
            ) : (
              <div>
                {grupos.map((grupo) => (
                  <div key={grupo.tipo}>
                    {/* Header de grupo */}
                    <div className="border-t border-slate-100 bg-slate-50 px-5 py-2 sm:px-6">
                      <span className="text-[10px] font-black uppercase tracking-widest text-amber-700">
                        {grupo.label}
                      </span>
                    </div>

                    {/* Items del grupo */}
                    {grupo.items.map((item, ii) => (
                      <div
                        key={ii}
                        className="flex items-start justify-between gap-3 border-t border-slate-100 px-5 py-3.5 sm:px-6"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-800 leading-snug">
                            {item.descripcion}
                          </p>
                          <p className="mt-0.5 text-xs text-slate-400">
                            {Number(item.cantidad) % 1 === 0
                              ? Number(item.cantidad)
                              : item.cantidad}
                            {" × "}
                            {formatCurrency(item.precio_unitario)}
                          </p>
                        </div>
                        <p className="shrink-0 font-mono text-sm font-black text-slate-900">
                          {formatCurrency(item.subtotal)}
                        </p>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── SIDEBAR (resumen + acciones) ── */}
        <div className="mt-4 space-y-4 lg:sticky lg:top-6 lg:col-span-1 lg:mt-0">

          {/* Totales */}
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
              Resumen
            </p>
            <div className="space-y-2">
              {inicial.total_mano_obra > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Mano de obra</span>
                  <span className="font-semibold text-slate-700">{formatCurrency(inicial.total_mano_obra)}</span>
                </div>
              )}
              {inicial.total_repuestos > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Repuestos e insumos</span>
                  <span className="font-semibold text-slate-700">{formatCurrency(inicial.total_repuestos)}</span>
                </div>
              )}
              {inicial.descuento > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-emerald-600">Descuento</span>
                  <span className="font-semibold text-emerald-600">− {formatCurrency(inicial.descuento)}</span>
                </div>
              )}
            </div>

            {/* Total grande */}
            <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-900 px-4 py-3.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                Total
              </span>
              <span className="font-mono text-xl font-black text-amber-400">
                {formatCurrency(inicial.total)}
              </span>
            </div>
          </div>

          {/* Validez */}
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
            <p className="text-xs font-semibold text-amber-800">
              Este presupuesto tiene una validez de{" "}
              <strong>{inicial.validez_dias ?? 15} días</strong> desde su emisión.
              Los precios pueden variar según disponibilidad de repuestos.
            </p>
          </div>

          {/* Contacto */}
          <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
              ¿Tenés dudas?
            </p>
            {inicial.taller_tel ? (
              <a
                href={`https://wa.me/${inicial.taller_tel.replace(/\D/g, "")}`}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3.5 text-sm font-bold text-white shadow-sm transition active:scale-95 hover:bg-[#1ebe5d]"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Consultar al taller
              </a>
            ) : (
              <p className="text-center text-xs text-slate-400">
                Contactá al taller que te envió este presupuesto.
              </p>
            )}
          </div>

          {/* Acciones — visible en sidebar solo desktop */}
          {puedeDecidirAun && (
            <div className="hidden rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 lg:block">
              <p className="mb-3 text-center text-xs font-semibold text-slate-500">
                ¿Querés aprobar este presupuesto?
              </p>
              {decisionButtons}
            </div>
          )}
        </div>

        {/* Spacer para el sticky bottom bar (solo mobile) */}
        {puedeDecidirAun && <div className="h-28 lg:hidden" />}
      </div>

      {/* ── STICKY BOTTOM BAR — solo mobile, solo si está ENVIADO ── */}
      {puedeDecidirAun && (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-4 py-4 backdrop-blur-md shadow-2xl lg:hidden">
          <div className="mx-auto max-w-lg">
            <p className="mb-3 text-center text-xs font-semibold text-slate-500">
              ¿Querés aprobar este presupuesto?
            </p>
            {decisionButtons}
          </div>
        </div>
      )}
    </>
  );
}
