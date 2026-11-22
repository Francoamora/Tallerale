/**
 * Nombres y numeración de los documentos del taller.
 *
 * Fuente única: antes cada pantalla tenía su propia copia y la misma orden se
 * llamaba "En proceso" en el panel y "En trabajo" en la lista, o figuraba como
 * "#5", "OT-5" y "OT-00005" según dónde se mirara. Este archivo es además el
 * único punto a cambiar cuando la numeración pase a ser propia de cada taller.
 */

export type EstadoTrabajo = "INGRESADO" | "EN_PROCESO" | "FINALIZADO" | "ENTREGADO" | "ANULADO";

/** Vocabulario del taller; lo ve también el cliente en el portal público. */
export const ESTADO_TRABAJO_LABEL: Record<EstadoTrabajo, string> = {
  INGRESADO: "Por revisar",
  EN_PROCESO: "En trabajo",
  FINALIZADO: "Listo para retirar",
  ENTREGADO: "Entregado",
  ANULADO: "Anulado",
};

export function etiquetaEstadoTrabajo(estado: string): string {
  return ESTADO_TRABAJO_LABEL[estado as EstadoTrabajo] ?? estado;
}

export function numeroOrden(id: number | string): string {
  return `OT-${String(id).padStart(5, "0")}`;
}

export function numeroPresupuesto(id: number | string): string {
  return `P-${String(id).padStart(4, "0")}`;
}
