"use client";

import { Fragment, use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { A4PreviewScaler, suspenderEscalaA4 } from "@/components/a4-preview-scaler";
import { getSession } from "@/lib/trial";
import { getTrabajoById, actualizarEstadoTrabajo, actualizarItemTrabajo, agregarItemTrabajo, eliminarTrabajo, getPerfilTaller, precioItemTrabajo, renovarPortalVehiculo } from "@/lib/api";
import { esperarRecursosDocumento, fuenteArchivoEmbebida } from "@/lib/document-export";
import { formatCurrency, formatDate, formatNumber } from "@/lib/format";
import type { TrabajoDetalle, TrabajoItem } from "@/lib/types";
import { desgloseIva, datosFiscalesDe, ivaVisible, FISCAL_VACIO, lineaFiscal, pieFiscal, type DatosFiscales } from "@/lib/fiscal";
import { cn } from "@/lib/utils";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { copiarAlPortapapeles } from "@/lib/portapapeles";
import { ESTADO_TRABAJO_LABEL, numeroOrden } from "@/lib/documentos";

interface PageProps {
  params: Promise<{ id: string }>;
}

const TRANSICIONES: Record<string, string[]> = {
  INGRESADO: ["EN_PROCESO", "ANULADO"],
  EN_PROCESO: ["INGRESADO", "FINALIZADO", "ANULADO"],
  FINALIZADO: ["EN_PROCESO", "ENTREGADO", "ANULADO"],
  ENTREGADO: [],
  ANULADO: [],
};

function buildWATexto(t: TrabajoDetalle, tallerNombre: string): string {
  const num = numeroOrden(t.id);
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

// ─── Documento A4 (estilo Recibo, igual al presupuesto) ───────────────────────
const FUENTE = "'Archivo Variable', system-ui, -apple-system, 'Segoe UI', sans-serif";
const ANGOSTA = { fontFamily: FUENTE, fontStretch: "72%", fontWeight: 800 } as const;

function DocumentoA4({
  t,
  tallerNombre,
  tallerCiudad,
  tallerTel,
  tallerCuit,
  tallerLogoUrl,
  fiscal = FISCAL_VACIO,
}: {
  t: TrabajoDetalle;
  tallerNombre: string;
  tallerCiudad: string;
  tallerTel: string;
  tallerCuit: string;
  tallerLogoUrl?: string | null;
  fiscal?: DatosFiscales;
}) {
  const num = numeroOrden(t.id);
  const fechaLarga = (d: string) => new Date(d).toLocaleDateString("es-AR", { day: "numeric", month: "long", year: "numeric" });
  const iniciales = (tallerNombre || "T").split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("").slice(0, 2);
  const terminado = t.estado === "FINALIZADO" || t.estado === "ENTREGADO";
  const estadoTexto = ESTADO_TRABAJO_LABEL[t.estado as keyof typeof ESTADO_TRABAJO_LABEL] ?? t.estado;

  const grupos = [
    { label: "Trabajos", tipo: "MANO_OBRA", color: "#475569" },
    { label: "Repuestos", tipo: "REPUESTO", color: "#0369a1" },
    { label: "Insumos", tipo: "INSUMO", color: "#0369a1" },
    { label: "Otros", tipo: "OTRO", color: "#475569" },
  ].map((g) => ({ ...g, items: t.items.filter((i) => i.tipo === g.tipo) })).filter((g) => g.items.length > 0);

  const notas = [
    t.observaciones_cliente?.trim() && { titulo: "Observaciones", texto: t.observaciones_cliente.trim() },
    (t.proximo_control_km || t.recomendaciones_proximo_service) && {
      titulo: "Próximo service",
      texto: [t.proximo_control_km ? `A los ${t.proximo_control_km.toLocaleString("es-AR")} km.` : "", t.recomendaciones_proximo_service || ""].filter(Boolean).join(" "),
    },
    t.estado_cubiertas_trabajo?.trim() && { titulo: "Cubiertas", texto: t.estado_cubiertas_trabajo.trim() },
  ].filter(Boolean) as { titulo: string; texto: string }[];

  const cargaVisual = t.items.length + notas.length * 2 + Math.ceil((t.resumen_trabajos?.length ?? 0) / 180);
  const documentoCompacto = cargaVisual <= 8;
  const etiqueta = { fontSize: "9px", color: "#64748b", fontWeight: 500 } as const;
  const cantidad = (c: number) => (Number(c) % 1 === 0 ? Number(c) : c);
  const celda = { padding: "7px 0", borderBottom: "1px solid #f1f5f9" } as const;

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
            <div style={{ ...ANGOSTA, fontSize: "26px", lineHeight: 1, textTransform: "uppercase", letterSpacing: "-0.3px" }}>Orden de trabajo</div>
            <div style={{ marginTop: "4px", fontSize: "12px", fontWeight: 600, color: "#ea580c" }}>{num}</div>
            <div style={{ marginTop: "4px", fontSize: "9.5px", color: "#64748b" }}>Ingresó el {fechaLarga(t.fecha_ingreso)}</div>
          </div>
        </header>

        <main style={{ flex: 1, padding: "8mm 16mm 0" }}>
          {/* ── Cliente, vehículo y total ── */}
          <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.05fr", borderTop: "1px solid #e2e8f0", borderBottom: "1px solid #e2e8f0" }}>
            <div style={{ padding: "12px 14px 12px 0" }}>
              <div style={etiqueta}>Cliente</div>
              <div style={{ marginTop: "4px", fontSize: "13px", fontWeight: 700 }}>{t.cliente.nombre_completo}</div>
              <div style={{ marginTop: "3px", fontSize: "9.5px", lineHeight: 1.5, color: "#64748b" }}>
                {[t.cliente.telefono, t.cliente.email, t.cliente.dni && `DNI/CUIT ${t.cliente.dni}`].filter(Boolean).join(" · ") || "Sin datos de contacto"}
              </div>
            </div>
            <div style={{ padding: "12px 14px", borderLeft: "1px solid #e2e8f0" }}>
              <div style={etiqueta}>Vehículo</div>
              <div style={{ marginTop: "4px", fontSize: "13px", fontWeight: 700 }}>
                {t.vehiculo.marca} {t.vehiculo.modelo}
                {t.vehiculo.anio ? <span style={{ fontWeight: 400, color: "#64748b" }}> · {t.vehiculo.anio}</span> : null}
              </div>
              <div style={{ marginTop: "3px", fontSize: "9.5px", color: "#64748b" }}>
                Patente <span style={{ fontWeight: 600, color: "#334155", letterSpacing: "0.5px" }}>{t.vehiculo.patente}</span> · {t.kilometraje.toLocaleString("es-AR")} km al ingresar
              </div>
            </div>
            <div style={{ padding: "12px 0 12px 14px", borderLeft: "1px solid #e2e8f0", textAlign: "right", display: "flex", flexDirection: "column", justifyContent: "center" }}>
              <div style={etiqueta}>Total</div>
              <div style={{ ...ANGOSTA, fontSize: "30px", lineHeight: 1.05 }}>{formatCurrency(t.total)}</div>
              <div style={{ marginTop: "2px", fontSize: "9px", color: terminado ? "#047857" : "#64748b", fontWeight: terminado ? 600 : 400 }}>{estadoTexto}</div>
            </div>
          </section>

          {/* ── Qué se hizo ── */}
          <section style={{ marginTop: "8mm" }}>
            <div style={etiqueta}>{terminado ? "Trabajo realizado" : "Trabajo pedido"}</div>
            {t.resumen_trabajos && <div style={{ marginTop: "3px", fontSize: "17px", fontWeight: 700 }}>{t.resumen_trabajos}</div>}

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
                {grupos.map((grupo) => (
                  <Fragment key={grupo.tipo}>
                    <tr>
                      <td colSpan={4} style={{ padding: "10px 0 4px" }}>
                        <span style={{ color: grupo.color, fontSize: "9.5px", fontWeight: 700 }}>{grupo.label}</span>
                      </td>
                    </tr>
                    {grupo.items.map((item) => (
                      <tr key={item.id}>
                        <td style={{ ...celda, fontWeight: 500 }}>{item.descripcion}</td>
                        <td style={{ ...celda, textAlign: "center", color: "#475569" }}>{cantidad(item.cantidad)}</td>
                        <td style={{ ...celda, textAlign: "right", color: "#64748b" }}>{formatCurrency(item.precio_unitario)}</td>
                        <td style={{ ...celda, textAlign: "right", fontWeight: 600 }}>{formatCurrency(item.subtotal)}</td>
                      </tr>
                    ))}
                  </Fragment>
                ))}
                {t.items.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: "24px", textAlign: "center", color: "#94a3b8" }}>Sin ítems cargados en esta orden.</td></tr>
                )}
              </tbody>
            </table>
          </section>

          {/* ── Notas y totales ── */}
          <section style={{ marginTop: "7mm", display: "grid", gridTemplateColumns: "1fr 240px", gap: "24px", alignItems: "start" }}>
            <div style={{ fontSize: "9.5px", lineHeight: 1.6, color: "#64748b" }}>
              {notas.map((n) => (
                <div key={n.titulo} style={{ marginBottom: "8px" }}>
                  <div style={{ fontWeight: 600, color: "#334155" }}>{n.titulo}</div>
                  <div style={{ whiteSpace: "pre-line" }}>{n.texto}</div>
                </div>
              ))}
              {notas.length === 0 && <div>Gracias por confiarnos tu vehículo. Ante cualquier consulta, escribinos.</div>}
            </div>
            <div>
              {t.total_mano_obra > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "10px", color: "#64748b" }}><span>Mano de obra</span><span>{formatCurrency(t.total_mano_obra)}</span></div>
              )}
              {t.total_repuestos > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "10px", color: "#64748b" }}><span>Repuestos e insumos</span><span>{formatCurrency(t.total_repuestos)}</span></div>
              )}
              {t.descuento > 0 && (
                <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "10px", color: "#047857" }}><span>Descuento</span><span>− {formatCurrency(t.descuento)}</span></div>
              )}
              {ivaVisible(fiscal) && Number(t.total) > 0 && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", paddingTop: "6px", borderTop: "1px solid #e2e8f0", fontSize: "10px", color: "#64748b" }}><span>Neto gravado</span><span>{formatCurrency(desgloseIva(t.total).neto)}</span></div>
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "10px", color: "#64748b" }}><span>IVA 21%</span><span>{formatCurrency(desgloseIva(t.total).iva)}</span></div>
                </>
              )}
              <div style={{ marginTop: "6px", paddingTop: "8px", borderTop: "2px solid #0f172a", display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
                <span style={{ fontSize: "11px", fontWeight: 600 }}>Total{ivaVisible(fiscal) ? " (IVA incluido)" : ""}</span>
                <span style={{ ...ANGOSTA, fontSize: "24px" }}>{formatCurrency(t.total)}</span>
              </div>
            </div>
          </section>

          {/* ── Firmas: el papel se usa al entregar el auto ── */}
          <section style={{ marginTop: "14mm", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px" }}>
            {["Firma del cliente", "Aclaración y fecha de retiro"].map((texto) => (
              <div key={texto} style={{ borderTop: "1px solid #cbd5e1", paddingTop: "5px", fontSize: "8.5px", color: "#94a3b8" }}>{texto}</div>
            ))}
          </section>
        </main>

        <footer style={{ marginTop: documentoCompacto ? "10mm" : "auto", padding: "0 16mm 10mm" }}>
          <div style={{ height: "1px", background: "#e2e8f0" }} />
          <div style={{ marginTop: "8px", display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "24px", fontSize: "8.5px", color: "#94a3b8" }}>
            <div>
              {pieFiscal(fiscal) && <div style={{ marginBottom: "2px", color: "#64748b" }}>{pieFiscal(fiscal)}</div>}
              Orden {num} · Documento de servicio, no válido como factura.
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

const LINK_SVG = (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
  </svg>
);

// ─── Compartir portal del vehículo ────────────────────────────────────────────
function urlPortal(t: TrabajoDetalle, origen: string) {
  if (!origen || !t.vehiculo.token || t.vehiculo.portal_activo === false) return "";
  return `${origen}/p/vehiculo/${encodeURIComponent(t.vehiculo.token)}`;
}

/** Mensaje de WhatsApp según en qué anda el auto. */
function mensajeSegunEstado(t: TrabajoDetalle, tallerNombre: string, portal: string): string {
  const nombre = t.cliente.nombre_completo.split(" ")[0];
  const auto = `${t.vehiculo.marca} ${t.vehiculo.modelo}`.trim();
  const moneda = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
  const de = tallerNombre ? ` de ${tallerNombre}` : " del taller";
  const lineas: string[] = [];
  if (t.estado === "FINALIZADO") {
    lineas.push(`Hola ${nombre}! Te escribimos${de}: tu ${auto} ya está listo para retirar.`);
    if (t.total > 0) lineas.push(``, `Total: ${moneda.format(t.total)}`);
    if (portal) lineas.push(``, `Acá tenés el detalle de lo que le hicimos:`, portal);
    lineas.push(``, `¡Te esperamos!`);
  } else if (t.estado === "INGRESADO" || t.estado === "EN_PROCESO") {
    lineas.push(
      `Hola ${nombre}! Te escribimos${de} por tu ${auto}.`,
      t.estado === "EN_PROCESO" ? `Ya estamos trabajando en él y te avisamos apenas esté listo.` : `Ya lo recibimos y en breve empezamos. Te avisamos apenas esté listo.`,
    );
    if (portal) lineas.push(``, `Podés seguir cómo va desde acá:`, portal);
  } else {
    return buildWATexto(t, tallerNombre);
  }
  return lineas.join("\n");
}

const DIA_MS = 86_400_000;
const FLUJO = ["INGRESADO", "EN_PROCESO", "FINALIZADO", "ENTREGADO"] as const;

const TIPO_ITEM: Record<string, string> = {
  MANO_OBRA: "Mano de obra",
  REPUESTO: "Repuesto",
  INSUMO: "Insumo",
  OTRO: "Otro",
};

const PROXIMO_PASO: Record<string, { estado: string; label: string } | undefined> = {
  INGRESADO: { estado: "EN_PROCESO", label: "Empezar trabajo" },
  EN_PROCESO: { estado: "FINALIZADO", label: "Marcar listo" },
  FINALIZADO: { estado: "ENTREGADO", label: "Entregar" },
};

function fechaCorta(valor: string) {
  return new Date(valor).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
}

function tiempoEnTaller(desde: string) {
  const dias = Math.floor((Date.now() - new Date(desde).getTime()) / DIA_MS);
  if (dias <= 0) return "Ingresó hoy";
  if (dias === 1) return "Hace 1 día en el taller";
  return `Hace ${dias} días en el taller`;
}

const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios);

interface PasoPendiente {
  estado: string;
  titulo: string;
  texto: string;
  boton: string;
  peligro?: boolean;
  tildarTareas?: boolean;
  /** "Marcar listo": se repasa lo hecho y se puede sumar lo que faltó cargar. */
  cierre?: boolean;
}

// ─── Piezas de la vista ───────────────────────────────────────────────────────
/**
 * Carga rápida de algo que se hizo y no estaba en la orden ("le soldé el
 * escape"): una línea, Enter, y queda sumado y tildado. El precio es opcional;
 * se puede poner después desde la oficina.
 */
function AgregarRapido({
  onAgregar,
  conPrecio,
  autoFocus = false,
}: {
  onAgregar: (dato: { tipo: TrabajoItem["tipo"]; descripcion: string; precio: number }) => Promise<boolean>;
  conPrecio: boolean;
  autoFocus?: boolean;
}) {
  const [tipo, setTipo] = useState<TrabajoItem["tipo"]>("MANO_OBRA");
  const [descripcion, setDescripcion] = useState("");
  const [precio, setPrecio] = useState("");
  const [guardando, setGuardando] = useState(false);
  const ref = useRef<HTMLInputElement>(null);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (descripcion.trim().length < 2 || guardando) return;
    setGuardando(true);
    const ok = await onAgregar({ tipo, descripcion: descripcion.trim(), precio: Number.parseFloat(precio) || 0 });
    setGuardando(false);
    if (ok) {
      setDescripcion("");
      setPrecio("");
      ref.current?.focus();
    }
  }

  return (
    <form onSubmit={enviar} className="flex flex-wrap items-center gap-2">
      <div className="flex h-9 shrink-0 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-900" role="group" aria-label="Tipo">
        {([["MANO_OBRA", "Trabajo"], ["REPUESTO", "Repuesto"]] as const).map(([valor, texto]) => (
          <button
            key={valor}
            type="button"
            onClick={() => setTipo(valor)}
            aria-pressed={tipo === valor}
            className={cn("rounded-md px-2.5 text-xs font-semibold transition", tipo === valor ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400")}
          >
            {texto}
          </button>
        ))}
      </div>
      <input
        ref={ref}
        autoFocus={autoFocus}
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        placeholder={tipo === "MANO_OBRA" ? "Ej: Soldadura de escape" : "Ej: Abrazadera de escape"}
        aria-label="Qué se hizo"
        className="h-9 min-w-[180px] flex-1 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
      />
      {conPrecio && (
        <div className="relative w-28 shrink-0">
          <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            value={precio}
            onChange={(e) => setPrecio(e.target.value)}
            placeholder="Precio"
            aria-label="Precio (opcional)"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-6 pr-2 text-right text-sm tabular-nums text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 [appearance:textfield] dark:border-slate-700 dark:bg-slate-900 dark:text-white [&::-webkit-inner-spin-button]:appearance-none"
          />
        </div>
      )}
      <button type="submit" disabled={descripcion.trim().length < 2 || guardando} className="inline-flex h-9 shrink-0 items-center rounded-lg bg-slate-900 px-3.5 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:opacity-40 dark:bg-white dark:text-slate-900">
        {guardando ? "Agregando…" : "Agregar"}
      </button>
    </form>
  );
}

/** Precio de un ítem que se toca para corregirlo; si está en $0 invita a ponerlo. */
function PrecioEditable({ item, onGuardar }: { item: TrabajoItem; onGuardar: (precio: number) => Promise<void> }) {
  const [editando, setEditando] = useState(false);
  const [valor, setValor] = useState("");
  const sinPrecio = Number(item.precio_unitario) === 0;

  async function guardar() {
    setEditando(false);
    const nuevo = Number.parseFloat(valor);
    if (Number.isFinite(nuevo) && nuevo >= 0 && nuevo !== Number(item.precio_unitario)) await onGuardar(nuevo);
  }

  if (editando) {
    return (
      <span className="relative w-28 shrink-0" onClick={(e) => e.preventDefault()}>
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
        <input
          autoFocus
          type="number"
          inputMode="decimal"
          min="0"
          step="any"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          onBlur={() => void guardar()}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void guardar(); } if (e.key === "Escape") setEditando(false); }}
          aria-label="Precio unitario"
          className="h-8 w-full rounded-lg border border-brand-500 bg-white pl-6 pr-2 text-right text-sm tabular-nums text-slate-900 outline-none ring-4 ring-brand-500/10 [appearance:textfield] dark:bg-slate-900 dark:text-white [&::-webkit-inner-spin-button]:appearance-none"
        />
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); setValor(sinPrecio ? "" : String(item.precio_unitario)); setEditando(true); }}
      title="Tocá para cambiar el precio"
      className={cn(
        "shrink-0 rounded-md px-1.5 py-0.5 text-sm tabular-nums transition",
        sinPrecio ? "font-semibold text-amber-700 ring-1 ring-inset ring-amber-300 hover:bg-amber-50 dark:text-amber-300 dark:ring-amber-800" : "font-semibold text-slate-900 hover:bg-slate-100 dark:text-white dark:hover:bg-slate-700",
      )}
    >
      {sinPrecio ? "Poner precio" : formatCurrency(item.subtotal)}
    </button>
  );
}
function BotonWhatsApp({ texto, telefono, etiqueta = "WhatsApp", className }: { texto: string; telefono?: string | null; etiqueta?: string; className?: string }) {
  const url = buildWhatsAppUrl(texto, telefono);
  const clase = cn(
    "inline-flex h-9 items-center justify-center gap-2 rounded-xl px-3.5 text-sm font-semibold transition",
    url
      ? "bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-300 dark:ring-emerald-900"
      : "cursor-not-allowed bg-slate-50 text-slate-400 ring-1 ring-inset ring-slate-200 dark:bg-slate-800 dark:ring-slate-700",
    className,
  );
  if (!url) {
    return <span className={clase} title="Cargá un celular válido en la ficha del cliente" aria-disabled="true">{WA_SVG}{etiqueta}</span>;
  }
  return <a href={url} target="_blank" rel="noopener noreferrer" className={clase}>{WA_SVG}{etiqueta}</a>;
}

function Dato({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="min-w-0">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-0.5 truncate text-sm font-semibold text-slate-900 dark:text-white">{valor}</p>
    </div>
  );
}

function FilaTotal({ label, valor, fuerte = false, negativo = false }: { label: string; valor: number; fuerte?: boolean; negativo?: boolean }) {
  return (
    <div className={cn("flex items-baseline justify-between gap-6", fuerte ? "pt-2 text-base font-bold text-slate-900 dark:text-white" : "text-sm text-slate-600 dark:text-slate-300")}>
      <span>{label}</span>
      <span className={cn("tabular-nums", negativo && "text-emerald-700 dark:text-emerald-400")}>{negativo ? "− " : ""}{formatCurrency(valor)}</span>
    </div>
  );
}

function MenuMas({ items }: { items: { texto: string; href?: string; onClick?: () => void; peligro?: boolean }[] }) {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setAbierto(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setAbierto(false); };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", tecla); };
  }, [abierto]);
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        className={cn("inline-flex h-9 items-center gap-1 rounded-xl px-3 text-sm font-semibold transition", abierto ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-600 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 dark:text-slate-300 dark:ring-slate-700 dark:hover:bg-slate-800")}
      >
        Más
        <svg className={cn("h-3.5 w-3.5 transition-transform", abierto && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
      </button>
      {abierto && (
        <div role="menu" className="absolute right-0 top-full z-40 mt-1.5 w-60 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-800">
          {items.map((item) => {
            const clase = cn("block w-full px-3.5 py-2 text-left text-sm transition", item.peligro ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30" : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/60");
            return item.href ? (
              <Link key={item.texto} href={item.href} role="menuitem" className={clase}>{item.texto}</Link>
            ) : (
              <button key={item.texto} type="button" role="menuitem" onClick={() => { setAbierto(false); item.onClick?.(); }} className={clase}>{item.texto}</button>
            );
          })}
        </div>
      )}
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
  const [paso, setPaso] = useState<PasoPendiente | null>(null);
  const [agregando, setAgregando] = useState(false);
  const [modoPreview, setModoPreview] = useState(false);
  const [generandoPDF, setGenerandoPDF] = useState(false);
  const [origen, setOrigen] = useState("");
  const [tallerNombre, setTallerNombre] = useState("");
  const [tallerCiudad, setTallerCiudad] = useState("");
  const [tallerTel, setTallerTel] = useState("");
  const [tallerCuit, setTallerCuit] = useState("");
  const [fiscal, setFiscal] = useState<DatosFiscales>(FISCAL_VACIO);
  const [tallerLogoUrl, setTallerLogoUrl] = useState<string | null>(null);
  const [role, setRole] = useState<"ADMIN" | "RECEPCION" | "MECANICO" | "CONTADOR" | null>(null);

  useEffect(() => {
    const session = getSession();
    setOrigen(window.location.origin);
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
          setFiscal(datosFiscalesDe(perfil));
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

  // Esc cierra la vista previa del documento.
  useEffect(() => {
    if (!modoPreview) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") setModoPreview(false); };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [modoPreview]);

  function mostrarNotificacion(msg: string, isError = false) {
    setNotificacion({ msg, isError });
    setTimeout(() => setNotificacion({ msg: "", isError: false }), 3000);
  }

  async function handleEstado(nuevoEstado: string) {
    if (!trabajo) return;
    const backup = trabajo.estado;
    setTrabajo((actual) => (actual ? { ...actual, estado: nuevoEstado } : actual));
    setCambiandoEstado(true);
    try {
      await actualizarEstadoTrabajo(trabajoId, nuevoEstado);
      mostrarNotificacion(`Ahora está en "${ESTADO_TRABAJO_LABEL[nuevoEstado as keyof typeof ESTADO_TRABAJO_LABEL] ?? nuevoEstado}".`);
    } catch (error) {
      setTrabajo((actual) => (actual ? { ...actual, estado: backup } : actual));
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
        item.id === itemId ? { ...item, completado, completado_en: completado ? new Date().toISOString() : null } : item,
      ),
    });
    try {
      await actualizarItemTrabajo(trabajo.id, itemId, completado);
    } catch (error) {
      setTrabajo(backup);
      mostrarNotificacion(error instanceof Error ? error.message : "No se pudo actualizar la tarea.", true);
    }
  }

  async function recargar() {
    try {
      setTrabajo(await getTrabajoById(trabajoId));
    } catch {
      // Si falla, queda lo que se ve; el próximo cambio vuelve a intentar.
    }
  }

  async function agregarRapido(dato: { tipo: TrabajoItem["tipo"]; descripcion: string; precio: number }) {
    if (!trabajo) return false;
    try {
      await agregarItemTrabajo(trabajo.id, { tipo: dato.tipo, descripcion: dato.descripcion, precio_unitario: dato.precio, completado: true });
      await recargar();
      mostrarNotificacion(`Agregado: ${dato.descripcion}`);
      return true;
    } catch (error) {
      mostrarNotificacion(error instanceof Error ? error.message : "No se pudo agregar.", true);
      return false;
    }
  }

  async function cambiarPrecio(itemId: number, precio: number) {
    if (!trabajo) return;
    try {
      await precioItemTrabajo(trabajo.id, itemId, { precio_unitario: precio });
      await recargar();
    } catch (error) {
      mostrarNotificacion(error instanceof Error ? error.message : "No se pudo cambiar el precio.", true);
    }
  }

  /** Antes de cambiar de etapa, frena los pasos que conviene confirmar. */
  function pedirCambio(estado: string) {
    if (!trabajo) return;
    const pendientes = trabajo.items.filter((i) => !i.completado).length;
    const actual = FLUJO.indexOf(trabajo.estado as (typeof FLUJO)[number]);
    const destino = FLUJO.indexOf(estado as (typeof FLUJO)[number]);
    const label = ESTADO_TRABAJO_LABEL[estado as keyof typeof ESTADO_TRABAJO_LABEL] ?? estado;

    if (estado === "ANULADO") {
      return setPaso({ estado, titulo: "¿Anular la orden?", texto: "La orden queda cerrada y no se puede volver a abrir. El historial se conserva.", boton: "Anular orden", peligro: true });
    }
    if (destino >= 0 && destino < actual) {
      return setPaso({ estado, titulo: `¿Volver a "${label}"?`, texto: "El cliente ve el cambio en su portal.", boton: `Volver a ${label.toLowerCase()}` });
    }
    if (estado === "FINALIZADO") {
      return setPaso({
        estado,
        titulo: "¿Está todo listo?",
        texto: pendientes > 0
          ? `${plural(pendientes, "Queda 1 tarea sin tildar: se tilda", `Quedan ${pendientes} tareas sin tildar: se tildan`)} al confirmar.`
          : "Repasá lo que se hizo. Si quedó algo sin cargar, sumalo acá abajo.",
        boton: "Todo listo →",
        tildarTareas: true,
        cierre: true,
      });
    }
    if (estado === "ENTREGADO" && pendientes > 0) {
      return setPaso({
        estado,
        titulo: `${plural(pendientes, "Queda 1 tarea", `Quedan ${pendientes} tareas`)} sin tildar`,
        texto: `Si ya ${plural(pendientes, "está hecha", "están hechas")}, la${plural(pendientes, "", "s")} tildamos y pasamos la orden a "${label}".`,
        boton: estado === "ENTREGADO" ? "Tildar y entregar" : "Tildar y marcar listo",
        tildarTareas: true,
      });
    }
    void handleEstado(estado);
  }

  async function confirmarPaso() {
    if (!trabajo || !paso) return;
    const { estado, tildarTareas } = paso;
    setPaso(null);
    if (tildarTareas) {
      const pendientes = trabajo.items.filter((i) => !i.completado);
      try {
        setCambiandoEstado(true);
        await Promise.all(pendientes.map((i) => actualizarItemTrabajo(trabajo.id, i.id, true)));
        setTrabajo((actual) => actual && {
          ...actual,
          items: actual.items.map((i) => (i.completado ? i : { ...i, completado: true, completado_en: new Date().toISOString() })),
        });
      } catch (error) {
        setCambiandoEstado(false);
        return mostrarNotificacion(error instanceof Error ? error.message : "No pudimos tildar las tareas.", true);
      }
    }
    await handleEstado(estado);
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

  async function copiarPortal() {
    if (!trabajo) return;
    const url = urlPortal(trabajo, origen);
    if (!url) return mostrarNotificacion("Este vehículo no tiene el portal activo.", true);
    void renovarPortalVehiculo(trabajo.vehiculo.id).catch(() => {});
    if (await copiarAlPortapapeles(url)) mostrarNotificacion("Link del portal copiado.");
    else window.prompt("Copiá el link:", url);
  }

  async function descargarPDF() {
    if (!trabajo) return;
    setGenerandoPDF(true);
    const fileName = `${numeroOrden(trabajo.id)}.pdf`;
    // En mobile, A4PreviewScaler achica el documento para que entre en
    // pantalla — pero el PDF tiene que salir siempre a resolución completa.
    const restaurarEscala = suspenderEscalaA4();
    try {
      const [{ toJpeg }, { jsPDF }] = await Promise.all([import("html-to-image"), import("jspdf")]);
      const el = document.getElementById("doc-ot");
      if (!el) throw new Error("Elemento del documento no encontrado");
      await esperarRecursosDocumento(el);
      // La letra Archivo va embebida aparte: leer todas las hojas de estilo colgaba la captura.
      const fontEmbedCSS = await fuenteArchivoEmbebida();
      const opts = { quality: 0.93, backgroundColor: "#ffffff", pixelRatio: 2, skipFonts: !fontEmbedCSS, fontEmbedCSS, cacheBust: true };

      // La pasada de preparación mejora la captura, pero nunca debe dejar la UI
      // bloqueada si el navegador no termina de resolver una fuente o imagen.
      await Promise.race([
        toJpeg(el, opts).catch(() => null),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 3_500)),
      ]);
      const dataUrl = await Promise.race([
        toJpeg(el, opts),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout al generar imagen")), 10_000)),
      ]);

      const img = new Image();
      img.src = dataUrl;
      await new Promise((r) => { img.onload = r; });

      const imgH = (img.naturalHeight * 210) / img.naturalWidth;
      const esCompacto = el.dataset.compact === "true" && imgH < 250;
      const altoCompacto = Math.max(135, Math.ceil(imgH));
      const pdf = esCompacto
        ? new jsPDF({ orientation: altoCompacto < 210 ? "landscape" : "portrait", unit: "mm", format: [210, altoCompacto] })
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

      // Solo abrir el selector nativo en dispositivos táctiles.
      const esDispositivoMovil = navigator.maxTouchPoints > 0 && window.matchMedia("(pointer: coarse)").matches;
      if (esDispositivoMovil && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: buildWATexto(trabajo, tallerNombre), title: fileName });
          return;
        } catch (e: unknown) {
          if (e instanceof Error && e.name === "AbortError") return;
        }
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      mostrarNotificacion("PDF descargado.");
    } catch (e: unknown) {
      console.error("[PDF]", e);
      mostrarNotificacion("No se pudo generar el PDF. Probá de nuevo o mandá el resumen por WhatsApp.", true);
    } finally {
      restaurarEscala();
      setGenerandoPDF(false);
    }
  }

  // ── Cargando ──
  if (loading) {
    return (
      <AppShell currentPath="/trabajos" compact title="Cargando orden…" description="">
        <div className="flex h-[50vh] items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
        </div>
      </AppShell>
    );
  }

  // ── Error ──
  if (error || !trabajo) {
    return (
      <AppShell currentPath="/trabajos" compact title="No encontrada" description="">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-8 text-center dark:border-red-900/50 dark:bg-red-950/20">
          <p className="font-semibold text-red-800 dark:text-red-400">{error || "La orden no existe o fue eliminada."}</p>
          <Link href="/trabajos" className="mt-4 inline-block text-sm font-semibold text-red-700 underline dark:text-red-400">← Volver a las órdenes</Link>
        </div>
      </AppShell>
    );
  }

  const portal = urlPortal(trabajo, origen);
  const textoWA = mensajeSegunEstado(trabajo, tallerNombre, portal);

  // ── Vista previa A4 ──
  if (modoPreview) {
    return (
      <div className="min-h-screen bg-slate-200/80 dark:bg-slate-900">
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
              <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">Orden {numeroOrden(trabajo.id)}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{trabajo.vehiculo.marca} {trabajo.vehiculo.modelo} · {trabajo.cliente.nombre_completo}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex h-9 overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800" role="group" aria-label="Papel">
                <button type="button" onClick={() => window.print()} className="inline-flex items-center gap-2 px-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 9V3h12v6M6 18H4a1 1 0 01-1-1v-6a2 2 0 012-2h14a2 2 0 012 2v6a1 1 0 01-1 1h-2M6 14h12v7H6z" /></svg>
                  Imprimir
                </button>
                <button type="button" onClick={descargarPDF} disabled={generandoPDF} className="inline-flex items-center gap-2 border-l border-slate-200 px-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700">
                  {generandoPDF ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700" /> : PDF_SVG}
                  {generandoPDF ? "Generando…" : "Descargar PDF"}
                </button>
              </div>
              <BotonWhatsApp texto={textoWA} telefono={trabajo.cliente.telefono} />
            </div>
          </div>
        </div>
        <div className="flex justify-center px-3 py-6 print:block print:p-0 sm:py-10">
          <A4PreviewScaler>
            <div className="shadow-2xl ring-1 ring-slate-900/10 print:shadow-none print:ring-0">
              <DocumentoA4 t={trabajo} tallerNombre={tallerNombre} tallerCiudad={tallerCiudad} tallerTel={tallerTel} tallerCuit={tallerCuit} tallerLogoUrl={tallerLogoUrl} fiscal={fiscal} />
            </div>
          </A4PreviewScaler>
        </div>
      </div>
    );
  }

  // ── Vista operativa ──
  const permiteGestion = role === "ADMIN" || role === "RECEPCION";
  const mostrarImportes = permiteGestion;
  const anulada = trabajo.estado === "ANULADO";
  const ordenCerrada = trabajo.estado === "ENTREGADO" || anulada;
  const hechas = trabajo.items.filter((item) => item.completado).length;
  const pendientes = trabajo.items.length - hechas;
  const porcentaje = trabajo.items.length ? Math.round((hechas / trabajo.items.length) * 100) : 0;
  const permitidos = (TRANSICIONES[trabajo.estado] ?? []).filter((e) => permiteGestion || (e !== "ENTREGADO" && e !== "ANULADO"));
  const siguiente = PROXIMO_PASO[trabajo.estado];
  const proximo = siguiente && permitidos.includes(siguiente.estado) ? siguiente : undefined;
  const etapaActual = FLUJO.indexOf(trabajo.estado as (typeof FLUJO)[number]);
  const saldoCliente = Number(trabajo.cliente.saldo_balance ?? 0);
  const notasCliente = trabajo.observaciones_cliente?.trim();
  const notasInternas = trabajo.observaciones_internas?.trim();
  const hayProximoService = Boolean(trabajo.proximo_control_km || trabajo.recomendaciones_proximo_service);

  const itemsMas = [
    ...(permiteGestion ? [{ texto: "Descargar PDF", onClick: () => { setModoPreview(true); } }] : []),
    ...(portal ? [{ texto: "Copiar link del portal", onClick: () => void copiarPortal() }] : []),
    { texto: "Historial del vehículo", href: `/vehiculos/${trabajo.vehiculo.id}/historial` },
    ...(permiteGestion ? [{ texto: "Ficha del cliente", href: `/clientes?id=${trabajo.cliente.id}` }] : []),
    ...(permitidos.includes("ANULADO") ? [{ texto: "Anular orden", onClick: () => pedirCambio("ANULADO"), peligro: true }] : []),
    ...(permiteGestion ? [{ texto: "Eliminar", onClick: () => setConfirmandoBorrado(true), peligro: true }] : []),
  ];

  return (
    <AppShell
      compact
      currentPath="/trabajos"
      badge={numeroOrden(trabajo.id)}
      title={`${trabajo.vehiculo.marca} ${trabajo.vehiculo.modelo}`}
      description={`${numeroOrden(trabajo.id)} · ${trabajo.vehiculo.patente} · ${trabajo.cliente.nombre_completo}`}
      actions={
        <div className="flex flex-wrap items-center gap-2">
          {permiteGestion && !anulada && (
            <Link href={`/trabajos/nuevo?id=${trabajo.id}`} title="Cambiar tareas, repuestos, precios, km o notas" className="inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M16.86 4.49l2.65 2.65M4 20l4.5-1 10.3-10.3a1.87 1.87 0 00-2.65-2.65L5.85 16.35 4 20z" /></svg>
              Editar
            </Link>
          )}
          {permiteGestion && (
            <button type="button" onClick={() => setModoPreview(true)} className="inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-800">
              {PDF_SVG}
              Ver PDF
            </button>
          )}
          {permiteGestion && <BotonWhatsApp texto={textoWA} telefono={trabajo.cliente.telefono} etiqueta={trabajo.estado === "FINALIZADO" ? "Avisar que está listo" : "WhatsApp"} />}
          {proximo && (
            <button
              type="button"
              onClick={() => pedirCambio(proximo.estado)}
              disabled={cambiandoEstado}
              className="inline-flex h-9 items-center rounded-xl bg-brand-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60"
            >
              {proximo.label} →
            </button>
          )}
          <MenuMas items={itemsMas} />
        </div>
      }
    >
      {notificacion.msg && (
        <div role="status" className={cn("fixed bottom-6 right-6 z-[80] max-w-sm rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-2xl", notificacion.isError ? "bg-red-600" : "bg-slate-900 dark:bg-slate-700")}>
          {notificacion.msg}
        </div>
      )}

      {/* Etapas: se pueden tocar las que corresponden */}
      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        {anulada ? (
          <div className="flex items-center gap-3 px-5 py-4">
            <span className="inline-flex rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900">Anulada</span>
            <p className="text-sm text-slate-600 dark:text-slate-300">Esta orden se anuló. Queda solo para consulta.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 p-2 lg:flex-row lg:items-center">
            <ol className="grid flex-1 grid-cols-2 gap-1 sm:grid-cols-4">
              {FLUJO.map((estado, index) => {
                const activa = index === etapaActual;
                const completa = index < etapaActual;
                const tocable = permitidos.includes(estado) && !cambiandoEstado;
                const label = ESTADO_TRABAJO_LABEL[estado];
                return (
                  <li key={estado}>
                    <button
                      type="button"
                      disabled={!tocable}
                      onClick={() => pedirCambio(estado)}
                      title={tocable ? `Pasar a "${label}"` : undefined}
                      className={cn(
                        "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition",
                        activa ? "bg-brand-50 dark:bg-brand-950/30" : tocable ? "hover:bg-slate-50 dark:hover:bg-slate-700/40" : "cursor-default",
                      )}
                    >
                      <span className={cn(
                        "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold",
                        activa ? "bg-brand-600 text-white" : completa ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-400 dark:bg-slate-700",
                      )}>
                        {completa ? "✓" : index + 1}
                      </span>
                      <span className={cn("truncate text-sm", activa ? "font-semibold text-brand-700 dark:text-brand-300" : completa ? "text-slate-700 dark:text-slate-200" : "text-slate-500 dark:text-slate-400")}>{label}</span>
                    </button>
                  </li>
                );
              })}
            </ol>
            <p className="px-3 pb-1 text-xs text-slate-500 dark:text-slate-400 lg:pb-0 lg:text-right">
              {trabajo.estado === "ENTREGADO" && trabajo.finalizado_en ? `Entregado el ${fechaCorta(trabajo.finalizado_en)}` : tiempoEnTaller(trabajo.fecha_ingreso)}
              {trabajo.responsable_nombre ? ` · ${trabajo.responsable_nombre}` : ""}
            </p>
          </div>
        )}
      </section>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <main className="min-w-0 space-y-4">
          {/* Trabajo + tareas + totales */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="px-5 pt-5 sm:px-6">
              <p className="text-xs text-slate-500 dark:text-slate-400">Trabajo pedido</p>
              <h2 className="mt-1 font-display text-2xl font-extrabold leading-tight text-slate-900 dark:text-white">
                {trabajo.resumen_trabajos || "Sin descripción cargada"}
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 py-4 dark:border-slate-700 sm:grid-cols-4">
                <Dato label="Kilometraje" valor={`${formatNumber(trabajo.kilometraje)} km`} />
                <Dato label="Ingresó" valor={fechaCorta(trabajo.fecha_ingreso)} />
                <Dato label="Entrega estimada" valor={trabajo.fecha_egreso_estimado ? formatDate(trabajo.fecha_egreso_estimado) : "Sin definir"} />
                <Dato label="Mecánico" valor={trabajo.responsable_nombre || "Sin asignar"} />
              </div>
            </div>

            <div className="border-t border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-4 px-5 py-3 sm:px-6">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Tareas</h3>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-700">
                  <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${porcentaje}%` }} />
                </div>
                <span className="shrink-0 text-xs tabular-nums text-slate-500 dark:text-slate-400">{hechas} de {trabajo.items.length} {plural(trabajo.items.length, "hecha", "hechas")}</span>
                {permiteGestion && !ordenCerrada && (
                  <Link href={`/trabajos/nuevo?id=${trabajo.id}`} className="shrink-0 text-xs font-semibold text-brand-600 hover:text-brand-700">Editar lista</Link>
                )}
              </div>

              {trabajo.items.length ? (
                <ul className="divide-y divide-slate-100 border-t border-slate-100 dark:divide-slate-700/70 dark:border-slate-700">
                  {trabajo.items.map((item) => (
                    <li key={item.id}>
                      <label className={cn("flex items-center gap-3.5 px-5 py-3 transition sm:px-6", ordenCerrada ? "cursor-default" : "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/30")}>
                        <input
                          type="checkbox"
                          checked={item.completado}
                          disabled={ordenCerrada}
                          onChange={(e) => handleItem(item.id, e.target.checked)}
                          className="h-5 w-5 shrink-0 rounded border-slate-300 accent-emerald-600"
                        />
                        <span className="min-w-0 flex-1">
                          <span className={cn("block text-sm font-medium text-slate-900 dark:text-white", item.completado && "text-slate-400 line-through dark:text-slate-500")}>{item.descripcion}</span>
                          <span className="block text-xs text-slate-500 dark:text-slate-400">
                            {TIPO_ITEM[item.tipo] ?? item.tipo}{Number(item.cantidad) !== 1 ? ` · ${formatNumber(Number(item.cantidad))} u.` : ""}
                          </span>
                        </span>
                        {mostrarImportes && (ordenCerrada
                          ? <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-900 dark:text-white">{formatCurrency(item.subtotal)}</span>
                          : <PrecioEditable item={item} onGuardar={(precio) => cambiarPrecio(item.id, precio)} />)}
                      </label>
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="border-t border-slate-100 px-6 py-8 text-center dark:border-slate-700">
                  <p className="text-sm text-slate-500">No hay tareas cargadas.</p>
                  {permiteGestion && <Link href={`/trabajos/nuevo?id=${trabajo.id}`} className="mt-1 inline-block text-sm font-semibold text-brand-600">Agregar tareas →</Link>}
                </div>
              )}

              {!ordenCerrada && (
                <div className="border-t border-slate-100 px-5 py-3 dark:border-slate-700 sm:px-6">
                  {agregando ? (
                    <div className="space-y-2">
                      <AgregarRapido onAgregar={agregarRapido} conPrecio={mostrarImportes} autoFocus />
                      <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                        <span>Se agrega ya tildado{mostrarImportes ? ". El precio lo podés poner después." : "."}</span>
                        <button type="button" onClick={() => setAgregando(false)} className="font-semibold hover:text-slate-800 dark:hover:text-white">Listo</button>
                      </div>
                    </div>
                  ) : (
                    <button type="button" onClick={() => setAgregando(true)} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-300">
                      <span className="text-base leading-none">+</span> Agregar algo que se hizo
                    </button>
                  )}
                </div>
              )}

              {ordenCerrada && pendientes > 0 && !anulada && (
                <p className="border-t border-slate-100 px-6 py-2.5 text-xs text-slate-500 dark:border-slate-700">Orden cerrada antes de que se usara el tildado de tareas.</p>
              )}
            </div>

            {mostrarImportes && trabajo.items.length > 0 && (
              <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4 dark:border-slate-700 dark:bg-slate-900/30 sm:px-6">
                <div className="ml-auto max-w-xs space-y-1.5">
                  {trabajo.total_mano_obra > 0 && <FilaTotal label="Mano de obra" valor={trabajo.total_mano_obra} />}
                  {trabajo.total_repuestos > 0 && <FilaTotal label="Repuestos" valor={trabajo.total_repuestos} />}
                  {trabajo.descuento > 0 && <FilaTotal label="Descuento" valor={trabajo.descuento} negativo />}
                  <div className="border-t border-slate-200 dark:border-slate-700">
                    <FilaTotal label="Total" valor={trabajo.total} fuerte />
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Notas */}
          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="flex items-center justify-between px-5 py-3.5 sm:px-6">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Notas</h3>
              {permiteGestion && !ordenCerrada && <Link href={`/trabajos/nuevo?id=${trabajo.id}`} className="text-xs font-semibold text-brand-600 hover:text-brand-700">Editar</Link>}
            </div>
            {notasCliente || notasInternas || hayProximoService || trabajo.estado_cubiertas_trabajo ? (
              <div className="grid gap-x-6 gap-y-4 border-t border-slate-100 px-5 py-4 dark:border-slate-700 sm:grid-cols-2 sm:px-6">
                {notasCliente && (
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Para el cliente</p>
                    <p className="mt-1 whitespace-pre-line text-sm text-slate-800 dark:text-slate-200">{notasCliente}</p>
                  </div>
                )}
                {notasInternas && (
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Internas (no las ve el cliente)</p>
                    <p className="mt-1 whitespace-pre-line text-sm text-slate-800 dark:text-slate-200">{notasInternas}</p>
                  </div>
                )}
                {hayProximoService && (
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Próximo service</p>
                    {trabajo.proximo_control_km ? <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">A los {formatNumber(trabajo.proximo_control_km)} km</p> : null}
                    {trabajo.recomendaciones_proximo_service && <p className="mt-0.5 text-sm text-slate-600 dark:text-slate-300">{trabajo.recomendaciones_proximo_service}</p>}
                  </div>
                )}
                {trabajo.estado_cubiertas_trabajo && (
                  <div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Cubiertas</p>
                    <p className="mt-1 text-sm text-slate-800 dark:text-slate-200">{trabajo.estado_cubiertas_trabajo}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="border-t border-slate-100 px-5 py-4 text-sm text-slate-400 dark:border-slate-700 sm:px-6">Sin notas para esta orden.</p>
            )}
          </section>
        </main>

        <aside className="space-y-4 lg:sticky lg:top-24">
          {mostrarImportes && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
              <p className="text-xs text-slate-500 dark:text-slate-400">Total de la orden</p>
              <p className="mt-1 font-display text-4xl font-extrabold leading-none tabular-nums text-slate-900 dark:text-white">{formatCurrency(trabajo.total)}</p>
              {trabajo.descuento > 0 && <p className="mt-1.5 text-xs text-emerald-700 dark:text-emerald-400">Incluye {formatCurrency(trabajo.descuento)} de descuento</p>}
              {trabajo.total > 0 && !anulada && (
                <Link href={`/pagos/registrar?cliente=${trabajo.cliente.id}`} className="mt-4 flex h-10 w-full items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700">
                  Cobrar
                </Link>
              )}
              {saldoCliente > 0 && (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  La cuenta del cliente tiene {formatCurrency(saldoCliente)} pendientes.
                </p>
              )}
            </section>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <div className="p-5">
              <p className="text-xs text-slate-500 dark:text-slate-400">Cliente</p>
              <p className="mt-1 font-semibold text-slate-900 dark:text-white">{trabajo.cliente.nombre_completo}</p>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">{trabajo.cliente.telefono || "Sin teléfono"}{trabajo.cliente.email ? ` · ${trabajo.cliente.email}` : ""}</p>
              {permiteGestion && (
                <div className="mt-3 flex gap-2">
                  <BotonWhatsApp texto={textoWA} telefono={trabajo.cliente.telefono} className="flex-1" />
                  <Link href={`/clientes?id=${trabajo.cliente.id}`} className="inline-flex h-9 flex-1 items-center justify-center rounded-xl text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-700">Ver ficha</Link>
                </div>
              )}
            </div>
            <div className="border-t border-slate-100 p-5 dark:border-slate-700">
              <p className="text-xs text-slate-500 dark:text-slate-400">Vehículo</p>
              <p className="mt-1 font-semibold text-slate-900 dark:text-white">{trabajo.vehiculo.marca} {trabajo.vehiculo.modelo}{trabajo.vehiculo.anio ? ` ${trabajo.vehiculo.anio}` : ""}</p>
              <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                {[trabajo.vehiculo.patente, trabajo.vehiculo.color, trabajo.estado_general ? `estado ${trabajo.estado_general.toLowerCase()}` : ""].filter(Boolean).join(" · ")}
              </p>
              <div className="mt-3 flex gap-2">
                <Link href={`/vehiculos/${trabajo.vehiculo.id}/historial`} className="inline-flex h-9 flex-1 items-center justify-center rounded-xl text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-700">Historial</Link>
                {portal && (
                  <button type="button" onClick={() => void copiarPortal()} className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-xl text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-700">
                    {LINK_SVG}
                    Link del portal
                  </button>
                )}
              </div>
            </div>
          </section>
        </aside>
      </div>

      {paso && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className={cn("w-full rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800", paso.cierre ? "max-w-xl" : "max-w-sm")}>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">{paso.titulo}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{paso.texto}</p>
            {paso.cierre && (
              <>
                <ul className="mt-4 max-h-48 space-y-1.5 overflow-y-auto rounded-xl bg-slate-50 p-3 dark:bg-slate-900/50">
                  {trabajo.items.map((item) => (
                    <li key={item.id} className="flex items-center gap-2 text-sm">
                      <span className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded text-[10px] text-white", item.completado ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-600")}>✓</span>
                      <span className="min-w-0 flex-1 truncate text-slate-800 dark:text-slate-200">{item.descripcion}</span>
                      {mostrarImportes && <span className="shrink-0 tabular-nums text-slate-500">{Number(item.precio_unitario) === 0 ? "sin precio" : formatCurrency(item.subtotal)}</span>}
                    </li>
                  ))}
                  {trabajo.items.length === 0 && <li className="text-sm text-slate-500">Todavía no hay nada cargado.</li>}
                </ul>
                <div className="mt-4">
                  <p className="mb-2 text-sm font-semibold text-slate-900 dark:text-white">¿Hiciste algo más que no está en la lista?</p>
                  <AgregarRapido onAgregar={agregarRapido} conPrecio={mostrarImportes} />
                </div>
                {mostrarImportes && (
                  <div className="mt-4 flex items-baseline justify-between border-t border-slate-100 pt-3 dark:border-slate-700">
                    <span className="text-sm text-slate-600 dark:text-slate-300">Total</span>
                    <span className="font-display text-2xl font-extrabold tabular-nums text-slate-900 dark:text-white">{formatCurrency(trabajo.total)}</span>
                  </div>
                )}
              </>
            )}
            <div className="mt-6 flex gap-2">
              <button type="button" onClick={() => setPaso(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300">Cancelar</button>
              <button type="button" onClick={() => void confirmarPaso()} className={cn("flex-1 rounded-xl py-2.5 text-sm font-semibold text-white", paso.peligro ? "bg-red-600 hover:bg-red-700" : "bg-brand-600 hover:bg-brand-700")}>{paso.boton}</button>
            </div>
          </div>
        </div>
      )}

      {confirmandoBorrado && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">¿Eliminar la {numeroOrden(trabajo.id)}?</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">La orden desaparece de la operación. Los cobros ya registrados se conservan.</p>
            <div className="mt-6 flex gap-2">
              <button type="button" onClick={() => setConfirmandoBorrado(false)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300">Cancelar</button>
              <button type="button" onClick={handleEliminar} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
