"use client";

import { Fragment, use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { A4PreviewScaler, suspenderEscalaA4 } from "@/components/a4-preview-scaler";
import { getSession } from "@/lib/trial";
import { getTrabajoById, actualizarEstadoTrabajo, actualizarItemTrabajo, eliminarTrabajo, getPerfilTaller } from "@/lib/api";
import { esperarRecursosDocumento } from "@/lib/document-export";
import { formatCurrency, formatDate, formatDateTime, formatNumber } from "@/lib/format";
import type { TrabajoDetalle } from "@/lib/types";
import { cn } from "@/lib/utils";
import { buildWhatsAppUrl, normalizeWhatsAppPhone } from "@/lib/whatsapp";

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

const TRANSICIONES: Record<string, string[]> = {
  INGRESADO: ["EN_PROCESO", "ANULADO"],
  EN_PROCESO: ["INGRESADO", "FINALIZADO", "ANULADO"],
  FINALIZADO: ["EN_PROCESO", "ENTREGADO", "ANULADO"],
  ENTREGADO: [],
  ANULADO: [],
};

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
function BtnWA({ texto, telefono, variante }: { texto: string; telefono?: string | null; variante: "claro" | "oscuro" }) {
  const base = "flex items-center gap-2 px-4 py-2 text-sm font-bold transition active:scale-95";
  const estilos = variante === "oscuro"
    ? `${base} rounded-lg bg-[#25D366] text-white hover:bg-[#1ebe5d]`
    : `${base} rounded-xl bg-[#25D366] text-white shadow-sm hover:bg-[#1ebe5d]`;
  const telefonoNormalizado = normalizeWhatsAppPhone(telefono);

  if (!telefonoNormalizado) {
    return (
      <span
        className={`${estilos} cursor-not-allowed opacity-50`}
        title="Cargá un celular válido en la ficha del cliente"
        aria-disabled="true"
      >
        {WA_SVG}
        Sin teléfono
      </span>
    );
  }

  return (
    <a
      href={buildWhatsAppUrl(texto, telefonoNormalizado)}
      className={estilos}
      title={`Enviar por WhatsApp a ${telefono}`}
      aria-label={`Enviar por WhatsApp a ${telefono}`}
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
function DocumentoA4({
  t,
  tallerNombre,
  tallerCiudad,
  tallerTel,
  tallerCuit,
  tallerLogoUrl,
}: {
  t: TrabajoDetalle;
  tallerNombre: string;
  tallerCiudad: string;
  tallerTel: string;
  tallerCuit: string;
  tallerLogoUrl?: string | null;
}) {
  const num = `OT-${String(t.id).padStart(5, "0")}`;
  const fecha = formatDate(t.fecha_ingreso);
  const iniciales = tallerNombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join("");
  const documentoCerrado = t.estado === "FINALIZADO" || t.estado === "ENTREGADO";

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
  const cargaVisual =
    t.items.length +
    Math.ceil((t.resumen_trabajos?.length ?? 0) / 180) +
    Math.ceil((t.observaciones_cliente?.length ?? 0) / 220) +
    Math.ceil((t.recomendaciones_proximo_service?.length ?? 0) / 220);
  const documentoCompacto = cargaVisual <= 6;

  const estadoLabel = ESTADOS.find(e => e.value === t.estado)?.label ?? t.estado;
  const labelStyle = {
    fontSize: "8px",
    fontWeight: 800,
    textTransform: "uppercase" as const,
    letterSpacing: "1.4px",
    color: "#94a3b8",
  };

  return (
    <>
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
        data-compact={documentoCompacto ? "true" : "false"}
        className="mx-auto bg-white text-slate-900"
        style={{
          width: "210mm",
          minHeight: documentoCompacto ? "0" : "297mm",
          display: "flex",
          flexDirection: "column",
          fontFamily: "'Inter', system-ui, sans-serif",
        }}
      >
        <div style={{ height: "3px", flexShrink: 0, background: "#f97316" }} />

        <header style={{ padding: "11mm 16mm 7mm" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "24px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
              {tallerLogoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- html-to-image captura el DOM directo, no funciona con next/image
                <img
                  src={tallerLogoUrl}
                  alt={tallerNombre || "Logo del taller"}
                  crossOrigin="anonymous"
                  style={{
                    width: "42px", height: "42px", borderRadius: "9px",
                    border: "1px solid #e2e8f0", background: "#fff",
                    objectFit: "contain", flexShrink: 0,
                  }}
                />
              ) : (
                <div style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "9px",
                  border: "1px solid #e2e8f0",
                  background: "#fff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#ea580c",
                  fontWeight: 900,
                  fontSize: "14px",
                  letterSpacing: "1px",
                  flexShrink: 0,
                }}>
                  {iniciales || "T"}
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "18px", fontWeight: 900, color: "#0f172a", lineHeight: 1.15 }}>
                  {tallerNombre || "Mi Taller"}
                </div>
                <div style={{ marginTop: "4px", display: "flex", flexWrap: "wrap", gap: "3px 8px", fontSize: "10px", color: "#64748b" }}>
                  <span>{tallerCiudad || "Servicio automotor"}</span>
                  {tallerTel && <span>· {tallerTel}</span>}
                  {tallerCuit && <span>· CUIT {tallerCuit}</span>}
                </div>
              </div>
            </div>

            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ ...labelStyle, color: "#f97316" }}>
                {documentoCerrado ? "Comprobante de servicio" : "Orden de trabajo"}
              </div>
              <div style={{ marginTop: "3px", fontFamily: "monospace", fontSize: "23px", fontWeight: 900, color: "#0f172a", letterSpacing: "-1px" }}>
                {num}
              </div>
              <div style={{ marginTop: "6px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
                <span style={{ fontSize: "10px", color: "#64748b" }}>{fecha}</span>
                <span style={{
                  borderRadius: "999px",
                  padding: "3px 7px",
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  color: "#475569",
                  fontSize: "8px",
                  fontWeight: 900,
                  letterSpacing: "1px",
                  textTransform: "uppercase",
                }}>
                  {estadoLabel}
                </span>
              </div>
            </div>
          </div>
        </header>

        <main style={{ flex: 1, padding: "0 16mm" }}>
          <section style={{
            display: "grid",
            gridTemplateColumns: "1.15fr 1fr .72fr",
            borderTop: "1px solid #cbd5e1",
            borderBottom: "1px solid #cbd5e1",
            background: "#fff",
          }}>
            <div style={{ padding: "10px 12px 10px 0" }}>
              <div style={labelStyle}>Cliente</div>
              <div style={{ marginTop: "6px", fontSize: "13px", fontWeight: 850, color: "#0f172a" }}>{t.cliente.nombre_completo}</div>
              <div style={{ marginTop: "4px", fontSize: "9.5px", lineHeight: 1.5, color: "#64748b" }}>
                {[t.cliente.dni && `DNI/CUIT ${t.cliente.dni}`, t.cliente.telefono, t.cliente.email].filter(Boolean).join(" · ") || "Sin datos de contacto"}
              </div>
            </div>
            <div style={{ padding: "10px 12px", borderLeft: "1px solid #e2e8f0" }}>
              <div style={labelStyle}>Vehículo</div>
              <div style={{ marginTop: "5px", display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontFamily: "monospace", fontSize: "11px", fontWeight: 900, letterSpacing: "1.5px", color: "#0f172a" }}>
                  {t.vehiculo.patente}
                </span>
                <span style={{ fontSize: "12px", fontWeight: 800, color: "#1e293b" }}>{t.vehiculo.marca} {t.vehiculo.modelo}</span>
              </div>
              <div style={{ marginTop: "5px", fontSize: "9.5px", color: "#64748b" }}>
                {[t.vehiculo.anio, t.vehiculo.color].filter(Boolean).join(" · ") || "Datos básicos del vehículo"}
              </div>
            </div>
            <div style={{ padding: "10px 0 10px 12px", borderLeft: "1px solid #e2e8f0" }}>
              <div style={labelStyle}>Ingreso</div>
              <div style={{ marginTop: "6px", fontFamily: "monospace", fontSize: "13px", fontWeight: 900, color: "#0f172a" }}>{formatNumber(t.kilometraje)} km</div>
              <div style={{ marginTop: "4px", fontSize: "9.5px", color: "#64748b" }}>
                {t.fecha_egreso_estimado ? `Egreso est. ${formatDate(t.fecha_egreso_estimado)}` : "Sin egreso estimado"}
              </div>
            </div>
          </section>

          {t.resumen_trabajos && (
            <section style={{ marginTop: "9mm", display: "grid", gridTemplateColumns: "128px 1fr", alignItems: "start", gap: "14px" }}>
              <div>
                <div style={{ ...labelStyle, color: "#ea580c" }}>Trabajo realizado</div>
                <div style={{ marginTop: "5px", width: "32px", height: "2px", borderRadius: "2px", background: "#f97316" }} />
              </div>
              <div style={{ fontSize: "12px", fontWeight: 650, lineHeight: 1.5, color: "#334155" }}>{t.resumen_trabajos}</div>
            </section>
          )}

          <section style={{ marginTop: "6mm" }}>
            <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: "11px", overflow: "hidden" }}>
              <thead>
                <tr style={{ background: "#f8fafc" }}>
                  <th style={{ width: "38px", padding: "7px 10px", textAlign: "center", borderTop: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1", color: "#94a3b8", fontSize: "8px", letterSpacing: "1px" }}>#</th>
                  <th style={{ padding: "7px 10px", textAlign: "left", borderTop: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1", color: "#475569", fontSize: "8px", textTransform: "uppercase", letterSpacing: "1.2px" }}>Concepto</th>
                  <th style={{ width: "58px", padding: "7px 10px", textAlign: "center", borderTop: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1", color: "#475569", fontSize: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>Cant.</th>
                  <th style={{ width: "92px", padding: "7px 10px", textAlign: "right", borderTop: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1", color: "#475569", fontSize: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>P. unit.</th>
                  <th style={{ width: "96px", padding: "7px 10px", textAlign: "right", borderTop: "1px solid #cbd5e1", borderBottom: "1px solid #cbd5e1", color: "#475569", fontSize: "8px", textTransform: "uppercase", letterSpacing: "1px" }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map((grupo, groupIndex) => (
                  <Fragment key={grupo.label}>
                    <tr>
                      <td colSpan={5} style={{ padding: "6px 10px 3px", borderTop: groupIndex ? "1px solid #e2e8f0" : "none", background: "#fff", color: "#64748b", fontSize: "8px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "1.3px" }}>
                        {grupo.label}
                      </td>
                    </tr>
                    {grupo.items.map((item, itemIndex) => (
                      <tr key={item.id ?? `${groupIndex}-${itemIndex}`} style={{ background: "#fff" }}>
                        <td style={{ padding: "7px 10px", textAlign: "center", fontFamily: "monospace", fontSize: "9px", color: "#94a3b8" }}>{String(itemIndex + 1).padStart(2, "0")}</td>
                        <td style={{ padding: "7px 10px", borderBottom: "1px solid #f1f5f9", fontWeight: 650, color: "#1e293b" }}>{item.descripcion}</td>
                        <td style={{ padding: "7px 10px", textAlign: "center", fontFamily: "monospace", color: "#475569" }}>{Number(item.cantidad) % 1 === 0 ? Number(item.cantidad) : item.cantidad}</td>
                        <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "monospace", fontSize: "10px", color: "#64748b" }}>{formatCurrency(item.precio_unitario)}</td>
                        <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 800, color: "#0f172a" }}>{formatCurrency(item.subtotal)}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
                {!t.items.length && (
                  <tr>
                    <td colSpan={5} style={{ padding: "18px", textAlign: "center", color: "#94a3b8" }}>Sin conceptos cargados en esta orden.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </section>

          <section style={{ marginTop: "8mm", display: "grid", gridTemplateColumns: "1fr 232px", gap: "18px", alignItems: "start" }}>
            <div style={{ display: "grid", gap: "8px" }}>
              {t.observaciones_cliente && (
                <div style={{ borderTop: "1px solid #cbd5e1", padding: "8px 0" }}>
                  <div style={labelStyle}>Información para el cliente</div>
                  <div style={{ marginTop: "5px", fontSize: "10px", lineHeight: 1.5, color: "#475569" }}>{t.observaciones_cliente}</div>
                </div>
              )}
              {(t.proximo_control_km || t.recomendaciones_proximo_service) && (
                <div style={{ borderTop: "1px solid #cbd5e1", padding: "8px 0" }}>
                  <div style={labelStyle}>Próximo mantenimiento</div>
                  <div style={{ marginTop: "5px", fontSize: "10px", lineHeight: 1.5, color: "#475569" }}>
                    {t.proximo_control_km && <>Service sugerido a los <strong style={{ fontFamily: "monospace", color: "#1e293b" }}>{formatNumber(t.proximo_control_km)} km</strong>.</>}
                    {t.recomendaciones_proximo_service && <span> {t.recomendaciones_proximo_service}</span>}
                  </div>
                </div>
              )}
              {!t.observaciones_cliente && !t.proximo_control_km && !t.recomendaciones_proximo_service && (
                <div style={{ borderRadius: "9px", border: "1px dashed #cbd5e1", padding: "10px 12px", color: "#94a3b8", fontSize: "10px" }}>
                  Sin observaciones adicionales para el cliente.
                </div>
              )}
            </div>

            <div style={{ borderTop: "1px solid #94a3b8" }}>
              <div style={{ padding: "9px 0" }}>
                {t.total_mano_obra > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginBottom: "5px", fontSize: "9.5px", color: "#64748b" }}>
                    <span>Mano de obra</span><strong style={{ fontFamily: "monospace", color: "#334155" }}>{formatCurrency(t.total_mano_obra)}</strong>
                  </div>
                )}
                {t.total_repuestos > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginBottom: "5px", fontSize: "9.5px", color: "#64748b" }}>
                    <span>Repuestos e insumos</span><strong style={{ fontFamily: "monospace", color: "#334155" }}>{formatCurrency(t.total_repuestos)}</strong>
                  </div>
                )}
                {t.descuento > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", fontSize: "9.5px", color: "#059669" }}>
                    <span>Descuento</span><strong style={{ fontFamily: "monospace" }}>− {formatCurrency(t.descuento)}</strong>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", borderTop: "2px solid #0f172a", padding: "10px 0 0" }}>
                <span style={{ color: "#475569", fontSize: "8px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "1.2px" }}>Total</span>
                <strong style={{ color: "#0f172a", fontFamily: "monospace", fontSize: "19px", letterSpacing: "-.7px" }}>{formatCurrency(t.total)}</strong>
              </div>
            </div>
          </section>
        </main>

        <footer style={{ marginTop: documentoCompacto ? "10mm" : "auto", padding: "0 16mm 9mm" }}>
          <div style={{ height: "1px", background: "#cbd5e1" }} />
          <div style={{ marginTop: "10px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "24px" }}>
            <div style={{ maxWidth: "390px", fontSize: "8px", lineHeight: 1.55, color: "#94a3b8" }}>
              Comprobante {num} · Emitido el {fecha}.<br />
              Trabajos sujetos a las condiciones de garantía informadas por el taller.<br />
              Documento de servicio sin valor fiscal.
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: "9px", fontWeight: 900, color: "#334155" }}>
                TallerOS <span style={{ color: "#cbd5e1" }}>·</span> <span style={{ color: "#f97316" }}>FAM Desarrollos</span>
              </div>
              <div style={{ marginTop: "2px", fontSize: "7px", letterSpacing: ".5px", color: "#94a3b8" }}>Tecnología para talleres</div>
            </div>
          </div>
        </footer>
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

function DatoOperativo({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="rounded-xl bg-slate-50 px-3 py-3 dark:bg-slate-900/50">
      <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className={cn("mt-1 truncate text-sm font-bold text-slate-800 dark:text-slate-100", mono && "font-mono tracking-wide")}>{value}</p>
    </div>
  );
}

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
  const [tallerNombre, setTallerNombre] = useState("");
  const [tallerCiudad, setTallerCiudad] = useState("");
  const [tallerTel, setTallerTel] = useState("");
  const [tallerCuit, setTallerCuit] = useState("");
  const [tallerLogoUrl, setTallerLogoUrl] = useState<string | null>(null);
  const [role, setRole] = useState<"ADMIN" | "RECEPCION" | "MECANICO" | "CONTADOR" | null>(null);

  useEffect(() => {
    const session = getSession();
    setRole(session?.rol ?? null);
    if (session?.taller_nombre) setTallerNombre(session.taller_nombre);
    if (session?.taller_ciudad) setTallerCiudad(session.taller_ciudad);
    if (session?.taller_tel) setTallerTel(session.taller_tel);
    if (session?.taller_cuit) setTallerCuit(session.taller_cuit);
    if (session?.taller_logo_url) setTallerLogoUrl(session.taller_logo_url);
  }, []);

  useEffect(() => {
    async function cargar() {
      try {
        setLoading(true);
        const [data, perfil] = await Promise.all([
          getTrabajoById(trabajoId),
          getPerfilTaller().catch(() => null),
        ]);
        setTrabajo(data);
        if (perfil) {
          setTallerNombre(perfil.taller_nombre);
          setTallerCiudad(perfil.taller_ciudad);
          setTallerTel(perfil.taller_tel);
          setTallerCuit(perfil.taller_cuit);
          setTallerLogoUrl(perfil.logo_url ?? null);
        }
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
    } catch (error) {
      setTrabajo({ ...trabajo, estado: backup });
      mostrarNotificacion(error instanceof Error ? error.message : "Error al actualizar el estado", true);
    } finally {
      setCambiandoEstado(false);
    }
  }

  async function handleItem(itemId: number, completado: boolean) {
    if (!trabajo) return;
    const backup = trabajo;
    setTrabajo({
      ...trabajo,
      items: trabajo.items.map((item) =>
        item.id === itemId
          ? { ...item, completado, completado_en: completado ? new Date().toISOString() : null }
          : item
      ),
    });
    try {
      await actualizarItemTrabajo(trabajo.id, itemId, completado);
    } catch (error) {
      setTrabajo(backup);
      mostrarNotificacion(error instanceof Error ? error.message : "No se pudo actualizar la tarea.", true);
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
    // En mobile, A4PreviewScaler achica el documento para que entre en
    // pantalla — pero el PDF tiene que salir siempre a resolución completa,
    // igual que en desktop. Lo neutralizamos acá y lo restauramos al final.
    const restaurarEscala = suspenderEscalaA4();
    try {
      const [{ toJpeg }, { jsPDF }] = await Promise.all([
        import("html-to-image"),
        import("jspdf"),
      ]);

      const el = document.getElementById("doc-ot");
      if (!el) throw new Error("Elemento del documento no encontrado");

      await esperarRecursosDocumento(el);

      const opts = {
        quality: 0.93,
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        skipFonts: true,   // evita fetch de Inter (cuelga con next/font)
        cacheBust: true,
      };

      // La pasada de preparación mejora la captura, pero nunca debe dejar la UI
      // bloqueada si el navegador no termina de resolver una fuente o imagen.
      await Promise.race([
        toJpeg(el, opts).catch(() => null),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3_500)),
      ]);
      const dataUrl = await Promise.race([
        toJpeg(el, opts),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Timeout al generar imagen")), 10_000)
        ),
      ]);

      const img = new Image();
      img.src = dataUrl;
      await new Promise(r => { img.onload = r; });

      const imgH = (img.naturalHeight * 210) / img.naturalWidth;
      const esCompacto = el.dataset.compact === "true" && imgH < 250;
      const altoCompacto = Math.max(135, Math.ceil(imgH));
      const pdf = esCompacto
        ? new jsPDF({
            orientation: altoCompacto < 210 ? "landscape" : "portrait",
            unit: "mm",
            format: [210, altoCompacto],
          })
        : new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

      if (esCompacto || imgH <= 297) {
        pdf.addImage(dataUrl, "JPEG", 0, 0, 210, imgH);
      } else {
        let offset = 0;
        let page = 0;
        while (offset < imgH) {
          if (page > 0) pdf.addPage("a4", "portrait");
          pdf.addImage(dataUrl, "JPEG", 0, -offset, 210, imgH);
          offset += 297;
          page += 1;
        }
      }
      const blob = pdf.output("blob");
      const file = new File([blob], fileName, { type: "application/pdf" });

      // Solo abrir el selector nativo en dispositivos táctiles. Algunos
      // navegadores de escritorio anuncian Web Share pero dejan la promesa
      // esperando una ventana del sistema y el botón queda en "Generando".
      const esDispositivoMovil = navigator.maxTouchPoints > 0 && window.matchMedia("(pointer: coarse)").matches;
      if (esDispositivoMovil && navigator.canShare?.({ files: [file] })) {
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
      restaurarEscala();
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
        <div className="sticky top-0 z-50 flex flex-col gap-3 bg-slate-800 px-4 py-3 shadow-xl print:hidden sm:flex-row sm:items-center sm:gap-3 sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <button
              onClick={() => setModoPreview(false)}
              className="flex items-center gap-2 rounded-lg border border-slate-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-slate-700 sm:px-4"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span className="hidden sm:inline">Salir del preview</span>
              <span className="sm:hidden">Salir</span>
            </button>
            <span className="truncate text-sm font-bold text-slate-300 sm:hidden">
              OT-{String(trabajo.id).padStart(5, "0")}
            </span>
          </div>
          <span className="hidden text-sm font-bold text-slate-300 sm:inline">
            Vista adaptable · OT-{String(trabajo.id).padStart(5, "0")}
          </span>
          <div className="flex items-center gap-2 sm:ml-auto">
            <BtnWA texto={buildWATexto(trabajo, tallerNombre)} telefono={trabajo.cliente.telefono} variante="oscuro" />
            <BtnPDF onClick={descargarPDF} cargando={generandoPDF} variante="oscuro" />
          </div>
        </div>

        {/* Documento centrado */}
        <div className="flex justify-center px-3 py-6 print:p-0 sm:py-10 print:block">
          <A4PreviewScaler>
            <div className="shadow-2xl ring-1 ring-slate-900/10 print:shadow-none print:ring-0">
              <DocumentoA4 t={trabajo} tallerNombre={tallerNombre} tallerCiudad={tallerCiudad} tallerTel={tallerTel} tallerCuit={tallerCuit} tallerLogoUrl={tallerLogoUrl} />
            </div>
          </A4PreviewScaler>
        </div>
      </div>
    );
  }

  // ── VISTA OPERATIVA ──
  const permiteGestion = role === "ADMIN" || role === "RECEPCION";
  const mostrarImportes = permiteGestion;
  const ordenCerrada = trabajo.estado === "ENTREGADO" || trabajo.estado === "ANULADO";
  const tareasCompletadas = trabajo.items.filter((item) => item.completado).length;
  const tareasPendientes = trabajo.items.length - tareasCompletadas;
  const porcentajeTareas = trabajo.items.length ? Math.round((tareasCompletadas / trabajo.items.length) * 100) : 0;
  const cambiosPermitidos = (TRANSICIONES[trabajo.estado] ?? []).filter(
    (estado) => permiteGestion || (estado !== "ENTREGADO" && estado !== "ANULADO"),
  );
  const opcionesEtapa = ESTADOS.filter(
    (estado) => estado.value === trabajo.estado || cambiosPermitidos.includes(estado.value),
  );
  const proximaAccion = trabajo.estado === "INGRESADO"
    ? { estado: "EN_PROCESO", label: "Iniciar trabajo" }
    : trabajo.estado === "EN_PROCESO"
      ? { estado: "FINALIZADO", label: "Marcar como listo" }
      : trabajo.estado === "FINALIZADO" && permiteGestion
        ? { estado: "ENTREGADO", label: "Registrar entrega" }
        : null;
  const proximaAccionBloqueada = Boolean(
    proximaAccion && ["FINALIZADO", "ENTREGADO"].includes(proximaAccion.estado) && tareasPendientes > 0,
  );

  return (
    <AppShell
      compact
      currentPath="/trabajos"
      badge={`OT-${String(trabajo.id).padStart(5, "0")}`}
      title={`${trabajo.vehiculo.patente} · ${trabajo.vehiculo.marca} ${trabajo.vehiculo.modelo}`}
      description={`${trabajo.cliente.nombre_completo} · Ingresó ${formatDateTime(trabajo.fecha_ingreso)}`}
      actions={
        <div className="flex items-center gap-2">
          <Link href="/trabajos" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            ← Órdenes
          </Link>
          <Link href="/trabajos/tablero" className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
            Ver tablero
          </Link>
        </div>
      }
    >
      {notificacion.msg && (
        <div className={cn(
          "fixed bottom-6 right-6 z-[80] max-w-sm rounded-xl px-4 py-3 text-sm font-bold text-white shadow-2xl",
          notificacion.isError ? "bg-red-600" : "bg-emerald-600",
        )}>
          {notificacion.msg}
        </div>
      )}

      {confirmandoBorrado && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-2xl dark:border-slate-700 dark:bg-slate-800">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-red-100 font-black text-red-600 dark:bg-red-900/30 dark:text-red-300">!</div>
            <h2 className="mt-4 text-xl font-black text-slate-900 dark:text-white">¿Eliminar la OT-{trabajo.id}?</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              La orden desaparecerá de la operación, pero los movimientos contables registrados se conservarán.
            </p>
            <div className="mt-7 flex gap-3">
              <button onClick={() => setConfirmandoBorrado(false)} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700">Cancelar</button>
              <button onClick={handleEliminar} className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-700">Eliminar orden</button>
            </div>
          </div>
        </div>
      )}

      <div className="mb-4 grid grid-cols-2 gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-800 lg:grid-cols-4">
        {[
          ["1", "Ingreso", "INGRESADO"],
          ["2", "Ejecución", "EN_PROCESO"],
          ["3", "Control final", "FINALIZADO"],
          ["4", "Cierre", "ENTREGADO"],
        ].map(([numero, label, estado], index) => {
          const etapaActual = ["INGRESADO", "EN_PROCESO", "FINALIZADO", "ENTREGADO"].indexOf(trabajo.estado);
          const activa = trabajo.estado === estado;
          const completa = etapaActual > index && trabajo.estado !== "ANULADO";
          return (
            <div key={estado} className={cn("flex items-center gap-3 rounded-xl px-3 py-2", activa && "bg-brand-50 dark:bg-brand-900/30")}>
              <span className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-black",
                activa ? "bg-brand-600 text-white" : completa ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400 dark:bg-slate-700",
              )}>
                {completa ? "✓" : numero}
              </span>
              <div>
                <p className={cn("text-xs font-black", activa ? "text-brand-600 dark:text-brand-100" : "text-slate-700 dark:text-slate-200")}>{label}</p>
                <p className="text-[9px] text-slate-400">{activa ? "Etapa actual" : completa ? "Completada" : "Pendiente"}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(300px,0.75fr)]">
        <main className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Trabajo solicitado</p>
                <h2 className="mt-2 text-lg font-black leading-snug text-slate-900 dark:text-white">
                  {trabajo.resumen_trabajos || "Sin diagnóstico inicial cargado"}
                </h2>
              </div>
              <span className={cn("rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-wider", BADGE[trabajo.estado])}>
                {ESTADOS.find((estado) => estado.value === trabajo.estado)?.label}
              </span>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <DatoOperativo label="Patente" value={trabajo.vehiculo.patente} mono />
              <DatoOperativo label="Kilometraje" value={`${formatNumber(trabajo.kilometraje)} km`} />
              <DatoOperativo label="Egreso estimado" value={trabajo.fecha_egreso_estimado ? formatDate(trabajo.fecha_egreso_estimado) : "Sin definir"} />
              <DatoOperativo label="Responsable" value={trabajo.responsable_nombre || "Sin asignar"} />
            </div>
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700">
              <div>
                <h2 className="font-black text-slate-900 dark:text-white">Checklist operativo</h2>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Tachá cada tarea cuando quede terminada.</p>
              </div>
              <div className="text-right">
                <p className="font-mono text-sm font-black text-slate-900 dark:text-white">{tareasCompletadas}/{trabajo.items.length}</p>
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400">{porcentajeTareas}% completo</p>
              </div>
            </div>
            <div className="h-1 bg-slate-100 dark:bg-slate-700">
              <div className="h-full bg-emerald-500 transition-all" style={{ width: `${porcentajeTareas}%` }} />
            </div>
            {trabajo.items.length ? (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/80">
                {trabajo.items.map((item) => (
                  <label key={item.id} className={cn(
                    "flex cursor-pointer items-center gap-3 px-5 py-4 transition hover:bg-slate-50 dark:hover:bg-slate-900/30",
                    item.completado && "bg-emerald-50/50 dark:bg-emerald-950/10",
                    ordenCerrada && "cursor-default",
                  )}>
                    <input
                      type="checkbox"
                      checked={item.completado}
                      disabled={ordenCerrada}
                      onChange={(event) => handleItem(item.id, event.target.checked)}
                      className="h-5 w-5 rounded border-slate-300 accent-emerald-600"
                    />
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm font-bold text-slate-800 dark:text-slate-100", item.completado && "text-slate-400 line-through dark:text-slate-500")}>{item.descripcion}</p>
                      <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-400">
                        {item.tipo.replaceAll("_", " ")} · Cantidad {item.cantidad}
                      </p>
                    </div>
                    {mostrarImportes && <p className="shrink-0 font-mono text-sm font-black text-slate-900 dark:text-white">{formatCurrency(item.subtotal)}</p>}
                  </label>
                ))}
              </div>
            ) : (
              <div className="px-5 py-10 text-center">
                <p className="font-bold text-slate-600 dark:text-slate-300">No hay tareas cargadas.</p>
                {permiteGestion && <Link href={`/trabajos/nuevo?id=${trabajo.id}`} className="mt-2 inline-block text-sm font-bold text-brand-600">Editar y agregar tareas →</Link>}
              </div>
            )}
          </section>

          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="border-b border-slate-100 px-5 py-4 dark:border-slate-700">
              <h2 className="font-black text-slate-900 dark:text-white">Expediente del vehículo</h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Datos de referencia y observaciones de esta orden.</p>
            </div>

            <div className="grid lg:grid-cols-2">
              <div className="border-b border-slate-100 p-5 dark:border-slate-700 lg:border-r">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Cliente</p>
                <p className="mt-3 font-black text-slate-900 dark:text-white">{trabajo.cliente.nombre_completo}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {trabajo.cliente.telefono || "Sin teléfono"} · {trabajo.cliente.email || "Sin email"}
                </p>
                <Link href={`/clientes/${trabajo.cliente.id}`} className="mt-3 inline-block text-xs font-black text-brand-600">Abrir perfil →</Link>
              </div>
              <div className="border-b border-slate-100 p-5 dark:border-slate-700">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Vehículo</p>
                <p className="mt-3 font-black text-slate-900 dark:text-white">{trabajo.vehiculo.marca} {trabajo.vehiculo.modelo} {trabajo.vehiculo.anio || ""}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {trabajo.vehiculo.patente} · {trabajo.vehiculo.color || "Color sin registrar"} · Estado {trabajo.estado_general || "sin registrar"}
                </p>
              </div>
            </div>

            <div className="grid lg:grid-cols-2">
              <div className="p-5 lg:border-r lg:border-slate-100 dark:lg:border-slate-700">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Notas internas</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {trabajo.observaciones_internas || "Sin observaciones internas."}
                </p>
                {trabajo.estado_cubiertas_trabajo && <p className="mt-2 text-xs text-slate-400">Cubiertas: {trabajo.estado_cubiertas_trabajo}</p>}
              </div>
              <div className="border-t border-slate-100 p-5 dark:border-slate-700 lg:border-t-0">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Información para el cliente</p>
                <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {trabajo.observaciones_cliente || "Sin observaciones para comunicar."}
                </p>
                {trabajo.proximo_control_km && <p className="mt-2 text-sm font-black text-emerald-600 dark:text-emerald-300">Próximo service: {formatNumber(trabajo.proximo_control_km)} km</p>}
                {trabajo.recomendaciones_proximo_service && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{trabajo.recomendaciones_proximo_service}</p>}
              </div>
            </div>
          </section>
        </main>

        <aside className="xl:sticky xl:top-4">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="p-5">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Control de la orden</p>
              <h2 className="mt-2 text-lg font-black text-slate-900 dark:text-white">
                {ordenCerrada ? "Orden cerrada" : proximaAccion?.label || "Esperando administración"}
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {proximaAccionBloqueada
                  ? `Completá las ${tareasPendientes} tareas pendientes para continuar.`
                  : ordenCerrada
                    ? "El historial queda disponible para consulta."
                    : proximaAccion
                      ? "El cambio queda registrado en el historial del taller."
                      : "Recepción debe confirmar la entrega del vehículo."}
              </p>

              {ordenCerrada && tareasPendientes > 0 && (
                <div className="mt-4 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-800 dark:border-amber-800 dark:bg-amber-900/25 dark:text-amber-200">
                  Orden histórica: se cerró antes de que existiera el checklist digital.
                </div>
              )}

              {proximaAccion && (
                <button
                  onClick={() => handleEstado(proximaAccion.estado)}
                  disabled={cambiandoEstado || proximaAccionBloqueada}
                  className="mt-4 w-full rounded-xl bg-brand-600 px-4 py-3 text-sm font-black text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {proximaAccionBloqueada ? `Faltan ${tareasPendientes} tareas` : `${proximaAccion.label} →`}
                </button>
              )}

              {opcionesEtapa.length > 1 && (
                <div className="mt-3">
                  <label className="text-[9px] font-black uppercase tracking-wider text-slate-400">Cambiar etapa</label>
                  <select
                    value={trabajo.estado}
                    onChange={(event) => handleEstado(event.target.value)}
                    disabled={cambiandoEstado}
                    className={cn("mt-1 w-full cursor-pointer rounded-xl border px-3 py-2.5 text-xs font-bold outline-none", BADGE[trabajo.estado])}
                  >
                    {opcionesEtapa.map((estado) => <option key={estado.value} value={estado.value}>{estado.label}</option>)}
                  </select>
                </div>
              )}
            </div>

            {mostrarImportes && (
              <div className="border-t border-slate-100 p-5 dark:border-slate-700">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Total de la orden</p>
                    <p className="mt-1 font-mono text-2xl font-black text-slate-900 dark:text-white">{formatCurrency(trabajo.total)}</p>
                  </div>
                  {trabajo.total > 0 && trabajo.estado !== "ANULADO" && (
                    <Link href={`/pagos/registrar?cliente=${trabajo.cliente.id}`} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-black text-white hover:bg-emerald-700">Cobrar</Link>
                  )}
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                  <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-900/50">
                    <span className="block text-slate-400">Mano de obra</span>
                    <strong className="mt-1 block font-mono text-slate-700 dark:text-slate-200">{formatCurrency(trabajo.total_mano_obra)}</strong>
                  </div>
                  <div className="rounded-xl bg-slate-50 px-3 py-2.5 dark:bg-slate-900/50">
                    <span className="block text-slate-400">Repuestos</span>
                    <strong className="mt-1 block font-mono text-slate-700 dark:text-slate-200">{formatCurrency(trabajo.total_repuestos)}</strong>
                  </div>
                </div>
              </div>
            )}

            {permiteGestion && (
              <div className="border-t border-slate-100 p-5 dark:border-slate-700">
                <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Compartir y documentar</p>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <BtnWA texto={buildWATexto(trabajo, tallerNombre)} telefono={trabajo.cliente.telefono} variante="claro" />
                  <BtnPDF onClick={descargarPDF} cargando={generandoPDF} variante="claro" />
                  <button onClick={() => setModoPreview(true)} className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700">Vista A4</button>
                  <button onClick={() => compartirPortalVehiculo(trabajo, mostrarNotificacion)} className="flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700 hover:bg-violet-100 dark:border-violet-800/50 dark:bg-violet-900/20 dark:text-violet-300">{LINK_SVG} Portal</button>
                </div>
                <div className="mt-3 flex gap-2">
                  <Link href={`/trabajos/nuevo?id=${trabajo.id}`} className="flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-center text-xs font-bold text-slate-600 hover:border-brand-500 hover:text-brand-600 dark:border-slate-700 dark:text-slate-300">Editar orden</Link>
                  <button onClick={() => setConfirmandoBorrado(true)} className="rounded-xl border border-red-200 px-3 py-2.5 text-xs font-bold text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-300 dark:hover:bg-red-950/20">Eliminar</button>
                </div>
              </div>
            )}
          </section>
        </aside>
      </div>
    </AppShell>
  );

}
