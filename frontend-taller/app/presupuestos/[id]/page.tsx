"use client";

import { Fragment, use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { A4PreviewScaler, suspenderEscalaA4 } from "@/components/a4-preview-scaler";
import { getPresupuestoById, actualizarEstadoPresupuesto, eliminarPresupuesto, getPerfilTaller, renovarPortalPresupuesto } from "@/lib/api";
import { esperarRecursosDocumento, fuenteArchivoEmbebida } from "@/lib/document-export";
import { formatCurrency, formatDate } from "@/lib/format";
import type { PresupuestoDetalle } from "@/lib/types";
import { desgloseIva, datosFiscalesDe, ivaVisible, FISCAL_VACIO, lineaFiscal, pieFiscal, type DatosFiscales } from "@/lib/fiscal";
import { cn } from "@/lib/utils";
import { getSession } from "@/lib/trial";
import { buildWhatsAppUrl, normalizeWhatsAppPhone } from "@/lib/whatsapp";
import { numeroPresupuesto } from "@/lib/documentos";
import { copiarAlPortapapeles } from "@/lib/portapapeles";

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
  const num = numeroPresupuesto(p.id);
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
function BtnWA({ texto, telefono, variante, onEnviar }: { texto: string; telefono?: string | null; variante: "claro" | "oscuro"; onEnviar?: () => void }) {
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
      onClick={onEnviar}
      className={estilos}
      title={`Enviar por WhatsApp a ${telefono}`}
      aria-label={`Enviar por WhatsApp a ${telefono}`}
    >
      {WA_SVG}
      WhatsApp
    </a>
  );
}

// ─── Documento A4 ────────────────────────────────────────────────────────────
/**
 * Misma línea visual que el link que recibe el cliente (formato recibo):
 * la marca es el taller, el total va grande y se informa hasta cuándo vale.
 * Estilos en línea: html-to-image captura el DOM tal cual para el PDF.
 */
const FUENTE = "'Archivo Variable', system-ui, -apple-system, 'Segoe UI', sans-serif";
const ANGOSTA = { fontFamily: FUENTE, fontStretch: "72%", fontWeight: 800 } as const;
const VALIDEZ_DIAS = 15;

function DocumentoA4({ p, tallerNombre, tallerCiudad, tallerCuit, tallerLogoUrl, tallerTel, fiscal = FISCAL_VACIO }: { p: PresupuestoDetalle; tallerNombre: string; tallerCiudad: string; tallerCuit: string; tallerLogoUrl?: string | null; tallerTel?: string; fiscal?: DatosFiscales }) {
  const num = numeroPresupuesto(p.id);
  const emitido = new Date(p.fecha_creacion);
  const vence = new Date(emitido.getTime() + VALIDEZ_DIAS * 86_400_000);
  const fechaLarga = (d: Date) => d.toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
  const iniciales = (tallerNombre || "T").split(" ").filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("").slice(0, 2);

  const grupos = [
    { label: "Trabajos", tipo: "MANO_OBRA", color: "#475569", fondo: "#f1f5f9" },
    { label: "Repuestos", tipo: "REPUESTO", color: "#0369a1", fondo: "#f0f9ff" },
    { label: "Insumos", tipo: "INSUMO", color: "#0369a1", fondo: "#f0f9ff" },
    { label: "Otros", tipo: "OTRO", color: "#475569", fondo: "#f1f5f9" },
  ].map(g => ({ ...g, items: p.items.filter(i => i.tipo === g.tipo) })).filter(g => g.items.length > 0);

  const cargaVisual = p.items.length + Math.ceil((p.resumen_corto?.length ?? 0) / 180);
  const documentoCompacto = cargaVisual <= 8;
  const etiqueta = { fontSize: "9px", color: "#64748b", fontWeight: 500 } as const;
  const cantidad = (c: number) => (Number(c) % 1 === 0 ? Number(c) : c);

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
        style={{ width: "210mm", minHeight: documentoCompacto ? "0" : "297mm", display: "flex", flexDirection: "column", fontFamily: FUENTE, color: "#0f172a" }}
      >
        {/* ── Encabezado: el taller y el documento ── */}
        <header style={{ padding: "14mm 16mm 0", display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0 }}>
            {tallerLogoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- html-to-image captura el DOM directo, no funciona con next/image
              <img src={tallerLogoUrl} alt={tallerNombre || "Logo del taller"} crossOrigin="anonymous" style={{ width: "46px", height: "46px", borderRadius: "11px", objectFit: "cover", flexShrink: 0 }} />
            ) : (
              <div style={{ width: "46px", height: "46px", borderRadius: "11px", background: "#ea580c", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: "15px", flexShrink: 0 }}>
                {iniciales}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "18px", fontWeight: 700, lineHeight: 1.15 }}>{tallerNombre || "Mi Taller"}</div>
              <div style={{ marginTop: "3px", fontSize: "10px", color: "#64748b" }}>
                {[tallerCiudad, tallerTel].filter(Boolean).join(" · ") || "Servicio automotor"}
              </div>
              {lineaFiscal(fiscal, tallerCuit, tallerNombre) && (
                <div style={{ marginTop: "2px", fontSize: "9.5px", color: "#64748b" }}>{lineaFiscal(fiscal, tallerCuit, tallerNombre)}</div>
              )}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ ...ANGOSTA, fontSize: "26px", lineHeight: 1, textTransform: "uppercase", letterSpacing: "-0.3px" }}>Presupuesto</div>
            <div style={{ marginTop: "4px", fontSize: "12px", fontWeight: 600, color: "#ea580c" }}>{num}</div>
            <div style={{ marginTop: "4px", fontSize: "9.5px", color: "#64748b" }}>Emitido el {fechaLarga(emitido)}</div>
          </div>
        </header>

        <main style={{ flex: 1, padding: "8mm 16mm 0" }}>
          {/* ── Cliente, vehículo y total ── */}
          <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.05fr", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
            <div style={{ padding: "12px 14px 12px 0" }}>
              <div style={etiqueta}>Para</div>
              <div style={{ marginTop: "4px", fontSize: "13px", fontWeight: 700 }}>{p.cliente?.nombre_completo || "Sin cliente registrado"}</div>
              <div style={{ marginTop: "3px", fontSize: "9.5px", lineHeight: 1.5, color: "#64748b" }}>
                {p.cliente ? [p.cliente.telefono, p.cliente.email, p.cliente.dni && `DNI/CUIT ${p.cliente.dni}`].filter(Boolean).join(" · ") || "Sin datos de contacto" : "Sin datos de contacto"}
              </div>
            </div>
            <div style={{ padding: "12px 14px", borderLeft: "1px solid #e2e8f0" }}>
              <div style={etiqueta}>Vehículo</div>
              <div style={{ marginTop: "4px", fontSize: "13px", fontWeight: 700 }}>
                {p.vehiculo ? `${p.vehiculo.marca} ${p.vehiculo.modelo}` : "Sin vehículo registrado"}
                {p.vehiculo?.anio ? <span style={{ fontWeight: 400, color: "#64748b" }}> · {p.vehiculo.anio}</span> : null}
              </div>
              {p.vehiculo && (
                <div style={{ marginTop: "3px", fontSize: "9.5px", color: "#64748b" }}>
                  Patente <span style={{ fontWeight: 600, color: "#334155", letterSpacing: "0.5px" }}>{p.vehiculo.patente}</span> · {p.vehiculo.kilometraje_actual.toLocaleString("es-AR")} km
                </div>
              )}
            </div>
            <div style={{ padding: "12px 0 12px 14px", borderLeft: "1px solid #e2e8f0", textAlign: "right", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={etiqueta}>Total</div>
              <div style={{ ...ANGOSTA, fontSize: "30px", lineHeight: 1.05, color: "#0f172a" }}>{formatCurrency(p.total)}</div>
              <div style={{ marginTop: "2px", fontSize: "9px", color: "#64748b" }}>Válido hasta el {fechaLarga(vence)}</div>
            </div>
          </section>

          {/* ── Qué incluye ── */}
          <section style={{ marginTop: "8mm" }}>
            <div style={etiqueta}>Qué incluye</div>
            {p.resumen_corto && <div style={{ marginTop: "3px", fontSize: "17px", fontWeight: 700 }}>{p.resumen_corto}</div>}

            <table style={{ marginTop: "5mm", width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
              <thead>
                <tr style={{ color: "#64748b", fontSize: "9px" }}>
                  <th style={{ padding: "0 0 6px", textAlign: "left", fontWeight: 500, borderBottom: "1px solid #e2e8f0" }}>Concepto</th>
                  <th style={{ width: "54px", padding: "0 0 6px", textAlign: "center", fontWeight: 500, borderBottom: "1px solid #e2e8f0" }}>Cant.</th>
                  <th style={{ width: "92px", padding: "0 0 6px", textAlign: "right", fontWeight: 500, borderBottom: "1px solid #e2e8f0" }}>Precio unit.</th>
                  <th style={{ width: "100px", padding: "0 0 6px", textAlign: "right", fontWeight: 500, borderBottom: "1px solid #e2e8f0" }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {grupos.map(grupo => (
                  <Fragment key={grupo.tipo}>
                    <tr>
                      <td colSpan={4} style={{ padding: "10px 0 4px" }}>
                        <span style={{ color: grupo.color, fontSize: "9.5px", fontWeight: 700 }}>{grupo.label}</span>
                      </td>
                    </tr>
                    {grupo.items.map((item, i) => (
                      <tr key={item.id ?? `${grupo.tipo}-${i}`}>
                        <td style={{ padding: "7px 0", borderBottom: "1px solid #f1f5f9", fontWeight: 500 }}>{item.descripcion}</td>
                        <td style={{ padding: "7px 0", borderBottom: "1px solid #f1f5f9", textAlign: "center", color: "#475569" }}>{cantidad(item.cantidad)}</td>
                        <td style={{ padding: "7px 0", borderBottom: "1px solid #f1f5f9", textAlign: "right", color: "#64748b" }}>{formatCurrency(item.precio_unitario)}</td>
                        <td style={{ padding: "7px 0", borderBottom: "1px solid #f1f5f9", textAlign: "right", fontWeight: 600 }}>{formatCurrency(item.subtotal)}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
                {p.items.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: "24px", textAlign: "center", color: "#94a3b8" }}>Sin ítems cargados en este presupuesto.</td></tr>
                )}
              </tbody>
            </table>
          </section>

          {/* ── Condiciones y totales ── */}
          <section style={{ marginTop: "7mm", display: "grid", gridTemplateColumns: "1fr 240px", gap: "24px", alignItems: "start" }}>
            <div style={{ fontSize: "9.5px", lineHeight: 1.6, color: "#64748b" }}>
              <div style={{ fontWeight: 600, color: "#334155" }}>Condiciones</div>
              Válido hasta el {fechaLarga(vence)}. Los precios de repuestos pueden variar según disponibilidad.
              Podés aprobarlo desde el link que te enviamos o respondiendo nuestro mensaje.
            </div>
            <div>
              {p.total_mano_obra > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "10px", color: "#64748b" }}><span>Mano de obra</span><span>{formatCurrency(p.total_mano_obra)}</span></div>
              )}
              {p.total_repuestos > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "10px", color: "#64748b" }}><span>Repuestos e insumos</span><span>{formatCurrency(p.total_repuestos)}</span></div>
              )}
              {p.descuento > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "10px", color: "#047857" }}><span>Descuento</span><span>− {formatCurrency(p.descuento)}</span></div>
              )}
              {ivaVisible(fiscal) && Number(p.total) > 0 && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", paddingTop: "6px", borderTop: "1px solid #e2e8f0", fontSize: "10px", color: "#64748b" }}><span>Neto gravado</span><span>{formatCurrency(desgloseIva(p.total).neto)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "10px", color: "#64748b" }}><span>IVA 21%</span><span>{formatCurrency(desgloseIva(p.total).iva)}</span></div>
                </>
              )}
              <div style={{ marginTop: "6px", paddingTop: "8px", borderTop: "2px solid #0f172a", display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <span style={{ fontSize: "11px", fontWeight: 600 }}>Total{ivaVisible(fiscal) ? " (IVA incluido)" : ""}</span>
                <span style={{ ...ANGOSTA, fontSize: "24px" }}>{formatCurrency(p.total)}</span>
              </div>
            </div>
          </section>
        </main>

        <footer style={{ marginTop: documentoCompacto ? "12mm" : "auto", padding: "0 16mm 10mm" }}>
          <div style={{ height: "1px", background: "#e2e8f0" }} />
          <div style={{ marginTop: "8px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "24px", fontSize: "8.5px", color: "#94a3b8" }}>
            <div>
              {pieFiscal(fiscal) && <div style={{ marginBottom: "2px", color: "#64748b" }}>{pieFiscal(fiscal)}</div>}
              Presupuesto {num} · Documento de servicio, no válido como factura.
            </div>
            <div style={{ textAlign: "right" }}>
              <strong style={{ color: "#64748b" }}>Tallerista</strong> · La herramienta amiga de los talleres · Creado por <strong style={{ color: "#64748b" }}>FAM Desarrollos</strong>
            </div>
          </div>
        </footer>
      </div>
    </>
  );
}

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
  const [fiscal, setFiscal] = useState<DatosFiscales>(FISCAL_VACIO);
  const [tallerLogoUrl, setTallerLogoUrl] = useState<string | null>(null);
  const [tallerTel, setTallerTel] = useState("");
  const [linkCopiado, setLinkCopiado] = useState(false);
  const [linkParaCopiar, setLinkParaCopiar] = useState<string | null>(null);
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
          setFiscal(datosFiscalesDe(perfil));
          setTallerLogoUrl(perfil.logo_url ?? null);
          setTallerTel(perfil.taller_tel ?? "");
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

  // El link del portal viaja en el mensaje: se renueva al enviarlo, sin
  // esperar la respuesta (ver renovarPortalPresupuesto).
  function renovarLinkPortal() {
    if (presupuesto?.token && presupuesto.portal_activo !== false) {
      void renovarPortalPresupuesto(presupuesto.id).catch(() => {});
    }
  }

  /** Al compartir el link ya está en manos del cliente: deja de ser borrador. */
  function compartido() {
    renovarLinkPortal();
    if (presupuesto?.estado === "BORRADOR") void handleEstado("ENVIADO");
  }

  async function copiarLink() {
    if (!portalUrl) return;
    compartido();
    if (await copiarAlPortapapeles(portalUrl)) {
      setLinkCopiado(true);
      window.setTimeout(() => setLinkCopiado(false), 2500);
    } else {
      // Último recurso: mostrar el link seleccionado para copiarlo a mano.
      setLinkParaCopiar(portalUrl);
    }
  }

  async function descargarPDF() {
    if (!presupuesto) return;
    renovarLinkPortal();
    setGenerandoPDF(true);
    const fileName = `${numeroPresupuesto(presupuesto.id)}.pdf`;
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

      // skipFonts evita que html-to-image lea todas las hojas de estilo (se
      // colgaba); la letra Archivo se le pasa embebida aparte.
      const fontEmbedCSS = await fuenteArchivoEmbebida();
      const opts = {
        quality: 0.93,
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        skipFonts: !fontEmbedCSS,
        fontEmbedCSS,
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
          const portalUrl = presupuesto.token && presupuesto.portal_activo !== false ? `${window.location.origin}/p/presupuesto/${encodeURIComponent(presupuesto.token)}` : undefined;
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

  const portalUrl = presupuesto?.token && appOrigin && presupuesto.portal_activo !== false
    ? `${appOrigin}/p/presupuesto/${encodeURIComponent(presupuesto.token)}`
    : undefined;

  // Esc cierra la vista previa del documento.
  useEffect(() => {
    if (!modoPreview) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setModoPreview(false); };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [modoPreview]);

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
      <div className="min-h-screen bg-slate-200/80 dark:bg-slate-900">
        {/* Barra del visor: a la izquierda el documento, a la derecha
            "papel" (imprimir, PDF) y "mandar" (link, WhatsApp). */}
        <div className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur print:hidden dark:border-slate-800 dark:bg-slate-900/95">
          <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
            <button
              onClick={() => setModoPreview(false)}
              title="Volver (Esc)"
              className="inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
              Volver
            </button>
            <span className="hidden h-6 w-px bg-slate-200 dark:bg-slate-700 sm:block" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">Presupuesto {numeroPresupuesto(presupuesto.id)}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {[presupuesto.resumen_corto, presupuesto.cliente?.nombre_completo].filter(Boolean).join(" · ")}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Papel */}
              <div className="inline-flex h-9 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800" role="group" aria-label="Papel">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-2 px-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" /></svg>
                  Imprimir
                </button>
                <button
                  type="button"
                  onClick={descargarPDF}
                  disabled={generandoPDF}
                  className="inline-flex items-center gap-2 border-l border-slate-200 px-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  {generandoPDF
                    ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" />
                    : PDF_SVG}
                  {generandoPDF ? "Generando…" : "Descargar PDF"}
                </button>
              </div>

              <span className="mx-1 hidden h-6 w-px bg-slate-200 dark:bg-slate-700 md:block" aria-hidden="true" />

              {/* Mandar al cliente */}
              <BtnCopiarLink disponible={Boolean(portalUrl)} copiado={linkCopiado} onClick={copiarLink} />
              <BtnWA texto={buildWATexto(presupuesto, tallerNombre, portalUrl)} telefono={presupuesto.cliente?.telefono} variante="claro" onEnviar={compartido} />
            </div>
          </div>
        </div>

        {/* Documento centrado con sombra tipo papel */}
        <div className="flex justify-center px-3 py-6 print:p-0 sm:py-10 print:block">
          <A4PreviewScaler>
            <div className="shadow-2xl ring-1 ring-slate-900/10 print:shadow-none print:ring-0">
              <DocumentoA4 p={presupuesto} tallerNombre={tallerNombre} tallerCiudad={tallerCiudad} tallerCuit={tallerCuit} tallerLogoUrl={tallerLogoUrl} tallerTel={tallerTel} fiscal={fiscal} />
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
      badge={`Cotización ${numeroPresupuesto(presupuesto.id)}`}
      title={presupuesto.resumen_corto || `Presupuesto #${presupuesto.id}`}
      description={`${presupuesto.cliente?.nombre_completo ?? "Sin cliente"} · Emitido el ${formatDate(presupuesto.fecha_creacion)}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/presupuestos/nuevo?id=${presupuesto.id}`} title="Cambiar ítems, precios, descuento o estado" className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M16.86 4.49l2.65 2.65M4 20l4.5-1 10.3-10.3a1.87 1.87 0 00-2.65-2.65L5.85 16.35 4 20z" /></svg>
            Editar
          </Link>
          <button
            type="button"
            onClick={() => setModoPreview(true)}
            title="Ver el documento A4 (desde ahí se descarga el PDF)"
            className="inline-flex h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
          >
            {PDF_SVG}
            Ver PDF
          </button>
          <BtnCopiarLink disponible={Boolean(portalUrl)} copiado={linkCopiado} onClick={copiarLink} />
          <BtnWA texto={buildWATexto(presupuesto, tallerNombre, portalUrl)} telefono={presupuesto.cliente?.telefono} variante="claro" onEnviar={compartido} />
          {presupuesto.estado !== "RECHAZADO" && (
            <Link
              href={`/trabajos/nuevo?presupuesto=${presupuesto.id}`}
              title="Crea una orden de trabajo con este cliente, el auto y los mismos ítems"
              className="inline-flex h-9 items-center rounded-xl bg-brand-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700"
            >
              Pasar a orden de trabajo →
            </Link>
          )}
        </div>
      }
    >
      {/* TOAST */}
      {notificacion.msg && (
        <div className={cn("fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-5 fade-in rounded-lg px-5 py-3 text-sm font-bold text-white shadow-2xl sm:bottom-6 sm:left-auto sm:right-6 sm:w-auto", notificacion.isError ? "bg-red-600" : "bg-slate-900 dark:bg-sky-600")}>
          {notificacion.msg}
        </div>
      )}

      {/* Link para copiar a mano (si el navegador no deja usar el portapapeles) */}
      {linkParaCopiar && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={() => setLinkParaCopiar(null)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white">Link para el cliente</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Este navegador no dejó copiarlo solo. Está seleccionado: copialo con Ctrl+C (o Cmd+C).</p>
            <input
              readOnly
              value={linkParaCopiar}
              autoFocus
              onFocus={(e) => e.currentTarget.select()}
              className="mt-4 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
            <button onClick={() => setLinkParaCopiar(null)} className="mt-4 w-full rounded-xl bg-slate-900 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">Listo</button>
          </div>
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
              {numeroPresupuesto(presupuesto.id)} irá a la papelera. Se puede recuperar desde la base de datos.
            </p>
            <div className="mt-8 flex gap-3">
              <button onClick={() => setConfirmandoBorrado(false)} className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700">Cancelar</button>
              <button onClick={handleEliminar} className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-700">Sí, eliminar</button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">

        {/* ── Estado (se cambia desde acá) ── */}
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/presupuestos" className="text-sm font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">← Presupuestos</Link>
          <span className="h-4 w-px bg-slate-300 dark:bg-slate-700" aria-hidden="true" />
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
            Estado
            <select
              value={presupuesto.estado}
              onChange={e => handleEstado(e.target.value)}
              disabled={cambiandoEstado}
              className={cn("cursor-pointer appearance-none rounded-lg border px-3 py-1.5 text-xs font-bold uppercase tracking-wider outline-none transition focus:ring-2 focus:ring-brand-500/40 disabled:opacity-50", BADGE[presupuesto.estado])}
            >
              {ESTADOS.map(e => <option key={e.value} value={e.value}>{e.label}</option>)}
            </select>
          </label>
          <span className="text-xs text-slate-500 dark:text-slate-400">{numeroPresupuesto(presupuesto.id)}</span>
          <div className="ml-auto flex flex-wrap items-center gap-x-4 gap-y-1 text-sm font-semibold">
            {portalUrl && (
              <a href={portalUrl} target="_blank" rel="noopener noreferrer" className="text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
                Ver cómo lo ve el cliente ↗
              </a>
            )}
            <button type="button" onClick={() => setConfirmandoBorrado(true)} className="text-red-600 hover:text-red-700 dark:text-red-400">Eliminar</button>
          </div>
        </div>

        {/* ── RESUMEN OPERATIVO ── */}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_330px]">
          <div className="space-y-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950/50">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Cliente</p>
                  <p className="mt-2 font-bold text-slate-900 dark:text-white">{presupuesto.cliente?.nombre_completo || "Sin cliente"}</p>
                  <p className="mt-1 text-xs text-slate-500">{presupuesto.cliente?.telefono || presupuesto.cliente?.email || "Sin datos de contacto"}</p>
                  {presupuesto.cliente && <Link href={`/clientes/${presupuesto.cliente.id}`} className="mt-3 inline-flex text-xs font-bold text-sky-600 hover:underline dark:text-sky-400">Abrir ficha →</Link>}
                </div>
                <div className="rounded-xl bg-slate-50 p-4 dark:bg-slate-950/50">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Vehículo</p>
                  <p className="mt-2 font-bold text-slate-900 dark:text-white">{presupuesto.vehiculo ? `${presupuesto.vehiculo.marca} ${presupuesto.vehiculo.modelo}` : "Sin vehículo"}</p>
                  <p className="mt-1 text-xs text-slate-500">{presupuesto.vehiculo?.patente || "Sin patente"}{presupuesto.vehiculo ? ` · ${presupuesto.vehiculo.kilometraje_actual.toLocaleString("es-AR")} km` : ""}</p>
                </div>
              </div>
              <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Trabajo cotizado</p>
                <p className="mt-2 text-base font-bold text-slate-900 dark:text-white">{presupuesto.resumen_corto || "Sin descripción general"}</p>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-800">
                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-white">Detalle de la cotización</h2>
                  <p className="mt-0.5 text-xs text-slate-500">{presupuesto.items.length} {presupuesto.items.length === 1 ? "concepto" : "conceptos"}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Link href={`/presupuestos/nuevo?id=${presupuesto.id}`} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Editar ítems</Link>
                  <button onClick={descargarPDF} disabled={generandoPDF} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">{generandoPDF ? "Generando…" : "Descargar PDF"}</button>
                </div>
              </div>
              {presupuesto.items.length === 0 && (
                <p className="px-5 py-8 text-center text-sm text-slate-500">
                  Este presupuesto no tiene ítems. <Link href={`/presupuestos/nuevo?id=${presupuesto.id}`} className="font-semibold text-brand-600">Agregar ítems →</Link>
                </p>
              )}
              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {presupuesto.items.map((item, index) => (
                  <div key={item.id || index} className="grid gap-2 px-5 py-3 sm:grid-cols-[100px_minmax(0,1fr)_90px_130px] sm:items-center">
                    <span className={cn("w-fit rounded-md px-2 py-0.5 text-xs font-medium", item.tipo === "MANO_OBRA" ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300" : "bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300")}>{({ MANO_OBRA: "Trabajo", REPUESTO: "Repuesto", INSUMO: "Insumo", OTRO: "Otro" } as Record<string, string>)[item.tipo] ?? item.tipo}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-200">{item.descripcion}</p>
                      <p className="text-[11px] text-slate-400">{Number(item.cantidad)} × {Number(item.precio_unitario).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })}</p>
                    </div>
                    <span className="text-xs text-slate-500 sm:text-right">Cant. {Number(item.cantidad)}</span>
                    <strong className="font-display text-base font-extrabold tabular-nums text-slate-900 dark:text-white sm:text-right">{Number(item.subtotal).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })}</strong>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="h-fit space-y-4 xl:sticky xl:top-4">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Resumen económico</p>
              <div className="mt-4 space-y-2 border-b border-slate-100 pb-4 text-sm dark:border-slate-800">
                <div className="flex justify-between gap-4 text-slate-500"><span>Mano de obra</span><strong className="tabular-nums text-slate-800 dark:text-slate-200">{Number(presupuesto.total_mano_obra).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })}</strong></div>
                <div className="flex justify-between gap-4 text-slate-500"><span>Repuestos e insumos</span><strong className="tabular-nums text-slate-800 dark:text-slate-200">{Number(presupuesto.total_repuestos).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })}</strong></div>
                {Number(presupuesto.descuento) > 0 && <div className="flex justify-between gap-4 text-emerald-600"><span>Descuento</span><strong className="tabular-nums">− {Number(presupuesto.descuento).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })}</strong></div>}
              </div>
              <div className="mt-4 flex items-end justify-between gap-4">
                <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Total</span>
                <strong className="font-display text-4xl font-extrabold leading-none tabular-nums text-slate-900 dark:text-white">{Number(presupuesto.total).toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 })}</strong>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Próximo paso</p>
              <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
                {presupuesto.estado === "BORRADOR" && "Revisalo y mandáselo al cliente."}
                {presupuesto.estado === "ENVIADO" && "Esperando la respuesta del cliente."}
                {presupuesto.estado === "APROBADO" && "El cliente lo aprobó: ya podés empezar el trabajo."}
                {presupuesto.estado === "RECHAZADO" && "El cliente lo rechazó; quedó cerrado."}
              </p>

              {/* Respuesta del cliente cuando llega por teléfono o en persona
                  (si responde desde el link, el estado cambia solo). */}
              {(presupuesto.estado === "BORRADOR" || presupuesto.estado === "ENVIADO") && (
                <div className="mt-4">
                  <p className="text-xs text-slate-500 dark:text-slate-400">¿Te respondió por teléfono o en persona?</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => handleEstado("APROBADO")}
                      disabled={cambiandoEstado}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-50 text-sm font-semibold text-emerald-700 ring-1 ring-inset ring-emerald-200 transition hover:bg-emerald-100 disabled:opacity-50 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900"
                    >
                      ✓ Lo aprobó
                    </button>
                    <button
                      type="button"
                      onClick={() => handleEstado("RECHAZADO")}
                      disabled={cambiandoEstado}
                      className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-slate-600 ring-1 ring-inset ring-slate-200 transition hover:bg-red-50 hover:text-red-700 hover:ring-red-200 disabled:opacity-50 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-red-950/30"
                    >
                      ✕ Lo rechazó
                    </button>
                  </div>
                  {presupuesto.estado === "BORRADOR" && (
                    <button type="button" onClick={() => handleEstado("ENVIADO")} disabled={cambiandoEstado} className="mt-2 w-full text-center text-xs font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-50 dark:text-slate-400 dark:hover:text-white">
                      Ya se lo mandé → marcar como esperando respuesta
                    </button>
                  )}
                </div>
              )}
              {(presupuesto.estado === "APROBADO" || presupuesto.estado === "RECHAZADO") && (
                <button type="button" onClick={() => handleEstado("ENVIADO")} disabled={cambiandoEstado} className="mt-2 text-xs font-semibold text-slate-500 hover:text-slate-800 disabled:opacity-50 dark:text-slate-400 dark:hover:text-white">
                  ¿Fue un error? Volver a esperando respuesta
                </button>
              )}
              {presupuesto.estado !== "RECHAZADO" && (
                <>
                  <div className="mt-4 rounded-xl bg-slate-50 p-3.5 text-xs leading-relaxed text-slate-600 dark:bg-slate-950/50 dark:text-slate-300">
                    <p className="font-semibold text-slate-800 dark:text-slate-100">¿Qué hace “Pasar a orden de trabajo”?</p>
                    <p className="mt-1">
                      Abre una orden nueva con este cliente, el auto y los mismos ítems. Revisás el kilometraje y la guardás:
                      el auto entra al tablero en <span className="font-semibold">Por revisar</span> y este presupuesto queda como <span className="font-semibold">aprobado</span>.
                    </p>
                  </div>
                  <Link href={`/trabajos/nuevo?presupuesto=${presupuesto.id}`} className="mt-3 inline-flex w-full justify-center rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-700">
                    Pasar a orden de trabajo →
                  </Link>
                </>
              )}
            </section>
          </aside>
        </div>
      </div>
    </AppShell>
  );
}

/**
 * Copia el link que recibe el cliente (ver y aprobar el presupuesto). Es la
 * forma principal de mandarlo: se pega en WhatsApp, mail o donde sea.
 */
function BtnCopiarLink({ disponible, copiado, onClick, oscuro = false }: { disponible: boolean; copiado: boolean; onClick: () => void; oscuro?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!disponible}
      title={disponible ? "Copiar el link para mandárselo al cliente" : "Este presupuesto no tiene link activo"}
      className={cn(
        "inline-flex h-9 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50",
        copiado
          ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
          : oscuro
            ? "border-slate-500 text-white hover:bg-slate-700"
            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700",
      )}
    >
      {copiado ? (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
      ) : (
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>
      )}
      {copiado ? "Link copiado" : "Copiar link"}
    </button>
  );
}
