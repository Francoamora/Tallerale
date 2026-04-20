"use client";

import { Fragment, use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { getSession } from "@/lib/trial";
import { getTrabajoById, actualizarEstadoTrabajo, eliminarTrabajo } from "@/lib/api";
import { formatCurrency, formatDate, formatDateTime, formatNumber } from "@/lib/format";
import type { TrabajoDetalle } from "@/lib/types";
import { cn } from "@/lib/utils";

interface PageProps {
  params: Promise<{ id: string }>;
}

const ESTADOS = [
  { value: "INGRESADO",  label: "Ingresado" },
  { value: "EN_PROCESO", label: "En Proceso" },
  { value: "FINALIZADO", label: "Finalizado" },
  { value: "ENTREGADO",  label: "Entregado" },
  { value: "ANULADO",    label: "Anulado" },
];

const BADGE: Record<string, string> = {
  INGRESADO:  "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  EN_PROCESO: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/50",
  FINALIZADO: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50",
  ENTREGADO:  "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800/50",
  ANULADO:    "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50",
};

function buildWATexto(t: TrabajoDetalle, tallerNombre: string): string {
  const num = `OT-${String(t.id).padStart(5, "0")}`;
  const moneda = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
  const lineas: string[] = [
    `*${tallerNombre}*`,
    ``,
    `Hola ${t.cliente.nombre_completo.split(" ")[0]}! Te pasamos el detalle de tu vehiculo:`,
    ``,
    `*${t.vehiculo.marca} ${t.vehiculo.modelo} - ${t.vehiculo.patente}*`,
    `Orden N° ${num}`,
  ];
  if (t.resumen_trabajos) lineas.push(``, `Trabajo realizado: ${t.resumen_trabajos}`);
  lineas.push(``, `*Total: ${moneda.format(t.total)}*`);
  if (t.proximo_control_km) lineas.push(`Proximo service sugerido a los ${t.proximo_control_km.toLocaleString("es-AR")} km`);
  lineas.push(``, `Gracias por elegirnos! Cualquier consulta, escribinos.`);
  return lineas.join("\n");
}

// ─── Íconos ───────────────────────────────────────────────────────────────────
const WA_SVG = (
  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

const PDF_SVG = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
  </svg>
);

// Botón WA → <a> nativo: el navegador NUNCA lo bloquea como popup
function BtnWA({ texto, variante }: { texto: string; variante: "claro" | "oscuro" }) {
  const base = "flex items-center gap-2 px-4 py-2 text-sm font-bold transition active:scale-95";
  const estilos = variante === "oscuro"
    ? `${base} rounded-lg bg-[#25D366] text-white hover:bg-[#1ebe5d]`
    : `${base} rounded-xl bg-[#25D366] text-white shadow-sm hover:bg-[#1ebe5d]`;
  return (
    <a
      href={`https://wa.me/?text=${encodeURIComponent(texto)}`}
      target="_blank"
      rel="noopener noreferrer"
      className={estilos}
    >
      {WA_SVG}
      WhatsApp
    </a>
  );
}

// Botón PDF → descarga independiente (no bloquea ni depende de WA)
function BtnPDF({ onClick, cargando, variante }: { onClick: () => void; cargando: boolean; variante: "claro" | "oscuro" }) {
  const base = "flex items-center gap-2 px-4 py-2 text-sm font-bold transition disabled:opacity-60 active:scale-95";
  const estilos = variante === "oscuro"
    ? `${base} rounded-lg border border-slate-500 text-white hover:bg-slate-700`
    : `${base} rounded-xl border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700`;
  return (
    <button onClick={onClick} disabled={cargando} className={estilos}>
      {cargando
        ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-400 border-t-slate-700 dark:border-slate-600 dark:border-t-white" />
        : PDF_SVG}
      {cargando ? "Generando..." : "PDF"}
    </button>
  );
}

// ─── Documento A4 ────────────────────────────────────────────────────────────
function DocumentoA4({ t, tallerNombre }: { t: TrabajoDetalle; tallerNombre: string }) {
  const num = `OT-${String(t.id).padStart(5, "0")}`;
  const fecha = formatDate(t.fecha_ingreso);
  const iniciales = tallerNombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join("");
  const esFactura = t.estado === "FINALIZADO" || t.estado === "ENTREGADO";

  const manoObra  = t.items.filter(i => i.tipo === "MANO_OBRA");
  const repuestos = t.items.filter(i => i.tipo === "REPUESTO");
  const insumos   = t.items.filter(i => i.tipo === "INSUMO");
  const otros     = t.items.filter(i => i.tipo === "OTRO");

  const grupos = [
    { label: "Mano de Obra", items: manoObra },
    { label: "Repuestos",    items: repuestos },
    { label: "Insumos",      items: insumos },
    { label: "Otros",        items: otros },
  ].filter(g => g.items.length > 0);

  const estadoLabel = ESTADOS.find(e => e.value === t.estado)?.label ?? t.estado;
  const estadoColor =
    t.estado === "FINALIZADO" || t.estado === "ENTREGADO" ? "#059669"
    : t.estado === "ANULADO" ? "#dc2626"
    : t.estado === "EN_PROCESO" ? "#d97706"
    : "#64748b";

  return (
    <>
      {/* Print styles — inyectados inline para no tocar globals */}
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          body * { visibility: hidden !important; }
          #doc-ot, #doc-ot * { visibility: visible !important; }
          #doc-ot {
            position: fixed !important;
            inset: 0 !important;
            width: 210mm !important;
            min-height: 297mm !important;
            margin: 0 auto !important;
            box-shadow: none !important;
            border: none !important;
          }
        }
      `}</style>

      <div
        id="doc-ot"
        className="mx-auto bg-white text-slate-900"
        style={{ width: "210mm", minHeight: "297mm", fontFamily: "'Inter', system-ui, sans-serif" }}
      >
        {/* ── Franja naranja superior ── */}
        <div style={{ height: "6px", background: "linear-gradient(90deg, #f97316 0%, #fb923c 100%)" }} />

        {/* ── CABECERA ── */}
        <div style={{ padding: "16mm 18mm 10mm" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>

            {/* Logo + datos empresa */}
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
                <div style={{
                  width: "42px", height: "42px", borderRadius: "10px",
                  background: "#f97316", display: "flex", alignItems: "center",
                  justifyContent: "center", color: "#fff", fontWeight: 900,
                  fontSize: "14px", letterSpacing: "1px", flexShrink: 0,
                }}>{iniciales}</div>
                <div>
                  <div style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a", lineHeight: 1.2 }}>
                    {tallerNombre}
                  </div>
                  <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 500, marginTop: "1px" }}>
                    Taller Mecánico
                  </div>
                </div>
              </div>
            </div>

            {/* Tipo + número */}
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "2px", color: "#94a3b8" }}>
                {esFactura ? "Comprobante de Servicio" : "Orden de Trabajo"}
              </div>
              <div style={{ fontSize: "26px", fontWeight: 900, color: "#0f172a", letterSpacing: "-0.5px", lineHeight: 1, marginTop: "2px" }}>
                {esFactura ? "FACTURA" : "ORDEN DE TRABAJO"}
              </div>
              <div style={{ fontSize: "18px", fontWeight: 700, color: "#f97316", marginTop: "4px", fontFamily: "monospace" }}>
                {num}
              </div>
              <div style={{ display: "flex", gap: "16px", marginTop: "8px", justifyContent: "flex-end" }}>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#94a3b8" }}>Fecha Ingreso</div>
                  <div style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>{fecha}</div>
                </div>
                {t.fecha_egreso_estimado && (
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#94a3b8" }}>Egreso Est.</div>
                    <div style={{ fontSize: "12px", fontWeight: 600, color: "#334155" }}>{formatDate(t.fecha_egreso_estimado)}</div>
                  </div>
                )}
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#94a3b8" }}>Estado</div>
                  <div style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.5px", color: estadoColor }}>
                    {estadoLabel}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Línea divisora */}
          <div style={{ height: "2px", background: "linear-gradient(90deg, #f97316 0%, #e2e8f0 60%)", marginTop: "14px", borderRadius: "2px" }} />
        </div>

        {/* ── CLIENTE + VEHÍCULO ── */}
        <div style={{ padding: "0 18mm 12mm", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>

          {/* Cliente */}
          <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "14px 16px", borderLeft: "3px solid #f97316" }}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.5px", color: "#94a3b8", marginBottom: "10px" }}>
              Cliente
            </div>
            <div style={{ fontSize: "15px", fontWeight: 800, color: "#0f172a", lineHeight: 1.2, marginBottom: "6px" }}>
              {t.cliente.nombre_completo}
            </div>
            {t.cliente.dni && (
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "3px" }}>
                <span style={{ fontWeight: 600 }}>DNI/CUIT:</span> {t.cliente.dni}
              </div>
            )}
            {t.cliente.telefono && (
              <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "3px" }}>
                <span style={{ fontWeight: 600 }}>Tel:</span> {t.cliente.telefono}
              </div>
            )}
            {t.cliente.email && (
              <div style={{ fontSize: "11px", color: "#64748b" }}>{t.cliente.email}</div>
            )}
          </div>

          {/* Vehículo */}
          <div style={{ background: "#f8fafc", borderRadius: "10px", padding: "14px 16px", borderLeft: "3px solid #e2e8f0" }}>
            <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.5px", color: "#94a3b8", marginBottom: "10px" }}>
              Vehículo
            </div>
            <div style={{
              display: "inline-block", background: "#0f172a", color: "#fff",
              fontFamily: "monospace", fontWeight: 800, fontSize: "14px",
              letterSpacing: "3px", padding: "3px 10px", borderRadius: "6px", marginBottom: "8px",
            }}>
              {t.vehiculo.patente}
            </div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "#0f172a", marginBottom: "4px" }}>
              {t.vehiculo.marca} {t.vehiculo.modelo}
              {t.vehiculo.anio && <span style={{ fontWeight: 400, color: "#94a3b8", fontSize: "12px" }}> · {t.vehiculo.anio}</span>}
            </div>
            <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "3px" }}>
              <span style={{ fontWeight: 600 }}>Km ingreso:</span>{" "}
              <span style={{ fontFamily: "monospace" }}>{formatNumber(t.kilometraje)}</span>
            </div>
            {t.vehiculo.color && (
              <div style={{ fontSize: "11px", color: "#64748b" }}>
                <span style={{ fontWeight: 600 }}>Color:</span> {t.vehiculo.color}
              </div>
            )}
          </div>
        </div>

        {/* ── DIAGNÓSTICO ── */}
        {t.resumen_trabajos && (
          <div style={{ padding: "0 18mm 10mm" }}>
            <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: "8px", padding: "10px 14px" }}>
              <span style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", color: "#92400e" }}>Trabajo realizado: </span>
              <span style={{ fontSize: "12px", color: "#78350f", fontWeight: 500 }}>{t.resumen_trabajos}</span>
            </div>
          </div>
        )}

        {/* ── TABLA DE ITEMS ── */}
        <div style={{ padding: "0 18mm 8mm" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
            <thead>
              <tr style={{ background: "#0f172a" }}>
                <th style={{ padding: "9px 12px", textAlign: "left", color: "#fff", fontWeight: 700, fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", width: "36px" }}>#</th>
                <th style={{ padding: "9px 12px", textAlign: "left", color: "#fff", fontWeight: 700, fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px" }}>Descripción</th>
                <th style={{ padding: "9px 12px", textAlign: "center", color: "#f97316", fontWeight: 700, fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", width: "70px" }}>Cant.</th>
                <th style={{ padding: "9px 12px", textAlign: "right", color: "#94a3b8", fontWeight: 700, fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", width: "100px" }}>P. Unit.</th>
                <th style={{ padding: "9px 12px", textAlign: "right", color: "#fff", fontWeight: 700, fontSize: "10px", textTransform: "uppercase", letterSpacing: "1px", width: "100px" }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((grupo, gi) => (
                <Fragment key={`grupo-${gi}`}>
                  <tr>
                    <td colSpan={5} style={{ padding: "8px 12px 4px", fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1.5px", color: "#f97316", background: "#fff7ed", borderTop: gi > 0 ? "1px solid #e2e8f0" : "none" }}>
                      {grupo.label}
                    </td>
                  </tr>
                  {grupo.items.map((item, ii) => (
                    <tr key={item.id ?? `${gi}-${ii}`} style={{ background: ii % 2 === 0 ? "#f8fafc" : "#fff" }}>
                      <td style={{ padding: "8px 12px", color: "#94a3b8", fontFamily: "monospace", fontSize: "11px", textAlign: "center" }}>
                        {String(ii + 1).padStart(2, "0")}
                      </td>
                      <td style={{ padding: "8px 12px", color: "#1e293b", fontWeight: 500 }}>{item.descripcion}</td>
                      <td style={{ padding: "8px 12px", textAlign: "center", color: "#334155", fontFamily: "monospace", fontWeight: 600 }}>
                        {Number(item.cantidad) % 1 === 0 ? Number(item.cantidad) : item.cantidad}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: "#64748b", fontFamily: "monospace", fontSize: "11px" }}>
                        {formatCurrency(item.precio_unitario)}
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "right", color: "#0f172a", fontFamily: "monospace", fontWeight: 700 }}>
                        {formatCurrency(item.subtotal)}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              {t.items.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: "24px", textAlign: "center", color: "#94a3b8", fontStyle: "italic" }}>
                    Sin ítems cargados en esta orden.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── TOTALES ── */}
        <div style={{ padding: "0 18mm 10mm", display: "flex", justifyContent: "flex-end" }}>
          <div style={{ width: "240px" }}>
            <div style={{ height: "1px", background: "#e2e8f0", marginBottom: "12px" }} />
            {t.total_mano_obra > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "11px", color: "#64748b" }}>Mano de Obra</span>
                <span style={{ fontSize: "11px", fontFamily: "monospace", fontWeight: 600, color: "#334155" }}>{formatCurrency(t.total_mano_obra)}</span>
              </div>
            )}
            {t.total_repuestos > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "11px", color: "#64748b" }}>Repuestos e Insumos</span>
                <span style={{ fontSize: "11px", fontFamily: "monospace", fontWeight: 600, color: "#334155" }}>{formatCurrency(t.total_repuestos)}</span>
              </div>
            )}
            {t.descuento > 0 && (
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                <span style={{ fontSize: "11px", color: "#059669" }}>Descuento</span>
                <span style={{ fontSize: "11px", fontFamily: "monospace", fontWeight: 600, color: "#059669" }}>− {formatCurrency(t.descuento)}</span>
              </div>
            )}
            <div style={{
              marginTop: "10px", background: "#0f172a", borderRadius: "10px",
              padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center",
            }}>
              <span style={{ fontSize: "11px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", color: "#94a3b8" }}>Total</span>
              <span style={{ fontSize: "22px", fontWeight: 900, fontFamily: "monospace", color: "#f97316", letterSpacing: "-0.5px" }}>
                {formatCurrency(t.total)}
              </span>
            </div>
          </div>
        </div>

        {/* ── OBSERVACIONES + PRÓXIMO SERVICE ── */}
        {(t.observaciones_cliente || t.recomendaciones_proximo_service || t.proximo_control_km) && (
          <div style={{ padding: "0 18mm 10mm", display: "grid", gridTemplateColumns: t.observaciones_cliente && (t.recomendaciones_proximo_service || t.proximo_control_km) ? "1fr 1fr" : "1fr", gap: "10px" }}>
            {t.observaciones_cliente && (
              <div style={{ background: "#f0f9ff", borderRadius: "8px", padding: "10px 14px", borderLeft: "3px solid #0ea5e9" }}>
                <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", color: "#0369a1", marginBottom: "6px" }}>
                  Observaciones para el Cliente
                </div>
                <div style={{ fontSize: "11px", color: "#0c4a6e", lineHeight: 1.5 }}>{t.observaciones_cliente}</div>
              </div>
            )}
            {(t.recomendaciones_proximo_service || t.proximo_control_km) && (
              <div style={{ background: "#f0fdf4", borderRadius: "8px", padding: "10px 14px", borderLeft: "3px solid #22c55e" }}>
                <div style={{ fontSize: "9px", fontWeight: 800, textTransform: "uppercase", letterSpacing: "1px", color: "#15803d", marginBottom: "6px" }}>
                  Próximo Mantenimiento
                </div>
                {t.proximo_control_km && (
                  <div style={{ fontSize: "12px", fontWeight: 700, color: "#14532d", marginBottom: "4px" }}>
                    Service sugerido a los <span style={{ fontFamily: "monospace", color: "#16a34a" }}>{formatNumber(t.proximo_control_km)} km</span>
                  </div>
                )}
                {t.recomendaciones_proximo_service && (
                  <div style={{ fontSize: "11px", color: "#166534", lineHeight: 1.5 }}>{t.recomendaciones_proximo_service}</div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── PIE ── */}
        <div style={{ padding: "0 18mm 14mm", marginTop: "auto" }}>
          {/* Separador con degradé */}
          <div style={{ height: "2px", background: "linear-gradient(90deg, #f97316 0%, #e2e8f0 60%)", marginBottom: "14px", borderRadius: "2px" }} />

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: "9px", color: "#94a3b8", lineHeight: 1.7, maxWidth: "260px" }}>
              Orden {num} · Emitida el {fecha}.<br />
              Trabajos respaldados por garantía de taller.<br />
              Este documento no tiene valor fiscal.
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "13px", fontWeight: 900, color: "#f97316", letterSpacing: "-0.3px" }}>{tallerNombre}</div>
              <div style={{ fontSize: "9px", color: "#94a3b8", marginTop: "2px" }}>Taller Mecánico</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ─── Compartir portal del vehículo ────────────────────────────────────────────
async function compartirPortalVehiculo(t: TrabajoDetalle, mostrarNotif: (m: string, e?: boolean) => void) {
  if (!t.vehiculo.token) {
    mostrarNotif("Este vehículo todavía no tiene portal público disponible.", true);
    return;
  }
  const slug  = t.vehiculo.token;
  const url   = `${window.location.origin}/p/vehiculo/${slug}`;
  const num   = `OT-${String(t.id).padStart(5, "0")}`;
  const texto = `Hola ${t.cliente.nombre_completo.split(" ")[0]}! Te mando el portal de tu ${t.vehiculo.marca} ${t.vehiculo.modelo} (${t.vehiculo.patente}) 🚗\n\n${url}\n\nAhí podés ver el historial de servicios completo. Cualquier consulta, escribinos!`;

  if (navigator.share) {
    try {
      await navigator.share({ title: `Portal · ${t.vehiculo.patente}`, text: texto, url });
      return;
    } catch (e: unknown) {
      if (e instanceof Error && e.name === "AbortError") return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    mostrarNotif("🔗 Link del portal copiado al portapapeles!");
  } catch {
    mostrarNotif("No se pudo copiar el link", true);
  }
}

const LINK_SVG = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);

// ─── Página principal ─────────────────────────────────────────────────────────
export default function DetalleTrabajo({ params }: PageProps) {
  const { id } = use(params);
  const trabajoId = Number(id);
  const router = useRouter();

  const [trabajo, setTrabajo] = useState<TrabajoDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notificacion, setNotificacion] = useState({ msg: "", isError: false });
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [modoPreview, setModoPreview] = useState(false);
  const [generandoPDF, setGenerandoPDF] = useState(false);
  const [tallerNombre, setTallerNombre] = useState("Taller Mecánico");

  useEffect(() => {
    const session = getSession();
    if (session?.taller_nombre) setTallerNombre(session.taller_nombre);
  }, []);

  useEffect(() => {
    async function cargar() {
      try {
        setLoading(true);
        const data = await getTrabajoById(trabajoId);
        setTrabajo(data);
      } catch {
        setError("No se pudo cargar la orden de trabajo.");
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, [trabajoId]);

  async function handleEstado(nuevoEstado: string) {
    if (!trabajo) return;
    const backup = trabajo.estado;
    setTrabajo({ ...trabajo, estado: nuevoEstado });
    setCambiandoEstado(true);
    try {
      await actualizarEstadoTrabajo(trabajoId, nuevoEstado);
      mostrarNotificacion(`Estado → "${ESTADOS.find(e => e.value === nuevoEstado)?.label}"`);
    } catch {
      setTrabajo({ ...trabajo, estado: backup });
      mostrarNotificacion("Error al actualizar el estado", true);
    } finally {
      setCambiandoEstado(false);
    }
  }

  async function handleEliminar() {
    try {
      await eliminarTrabajo(trabajoId);
      router.push("/trabajos");
    } catch {
      mostrarNotificacion("Error al eliminar la orden", true);
      setConfirmandoBorrado(false);
    }
  }

  function mostrarNotificacion(msg: string, isError = false) {
    setNotificacion({ msg, isError });
    setTimeout(() => setNotificacion({ msg: "", isError: false }), 3000);
  }

  async function descargarPDF() {
    if (!trabajo) return;
    setGenerandoPDF(true);
    const fileName = `OT-${String(trabajo.id).padStart(5, "0")}.pdf`;
    try {
      const [{ toJpeg }, { jsPDF }] = await Promise.all([
        import("html-to-image"),
        import("jspdf"),
      ]);

      const el = document.getElementById("doc-ot");
      if (!el) throw new Error("Elemento del documento no encontrado");

      await new Promise(r => setTimeout(r, 150));

      const opts = {
        quality: 0.93,
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        skipFonts: true,   // evita fetch de Inter (cuelga con next/font)
        cacheBust: true,
      };

      // Workaround html-to-image: llamar dos veces, la segunda queda perfecta
      await toJpeg(el, opts).catch(() => null);
      const dataUrl = await Promise.race([
        toJpeg(el, opts),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout al generar imagen")), 10_000)
        ),
      ]);

      const img = new Image();
      img.src = dataUrl;
      await new Promise(r => { img.onload = r; });

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
      const imgH = (img.naturalHeight * 210) / img.naturalWidth;
      pdf.addImage(dataUrl, "JPEG", 0, 0, 210, imgH);
      const blob = pdf.output("blob");
      const file = new File([blob], fileName, { type: "application/pdf" });

      // Móvil con Web Share API: abre el selector nativo (WA, Mail, Drive…)
      if (navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: buildWATexto(trabajo, tallerNombre), title: fileName });
          return;
        } catch (e: unknown) {
          if (e instanceof Error && e.name === "AbortError") return;
        }
      }

      // Desktop: descarga directa
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      mostrarNotificacion("PDF descargado! Ahora adjuntalo en WhatsApp.");
    } catch (e: unknown) {
      console.error("[PDF]", e);
      mostrarNotificacion("No se pudo generar el PDF. Usá el botón WhatsApp para enviar el resumen.", true);
    } finally {
      setGenerandoPDF(false);
    }
  }

  // ── Loading ──
  if (loading) {
    return (
      <AppShell currentPath="/trabajos" title="Cargando expediente..." description="Recuperando orden de trabajo...">
        <div className="flex h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
        </div>
      </AppShell>
    );
  }

  // ── Error ──
  if (error || !trabajo) {
    return (
      <AppShell currentPath="/trabajos" title="No encontrado" description="Error de consulta">
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900/50 dark:bg-red-950/20">
          <p className="font-bold text-red-800 dark:text-red-400">{error || "La orden no existe o fue eliminada."}</p>
          <Link href="/trabajos" className="mt-4 inline-block text-sm font-bold underline text-red-700 dark:text-red-400">
            ← Volver al listado
          </Link>
        </div>
      </AppShell>
    );
  }

  // ── MODO PREVIEW A4 ──
  if (modoPreview) {
    return (
      <div className="min-h-screen bg-slate-400 dark:bg-slate-700">
        {/* Barra de preview */}
        <div className="sticky top-0 z-50 flex items-center gap-3 bg-slate-800 px-6 py-3 shadow-xl print:hidden">
          <button
            onClick={() => setModoPreview(false)}
            className="flex items-center gap-2 rounded-lg border border-slate-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-700"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            Salir del preview
          </button>
          <span className="text-sm font-bold text-slate-300">
            Vista previa A4 · OT-{String(trabajo.id).padStart(5, "0")}
          </span>
          <div className="ml-auto flex items-center gap-2">
            <BtnWA texto={buildWATexto(trabajo, tallerNombre)} variante="oscuro" />
            <BtnPDF onClick={descargarPDF} cargando={generandoPDF} variante="oscuro" />
          </div>
        </div>

        {/* Documento centrado */}
        <div className="flex justify-center py-10 print:py-0 print:block">
          <div className="shadow-2xl ring-1 ring-slate-900/10 print:shadow-none print:ring-0">
            <DocumentoA4 t={trabajo} tallerNombre={tallerNombre} />
          </div>
        </div>
      </div>
    );
  }

  // ── VISTA NORMAL ──
  return (
    <AppShell
      currentPath="/trabajos"
      badge={`OT-${String(trabajo.id).padStart(5, "0")}`}
      title={trabajo.resumen_trabajos?.slice(0, 60) || `Orden de Trabajo #${trabajo.id}`}
      description={`${trabajo.cliente.nombre_completo} · ${trabajo.vehiculo.patente} · ${formatDateTime(trabajo.fecha_ingreso)}`}
    >
      {/* TOAST */}
      {notificacion.msg && (
        <div className={cn("fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-5 fade-in rounded-lg px-5 py-3 text-sm font-bold text-white shadow-2xl sm:bottom-6 sm:left-auto sm:right-6 sm:w-auto", notificacion.isError ? "bg-red-600" : "bg-slate-900 dark:bg-brand-600")}>
          {notificacion.msg}
        </div>
      )}

      {/* MODAL BORRADO */}
      {confirmandoBorrado && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl animate-in zoom-in-95 dark:bg-slate-800">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">¿Eliminar OT #{trabajo.id}?</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Esta orden irá a la papelera. El historial del cliente y movimientos de caja no se ven afectados.
            </p>
            <div className="mt-8 flex gap-3">
              <button onClick={() => setConfirmandoBorrado(false)} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700">
                Cancelar
              </button>
              <button onClick={handleEliminar} className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-700">
                Sí, eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">

        {/* ── BARRA DE ACCIONES ── */}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <Link
            href="/trabajos"
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 transition"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
          </Link>

          {/* Estado inline editable */}
          <select
            value={trabajo.estado}
            onChange={e => handleEstado(e.target.value)}
            disabled={cambiandoEstado}
            className={cn("cursor-pointer appearance-none rounded-xl border px-4 py-2 text-xs font-bold uppercase tracking-wider outline-none transition focus:ring-2 focus:ring-brand-500/50 disabled:opacity-50", BADGE[trabajo.estado])}
          >
            {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>

          <div className="ml-auto flex flex-wrap items-center gap-2">

            <BtnWA texto={buildWATexto(trabajo, tallerNombre)} variante="claro" />
            <BtnPDF onClick={descargarPDF} cargando={generandoPDF} variante="claro" />

            {/* 👁 PREVIEW A4 */}
            <button
              onClick={() => setModoPreview(true)}
              title="Vista previa A4 / Imprimir"
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-slate-400 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              <span className="hidden sm:inline">Ver A4</span>
            </button>

            {/* 🔗 Portal del Vehículo — siempre visible */}
            <button
              onClick={() => compartirPortalVehiculo(trabajo!, mostrarNotificacion)}
              title="Compartir portal del vehículo al cliente"
              className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700 transition hover:bg-violet-100 dark:border-violet-800/50 dark:bg-violet-900/20 dark:text-violet-400"
            >
              {LINK_SVG}
              <span className="hidden sm:inline">Portal</span>
            </button>

            {/* Editar */}
            <Link
              href={`/trabajos/nuevo?id=${trabajo.id}`}
              className="flex items-center gap-2 rounded-xl border border-brand-200 bg-brand-50 px-3 py-2 text-sm font-bold text-brand-700 transition hover:bg-brand-100 dark:border-brand-800/50 dark:bg-brand-900/20 dark:text-brand-400"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
              <span className="hidden sm:inline">Editar</span>
            </Link>

            {/* Cobrar */}
            {trabajo.total > 0 && trabajo.estado !== "ANULADO" && (
              <Link
                href={`/pagos/registrar?cliente=${trabajo.cliente.id}`}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="hidden sm:inline">Cobrar</span>
              </Link>
            )}

            {/* Eliminar */}
            <button
              onClick={() => setConfirmandoBorrado(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition hover:border-red-400 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── DOCUMENTO INLINE ── */}
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-slate-400 sm:hidden">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
            Deslizá para ver el documento completo
          </p>
          <div className="overflow-auto rounded-2xl border border-slate-200 bg-slate-100 p-3 sm:p-6 dark:border-slate-700 dark:bg-slate-900/50">
            <div className="mx-auto shadow-xl ring-1 ring-slate-900/10 dark:ring-slate-700">
              <DocumentoA4 t={trabajo} tallerNombre={tallerNombre} />
            </div>
          </div>
        </div>

        {/* ── ACCIONES SECUNDARIAS ── */}
        <div className="flex flex-wrap justify-center gap-3">
          <Link
            href={`/clientes/${trabajo.cliente.id}`}
            className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            Ver perfil de {trabajo.cliente.nombre_completo}
          </Link>
          <Link
            href={`/presupuestos/nuevo?cliente=${trabajo.cliente.id}`}
            className="rounded-xl border border-sky-200 bg-sky-50 px-5 py-2.5 text-sm font-semibold text-sky-700 transition hover:bg-sky-100 dark:border-sky-800/50 dark:bg-sky-900/20 dark:text-sky-400"
          >
            + Nuevo Presupuesto
          </Link>
          <Link
            href="/trabajos/nuevo"
            className="rounded-xl border border-brand-200 bg-brand-50 px-5 py-2.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-100 dark:border-brand-800/50 dark:bg-brand-900/20 dark:text-brand-400"
          >
            + Nueva OT
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
