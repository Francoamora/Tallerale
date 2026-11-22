import type { PerfilTallerData } from "@/lib/api";

/** Lo fiscal del taller que sale en presupuestos y órdenes. */
export type DatosFiscales = Pick<PerfilTallerData, "razon_social" | "condicion_iva" | "domicilio_fiscal" | "ingresos_brutos" | "inicio_actividades" | "mostrar_iva">;

export const FISCAL_VACIO: DatosFiscales = {};

const CONDICION: Record<string, string> = {
  MONOTRIBUTO: "Monotributo",
  RESPONSABLE_INSCRIPTO: "IVA Responsable inscripto",
  EXENTO: "IVA Exento",
};

export function datosFiscalesDe(perfil: PerfilTallerData): DatosFiscales {
  return {
    razon_social: perfil.razon_social,
    condicion_iva: perfil.condicion_iva,
    domicilio_fiscal: perfil.domicilio_fiscal,
    ingresos_brutos: perfil.ingresos_brutos,
    inicio_actividades: perfil.inicio_actividades,
    mostrar_iva: perfil.mostrar_iva,
  };
}

/** "Razón social · CUIT 20-12345678-6 · Monotributo" (sólo lo que esté cargado). */
export function lineaFiscal(f: DatosFiscales, cuit: string, nombreTaller: string) {
  const razon = f.razon_social && f.razon_social.trim() !== nombreTaller.trim() ? f.razon_social : "";
  return [razon, cuit && `CUIT ${cuit}`, f.condicion_iva && CONDICION[f.condicion_iva]].filter(Boolean).join(" · ");
}

/** "Domicilio fiscal · IIBB 921-… · Inicio de actividades 01/03/2015". */
export function pieFiscal(f: DatosFiscales) {
  const inicio = f.inicio_actividades ? new Date(`${f.inicio_actividades}T00:00`).toLocaleDateString("es-AR") : "";
  return [f.domicilio_fiscal, f.ingresos_brutos && `IIBB ${f.ingresos_brutos}`, inicio && `Inicio de actividades ${inicio}`].filter(Boolean).join(" · ");
}

/** Neto e IVA 21% contenidos en un precio final (con IVA incluido). */
export function desgloseIva(total: number) {
  const neto = Math.round((Number(total) / 1.21) * 100) / 100;
  return { neto, iva: Math.round((Number(total) - neto) * 100) / 100 };
}

/** El IVA se discrimina sólo si el taller lo pidió y es Responsable inscripto. */
export function ivaVisible(f: DatosFiscales) {
  return Boolean(f.mostrar_iva && f.condicion_iva === "RESPONSABLE_INSCRIPTO");
}
