"use client";

import { Fragment, use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { A4PreviewScaler, suspenderEscalaA4 } from "@/components/a4-preview-scaler";
import { getPresupuestoById, actualizarEstadoPresupuesto, eliminarPresupuesto, getPerfilTaller } from "@/lib/api";
import { esperarRecursosDocumento } from "@/lib/document-export";
import { formatCurrency, formatDate } from "@/lib/format";
import type { PresupuestoDetalle } from "@/lib/types";
import { cn } from "@/lib/utils";
import { getSession } from "@/lib/trial";
import { buildWhatsAppUrl, normalizeWhatsAppPhone } from "@/lib/whatsapp";

interface PageProps {
  params: Promise<{ id: string }>;
}

const ESTADOS = [
  { value: "BORRADOR",  label: "Borrador" },
  { value: "ENVIADO",   label: "Enviado al Cliente" },
  { value: "APROBADO",  label: "Aprobado" },
  { value: "RECHAZADO", label: "Rechazado" },
];

const BADGE: Record<string, string> = {
  BORRADOR:  "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700",
  ENVIADO:   "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-900/30 dark:text-sky-400 dark:border-sky-800/50",
  APROBADO:  "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/50",
  RECHAZADO: "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50",
};

function buildWATexto(p: PresupuestoDetalle, tallerNombre: string, portalUrl?: string): string {
  const num = `P-${String(p.id).padStart(4, "0")}`;
  const nombre = p.cliente?.nombre_completo?.split(" ")[0] ?? "cliente";
  const moneda = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
  const vehiculoDesc = p.vehiculo
    ? `${p.vehiculo.marca} ${p.vehiculo.modelo} - ${p.vehiculo.patente}`
    : "vehiculo sin registrar";

  const lineas: string[] = [
    `*${tallerNombre}*`,
    ``,
    `Hola ${nombre}! Te enviamos tu presupuesto:`,
    ``,
    `*${vehiculoDesc}*`,
    `Presupuesto N° ${num}`,
  ];
  if (p.resumen_corto) lineas.push(``, `Trabajo: ${p.resumen_corto}`);
  lineas.push(
    ``,
    `*Total: ${moneda.format(p.total)}*`,
  );
  if (portalUrl) lineas.push(``, `Ver y responder presupuesto:`, portalUrl);
  lineas.push(``, `Valido por 15 dias. Cualquier consulta, escribinos!`);
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
function DocumentoA4({ p, tallerNombre, tallerCiudad, tallerCuit, tallerLogoUrl }: { p: PresupuestoDetalle; tallerNombre: string; tallerCiudad: string; tallerCuit: string; tallerLogoUrl?: string | null }) {
  const num = `P-${String(p.id).padStart(4, "0")}`;
  const fecha = formatDate(p.fecha_creacion);
  const iniciales = tallerNombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map(w => w[0].toUpperCase())
    .join("")
    .slice(0, 2);

  const manoObra  = p.items.filter(i => i.tipo === "MANO_OBRA");
  const repuestos = p.items.filter(i => i.tipo === "REPUESTO");
  const insumos   = p.items.filter(i => i.tipo === "INSUMO");
  const otros     = p.items.filter(i => i.tipo === "OTRO");

  const grupos = [
    { label: "Mano de obra", items: manoObra },
    { label: "Repuestos", items: repuestos },
    { label: "Insumos", items: insumos },
    { label: "Otros", items: otros },
  ].filter(g => g.items.length > 0);

  const estadoLabel = ESTADOS.find(e => e.value === p.estado)?.label ?? p.estado;
  const cargaVisual = p.items.length + Math.ceil((p.resumen_corto?.length ?? 0) / 180);
  const documentoCompacto = cargaVisual <= 7;
  const labelStyle = {
    fontSize: "8px",
    fontWeight: 800,
    textTransform: "uppercase" as const,
    letterSpacing: "1.35px",
    color: "#94a3b8",
  };

  return (
    <>
      <style>{`
        @media print {
          @page { size: A4; margin: 0; }
          body * { visibility: hidden !important; }
          #doc-a4, #doc-a4 * { visibility: visible !important; }
          #doc-a4 {
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
        id="doc-a4"
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
        <div style={{ height: "4px", flexShrink: 0, background: "#efd38f" }} />

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
                    border: "1px solid #dbe2ea", background: "#fff",
                    objectFit: "contain", flexShrink: 0,
                  }}
                />
              ) : (
                <div style={{
                  width: "42px", height: "42px", borderRadius: "9px",
                  border: "1px solid #dbe2ea", background: "#fff",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  color: "#92400e", fontWeight: 900, fontSize: "14px",
                  letterSpacing: "1px", flexShrink: 0,
                }}>
                  {iniciales || "T"}
                </div>
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "18px", fontWeight: 900, color: "#0f172a", lineHeight: 1.15 }}>
                  {tallerNombre || "Mi Taller"}
                </div>
                <div style={{ marginTop: "4px", fontSize: "10px", color: "#64748b" }}>
                  {tallerCiudad || "Servicio automotor"}
                  {tallerCuit && ` · CUIT ${tallerCuit}`}
                </div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ ...labelStyle, color: "#a16207" }}>Cotización de servicio</div>
              <div style={{ marginTop: "3px", fontSize: "24px", fontWeight: 900, color: "#0f172a", letterSpacing: "-0.7px", lineHeight: 1 }}>
                PRESUPUESTO
              </div>
              <div style={{ marginTop: "4px", fontSize: "17px", fontWeight: 800, color: "#92400e", fontFamily: "monospace" }}>
                {num}
              </div>
              <div style={{ marginTop: "6px", display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "8px" }}>
                <span style={{ fontSize: "10px", color: "#64748b" }}>{fecha}</span>
                <span style={{
                  borderRadius: "999px", padding: "3px 7px",
                  border: "1px solid #cbd5e1", color: "#475569",
                  fontSize: "8px", fontWeight: 900, letterSpacing: "1px",
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
            display: "grid", gridTemplateColumns: "1.15fr 1fr .72fr",
            borderTop: "1px solid #d5b968", borderBottom: "1px solid #d5b968",
          }}>
            <div style={{ padding: "10px 12px 10px 0" }}>
              <div style={labelStyle}>Cliente</div>
              <div style={{ marginTop: "6px", fontSize: "13px", fontWeight: 850, color: "#0f172a" }}>
                {p.cliente?.nombre_completo || "Sin cliente registrado"}
              </div>
              <div style={{ marginTop: "4px", fontSize: "9.5px", lineHeight: 1.5, color: "#64748b" }}>
                {p.cliente
                  ? [p.cliente.dni && `DNI/CUIT ${p.cliente.dni}`, p.cliente.telefono, p.cliente.email].filter(Boolean).join(" · ") || "Sin datos de contacto"
                  : "Sin datos de contacto"}
              </div>
            </div>
            <div style={{ padding: "10px 12px", borderLeft: "1px solid #e2e8f0" }}>
              <div style={labelStyle}>Vehículo</div>
              <div style={{ marginTop: "6px", fontSize: "12px", fontWeight: 800, color: "#1e293b" }}>
                {p.vehiculo ? `${p.vehiculo.patente} · ${p.vehiculo.marca} ${p.vehiculo.modelo}` : "Sin vehículo registrado"}
              </div>
              <div style={{ marginTop: "4px", fontSize: "9.5px", color: "#64748b" }}>
                {p.vehiculo ? [p.vehiculo.anio, p.vehiculo.color].filter(Boolean).join(" · ") || "Datos básicos del vehículo" : "Sin datos adicionales"}
              </div>
            </div>
            <div style={{ padding: "10px 0 10px 12px", borderLeft: "1px solid #e2e8f0" }}>
              <div style={labelStyle}>Kilometraje</div>
              <div style={{ marginTop: "6px", fontFamily: "monospace", fontSize: "13px", fontWeight: 900, color: "#0f172a" }}>
                {p.vehiculo ? `${p.vehiculo.kilometraje_actual.toLocaleString("es-AR")} km` : "—"}
              </div>
              <div style={{ marginTop: "4px", fontSize: "9.5px", color: "#64748b" }}>Validez: 15 días</div>
            </div>
          </section>

          {p.resumen_corto && (
            <section style={{ marginTop: "9mm", display: "grid", gridTemplateColumns: "128px 1fr", gap: "14px" }}>
              <div>
                <div style={{ ...labelStyle, color: "#a16207" }}>Trabajo cotizado</div>
                <div style={{ marginTop: "5px", width: "32px", height: "2px", background: "#d5b968" }} />
              </div>
              <div style={{ fontSize: "12px", fontWeight: 650, lineHeight: 1.5, color: "#334155" }}>{p.resumen_corto}</div>
            </section>
          )}

          <section style={{ marginTop: "6mm" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, fontSize: "11px" }}>
            <thead>
              <tr style={{ background: "#faf8f1" }}>
                <th style={{ width: "38px", padding: "7px 10px", textAlign: "center", borderTop: "1px solid #d8dee7", borderBottom: "1px solid #d8dee7", color: "#94a3b8", fontSize: "8px" }}>#</th>
                <th style={{ padding: "7px 10px", textAlign: "left", borderTop: "1px solid #d8dee7", borderBottom: "1px solid #d8dee7", color: "#475569", fontSize: "8px", textTransform: "uppercase", letterSpacing: "1.2px" }}>Concepto</th>
                <th style={{ width: "58px", padding: "7px 10px", textAlign: "center", borderTop: "1px solid #d8dee7", borderBottom: "1px solid #d8dee7", color: "#475569", fontSize: "8px", textTransform: "uppercase" }}>Cant.</th>
                <th style={{ width: "92px", padding: "7px 10px", textAlign: "right", borderTop: "1px solid #d8dee7", borderBottom: "1px solid #d8dee7", color: "#475569", fontSize: "8px", textTransform: "uppercase" }}>P. unit.</th>
                <th style={{ width: "96px", padding: "7px 10px", textAlign: "right", borderTop: "1px solid #d8dee7", borderBottom: "1px solid #d8dee7", color: "#475569", fontSize: "8px", textTransform: "uppercase" }}>Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {grupos.map((grupo, groupIndex) => (
                <Fragment key={grupo.label}>
                  <tr>
                    <td colSpan={5} style={{ padding: "6px 10px 3px", borderTop: groupIndex ? "1px solid #e2e8f0" : "none", color: "#64748b", fontSize: "8px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "1.3px" }}>
                      {grupo.label}
                    </td>
                  </tr>
                  {grupo.items.map((item, itemIndex) => (
                    <tr key={item.id ?? `${groupIndex}-${itemIndex}`}>
                      <td style={{ padding: "7px 10px", textAlign: "center", fontFamily: "monospace", fontSize: "9px", color: "#94a3b8" }}>{String(itemIndex + 1).padStart(2, "0")}</td>
                      <td style={{ padding: "7px 10px", borderBottom: "1px solid #f1f5f9", fontWeight: 650, color: "#1e293b" }}>{item.descripcion}</td>
                      <td style={{ padding: "7px 10px", textAlign: "center", fontFamily: "monospace", color: "#475569" }}>{Number(item.cantidad) % 1 === 0 ? Number(item.cantidad) : item.cantidad}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "monospace", fontSize: "10px", color: "#64748b" }}>{formatCurrency(item.precio_unitario)}</td>
                      <td style={{ padding: "7px 10px", textAlign: "right", fontFamily: "monospace", fontWeight: 800, color: "#0f172a" }}>{formatCurrency(item.subtotal)}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
              {p.items.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ padding: "24px", textAlign: "center", color: "#94a3b8", fontStyle: "italic" }}>
                    Sin conceptos cargados en este presupuesto.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </section>

          <section style={{ marginTop: "8mm", display: "grid", gridTemplateColumns: "1fr 232px", gap: "18px", alignItems: "start" }}>
            <div style={{ borderTop: "1px solid #d8dee7", paddingTop: "8px", fontSize: "9.5px", lineHeight: 1.55, color: "#64748b" }}>
              Válido por 15 días desde la fecha de emisión. Los precios pueden variar según disponibilidad de repuestos.
            </div>
            <div style={{ borderTop: "1px solid #94a3b8" }}>
              <div style={{ padding: "9px 0" }}>
                {p.total_mano_obra > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px", fontSize: "9.5px", color: "#64748b" }}>
                    <span>Mano de obra</span><strong style={{ fontFamily: "monospace", color: "#334155" }}>{formatCurrency(p.total_mano_obra)}</strong>
                  </div>
                )}
                {p.total_repuestos > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "5px", fontSize: "9.5px", color: "#64748b" }}>
                    <span>Repuestos e insumos</span><strong style={{ fontFamily: "monospace", color: "#334155" }}>{formatCurrency(p.total_repuestos)}</strong>
                  </div>
                )}
                {p.descuento > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "9.5px", color: "#475569" }}>
                    <span>Descuento</span><strong style={{ fontFamily: "monospace" }}>− {formatCurrency(p.descuento)}</strong>
                  </div>
                )}
              </div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "2px solid #475569", paddingTop: "10px" }}>
                <span style={{ color: "#64748b", fontSize: "8px", fontWeight: 900, textTransform: "uppercase", letterSpacing: "1.2px" }}>Total</span>
                <strong style={{ color: "#0f172a", fontFamily: "monospace", fontSize: "19px", letterSpacing: "-.7px" }}>{formatCurrency(p.total)}</strong>
              </div>
            </div>
          </section>
        </main>

        <footer style={{ marginTop: documentoCompacto ? "10mm" : "auto", padding: "0 16mm 9mm" }}>
          <div style={{ height: "1px", background: "#d5b968" }} />
          <div style={{ marginTop: "10px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "24px" }}>
            <div style={{ maxWidth: "390px", fontSize: "8px", lineHeight: 1.55, color: "#94a3b8" }}>
              Presupuesto {num} · Emitido el {fecha}.<br />
              Documento de servicio sin valor fiscal.
            </div>
            <div style={{ textAlign: "right", fontSize: "8px", color: "#94a3b8" }}>
              <strong style={{ color: "#475569" }}>Tallerista</strong> · Desarrollado por <strong style={{ color: "#92400e" }}>FAM Desarrollos</strong>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

const LINK_SVG = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);

// ─── Página principal ────────────────────────────────────────────────────────
export default function DetallePresupuesto({ params }: PageProps) {
  const { id } = use(params);
  const presupuestoId = Number(id);
  const router = useRouter();

  const [presupuesto, setPresupuesto] = useState<PresupuestoDetalle | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notificacion, setNotificacion] = useState({ msg: "", isError: false });
  const [cambiandoEstado, setCambiandoEstado] = useState(false);
  const [confirmandoBorrado, setConfirmandoBorrado] = useState(false);
  const [modoPreview, setModoPreview] = useState(false);
  const [generandoPDF, setGenerandoPDF] = useState(false);
  const [tallerNombre, setTallerNombre] = useState("");
  const [tallerCiudad, setTallerCiudad] = useState("");
  const [tallerCuit, setTallerCuit] = useState("");
  const [tallerLogoUrl, setTallerLogoUrl] = useState<string | null>(null);
  const [appOrigin, setAppOrigin] = useState("");

  useEffect(() => {
    setAppOrigin(window.location.origin);
    const session = getSession();
    if (session?.taller_nombre) setTallerNombre(session.taller_nombre);
    if (session?.taller_ciudad) setTallerCiudad(session.taller_ciudad);
    if (session?.taller_cuit) setTallerCuit(session.taller_cuit);
    if (session?.taller_logo_url) setTallerLogoUrl(session.taller_logo_url);

    async function cargar() {
      try {
        setLoading(true);
        const [data, perfil] = await Promise.all([
          getPresupuestoById(presupuestoId),
          getPerfilTaller().catch(() => null),
        ]);
        setPresupuesto(data);
        if (perfil) {
          setTallerNombre(perfil.taller_nombre);
          setTallerCiudad(perfil.taller_ciudad);
          setTallerCuit(perfil.taller_cuit);
          setTallerLogoUrl(perfil.logo_url ?? null);
        }
      } catch {
        setError("No se encontró el presupuesto solicitado.");
      } finally {
        setLoading(false);
      }
    }
    cargar();
  }, [presupuestoId]);

  async function handleEstado(nuevoEstado: string) {
    if (!presupuesto) return;
    const backup = presupuesto.estado;
    setPresupuesto({ ...presupuesto, estado: nuevoEstado });
    setCambiandoEstado(true);
    try {
      await actualizarEstadoPresupuesto(presupuestoId, nuevoEstado);
      mostrarNotificacion(`Estado → "${ESTADOS.find(e => e.value === nuevoEstado)?.label}"`);
    } catch {
      setPresupuesto({ ...presupuesto, estado: backup });
      mostrarNotificacion("Error al actualizar el estado", true);
    } finally {
      setCambiandoEstado(false);
    }
  }

  async function handleEliminar() {
    try {
      await eliminarPresupuesto(presupuestoId);
      router.push("/presupuestos");
    } catch {
      mostrarNotificacion("Error al eliminar el presupuesto", true);
      setConfirmandoBorrado(false);
    }
  }

  function mostrarNotificacion(msg: string, isError = false) {
    setNotificacion({ msg, isError });
    setTimeout(() => setNotificacion({ msg: "", isError: false }), 3000);
  }

  async function descargarPDF() {
    if (!presupuesto) return;
    setGenerandoPDF(true);
    const fileName = `P-${String(presupuesto.id).padStart(4, "0")}.pdf`;
    // En mobile, A4PreviewScaler achica el documento para que entre en
    // pantalla — pero el PDF tiene que salir siempre a resolución completa,
    // igual que en desktop. Lo neutralizamos acá y lo restauramos al final.
    const restaurarEscala = suspenderEscalaA4();
    try {
      const [{ toJpeg }, { jsPDF }] = await Promise.all([
        import("html-to-image"),
        import("jspdf"),
      ]);

      let el = document.getElementById("doc-a4");
      if (!el) {
        setModoPreview(true);
        await new Promise<void>(resolve =>
          requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
        );
        el = document.getElementById("doc-a4");
      }
      if (!el) throw new Error("Elemento del documento no encontrado");

      await esperarRecursosDocumento(el);

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
      let offsetY = 0;
      pdf.addImage(dataUrl, "JPEG", 0, offsetY, 210, imgH);
      while (imgH - Math.abs(offsetY) > 297) {
        offsetY -= 297;
        pdf.addPage();
        pdf.addImage(dataUrl, "JPEG", 0, offsetY, 210, imgH);
      }
      const blob = pdf.output("blob");
      const file = new File([blob], fileName, { type: "application/pdf" });

      // Móvil con Web Share API: abre el selector nativo (WA, Mail, Drive…)
      if (navigator.canShare?.({ files: [file] })) {
        try {
          const portalUrl = presupuesto.token ? `${window.location.origin}/p/presupuesto/${encodeURIComponent(presupuesto.token)}` : undefined;
          await navigator.share({ files: [file], text: buildWATexto(presupuesto, tallerNombre, portalUrl), title: fileName });
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

  const portalUrl = presupuesto?.token && appOrigin
    ? `${appOrigin}/p/presupuesto/${encodeURIComponent(presupuesto.token)}`
    : undefined;

  // ── Loading ──
  if (loading) {
    return (
      <AppShell currentPath="/presupuestos" title="Cargando..." description="Recuperando cotización...">
        <div className="flex h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-sky-600" />
        </div>
      </AppShell>
    );
  }

  // ── Error ──
  if (error || !presupuesto) {
    return (
      <AppShell currentPath="/presupuestos" title="No encontrado" description="Error">
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900/50 dark:bg-red-950/20">
          <p className="font-bold text-red-800 dark:text-red-400">{error || "El presupuesto no existe o fue eliminado."}</p>
          <Link href="/presupuestos" className="mt-4 inline-block text-sm font-bold underline text-red-700 dark:text-red-400">
            ← Volver a presupuestos
          </Link>
        </div>
      </AppShell>
    );
  }

  // ── MODO PREVIEW A4 (pantalla completa, fondo gris tipo PDF viewer) ──
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
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              <span className="hidden sm:inline">Salir del preview</span>
              <span className="sm:hidden">Salir</span>
            </button>
            <span className="truncate text-sm font-bold text-slate-300 sm:hidden">
              P-{String(presupuesto.id).padStart(4, "0")}
            </span>
          </div>
          <span className="hidden text-sm font-bold text-slate-300 sm:inline">
            Vista previa A4 · P-{String(presupuesto.id).padStart(4, "0")}
          </span>
          <div className="flex items-center gap-2 sm:ml-auto">
            <BtnWA texto={buildWATexto(presupuesto, tallerNombre, portalUrl)} telefono={presupuesto.cliente?.telefono} variante="oscuro" />
            <BtnPDF onClick={descargarPDF} cargando={generandoPDF} variante="oscuro" />
          </div>
        </div>

        {/* Documento centrado con sombra tipo papel */}
        <div className="flex justify-center px-3 py-6 print:p-0 sm:py-10 print:block">
          <A4PreviewScaler>
            <div className="shadow-2xl ring-1 ring-slate-900/10 print:shadow-none print:ring-0">
              <DocumentoA4 p={presupuesto} tallerNombre={tallerNombre} tallerCiudad={tallerCiudad} tallerCuit={tallerCuit} tallerLogoUrl={tallerLogoUrl} />
            </div>
          </A4PreviewScaler>
        </div>
      </div>
    );
  }

  // ── VISTA NORMAL ──
  return (
    <AppShell
      currentPath="/presupuestos"
      badge={`Cotización ${`P-${String(presupuesto.id).padStart(4, "0")}`}`}
      title={presupuesto.resumen_corto || `Presupuesto #${presupuesto.id}`}
      description={`${presupuesto.cliente?.nombre_completo ?? "Sin cliente"} · Emitido el ${formatDate(presupuesto.fecha_creacion)}`}
    >
      {/* TOAST */}
      {notificacion.msg && (
        <div className={cn("fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-5 fade-in rounded-lg px-5 py-3 text-sm font-bold text-white shadow-2xl sm:bottom-6 sm:left-auto sm:right-6 sm:w-auto", notificacion.isError ? "bg-red-600" : "bg-slate-900 dark:bg-sky-600")}>
          {notificacion.msg}
        </div>
      )}

      {/* MODAL BORRADO */}
      {confirmandoBorrado && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl animate-in zoom-in-95 dark:bg-slate-800">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">¿Eliminar este presupuesto?</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              P-{presupuesto.id} irá a la papelera. Se puede recuperar desde la base de datos.
            </p>
            <div className="mt-8 flex gap-3">
              <button onClick={() => setConfirmandoBorrado(false)} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700">Cancelar</button>
              <button onClick={handleEliminar} className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-700">Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">

        {/* ── BARRA DE ACCIONES ── */}
        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-800">

          <Link href="/presupuestos" className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-700 transition">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
          </Link>

          {/* Estado */}
          <select
            value={presupuesto.estado}
            onChange={e => handleEstado(e.target.value)}
            disabled={cambiandoEstado}
            className={cn("cursor-pointer appearance-none rounded-xl border px-4 py-2 text-xs font-bold uppercase tracking-wider outline-none transition focus:ring-2 focus:ring-sky-500/50 disabled:opacity-50", BADGE[presupuesto.estado])}
          >
            {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
          </select>

          <div className="ml-auto flex flex-wrap items-center gap-2">

            <BtnWA texto={buildWATexto(presupuesto, tallerNombre, portalUrl)} telefono={presupuesto.cliente?.telefono} variante="claro" />
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

            {/* Portal: abre únicamente la URL pública, sin mezclarla con el mensaje */}
            {presupuesto.token ? (
              <Link
                href={`/p/presupuesto/${encodeURIComponent(presupuesto.token)}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir portal del cliente"
                className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700 transition hover:bg-violet-100 dark:border-violet-800/50 dark:bg-violet-900/20 dark:text-violet-400"
              >
                {LINK_SVG}
                <span className="hidden sm:inline">Portal</span>
              </Link>
            ) : (
              <button
                type="button"
                disabled
                title="Este presupuesto todavía no tiene portal público"
                className="flex cursor-not-allowed items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-400 opacity-70 dark:border-slate-700 dark:bg-slate-800"
              >
                {LINK_SVG}
                <span className="hidden sm:inline">Sin portal</span>
              </button>
            )}

            {/* Editar */}
            <Link
              href={`/presupuestos/nuevo?id=${presupuesto.id}`}
              className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm font-bold text-sky-700 transition hover:bg-sky-100 dark:border-sky-800/50 dark:bg-sky-900/20 dark:text-sky-400"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
              <span className="hidden sm:inline">Editar</span>
            </Link>

            {/* Convertir a OT */}
            {presupuesto.estado !== "RECHAZADO" && (
              <Link
                href={`/trabajos/nuevo?presupuesto=${presupuesto.id}`}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                <span className="hidden sm:inline">Convertir a OT</span>
              </Link>
            )}

            {/* Eliminar */}
            <button
              onClick={() => setConfirmandoBorrado(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-400 transition hover:border-red-400 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:hover:bg-red-900/20 dark:hover:text-red-400"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
            </button>
          </div>
        </div>

        {/* ── RESUMEN OPERATIVO ── */}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950/50">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Cliente</p>
                  <p className="mt-2 font-bold text-slate-900 dark:text-white">{presupuesto.cliente?.nombre_completo || "Sin cliente"}</p>
                  <p className="mt-1 text-xs text-slate-500">{presupuesto.cliente?.telefono || presupuesto.cliente?.email || "Sin datos de contacto"}</p>
                  {presupuesto.cliente && <Link href={`/clientes/${presupuesto.cliente.id}`} className="mt-3 inline-flex text-xs font-bold text-sky-600 hover:underline dark:text-sky-400">Abrir ficha →</Link>}
                </div>
                <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950/50">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Vehículo</p>
                  <p className="mt-2 font-bold text-slate-900 dark:text-white">{presupuesto.vehiculo ? `${presupuesto.vehiculo.marca} ${presupuesto.vehiculo.modelo}` : "Sin vehículo"}</p>
                  <p className="mt-1 font-mono text-xs font-bold text-slate-500">{presupuesto.vehiculo?.patente || "Sin patente"}{presupuesto.vehiculo ? ` · ${presupuesto.vehiculo.kilometraje_actual.toLocaleString("es-AR")} km` : ""}</p>
                </div>
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Trabajo cotizado</p>
                <p className="mt-2 text-base font-bold text-slate-900 dark:text-white">{presupuesto.resumen_corto || "Sin descripción general"}</p>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <div>
                  <h2 className="font-black text-slate-900 dark:text-white">Detalle de la cotización</h2>
                  <p className="mt-0.5 text-xs text-slate-500">{presupuesto.items.length} {presupuesto.items.length === 1 ? "concepto" : "conceptos"}</p>
                </div>
                <button onClick={() => setModoPreview(true)} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Ver documento A4</button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {presupuesto.items.map((item, index) => (
                  <div key={item.id || index} className="grid gap-2 px-5 py-3 sm:grid-cols-[100px_minmax(0,1fr)_90px_130px] sm:items-center">
                    <span className="w-fit rounded-full bg-slate-100 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-300">{item.tipo.replace("_", " ")}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{item.descripcion}</p>
                      <p className="text-[11px] text-slate-400">{Number(item.cantidad)} × {Number(item.precio_unitario).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })}</p>
                    </div>
                    <span className="text-xs text-slate-500 sm:text-right">Cant. {Number(item.cantidad)}</span>
                    <strong className="font-mono text-sm text-slate-900 dark:text-white sm:text-right">{Number(item.subtotal).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })}</strong>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="h-fit space-y-4 xl:sticky xl:top-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Resumen económico</p>
              <div className="mt-4 space-y-2 border-b border-slate-100 pb-4 text-sm dark:border-slate-800">
                <div className="flex justify-between gap-4 text-slate-500"><span>Mano de obra</span><strong className="font-mono text-slate-800 dark:text-slate-200">{Number(presupuesto.total_mano_obra).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })}</strong></div>
                <div className="flex justify-between gap-4 text-slate-500"><span>Repuestos e insumos</span><strong className="font-mono text-slate-800 dark:text-slate-200">{Number(presupuesto.total_repuestos).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })}</strong></div>
                {Number(presupuesto.descuento) > 0 && <div className="flex justify-between gap-4 text-emerald-600"><span>Descuento</span><strong className="font-mono">− {Number(presupuesto.descuento).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })}</strong></div>}
              </div>
              <div className="mt-4 flex items-end justify-between gap-4">
                <span className="text-xs font-black uppercase tracking-wider text-slate-400">Total</span>
                <strong className="font-mono text-2xl text-slate-900 dark:text-white">{Number(presupuesto.total).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })}</strong>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Próxima acción</p>
              {presupuesto.estado === "BORRADOR" && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Revisalo y compartilo con el cliente.</p>}
              {presupuesto.estado === "ENVIADO" && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Esperando respuesta del cliente.</p>}
              {presupuesto.estado === "APROBADO" && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Ya podés convertirlo en una orden de trabajo.</p>}
              {presupuesto.estado === "RECHAZADO" && <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Quedó cerrado como rechazado.</p>}
              {presupuesto.estado !== "RECHAZADO" && <Link href={`/trabajos/nuevo?presupuesto=${presupuesto.id}`} className="mt-4 inline-flex w-full justify-center rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-700">Convertir en OT →</Link>}
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}
