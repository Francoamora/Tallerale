/**
 * lib/api-public.ts
 *
 * Capa de API pública — sin autenticación, para el Client Portal (/p/...).
 * Estos endpoints los provee Django en /api/public/...
 *
 * Reglas de diseño:
 * - No expone campos internos (observaciones_internas, notas_taller).
 * - Solo permite PATCH de estado ENVIADO → APROBADO | RECHAZADO.
 * - Funciona tanto en Server Components (SSR) como en Client Components.
 */

// ─── URL base ─────────────────────────────────────────────────────────────────
// En SSR usa API_BASE_URL (privada). En el cliente usa NEXT_PUBLIC_API_BASE_URL.
const FALLBACK = "http://127.0.0.1:8000/api";

function getBaseUrl(): string {
  if (typeof window === "undefined") {
    // Server Component / SSR
    return (process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? FALLBACK).replace(/\/$/, "");
  }
  // Client Component
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? FALLBACK).replace(/\/$/, "");
}

function buildUrl(path: string): string {
  const base = getBaseUrl();
  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

// ─── Tipos públicos ────────────────────────────────────────────────────────────

export interface PublicItem {
  tipo: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

export interface PublicCliente {
  nombre_completo: string;
  telefono?: string;
  email?: string;
}

export interface PublicVehiculoResumen {
  patente: string;
  marca: string;
  modelo: string;
  anio: number | null;
  color?: string;
  kilometraje_actual: number;
  token?: string; // Para linkear al portal del vehículo desde el presupuesto
}

/** Presupuesto sin campos internos */
export interface PublicPresupuesto {
  token: string;
  id: number;
  fecha_creacion: string;
  estado: "BORRADOR" | "ENVIADO" | "APROBADO" | "RECHAZADO";
  resumen_corto: string;
  total_mano_obra: number;
  total_repuestos: number;
  descuento: number;
  total: number;
  cliente: PublicCliente | null;
  vehiculo: PublicVehiculoResumen | null;
  items: PublicItem[];
  validez_dias?: number; // Cuántos días más es válido (opcional, para mostrar countdown)
  // Datos del taller — incluidos por Django cuando el backend los expone
  taller_nombre?: string;
  taller_tel?: string;
}

/** Historial de OT de un vehículo */
export interface PublicOTResumen {
  id: number;
  fecha_ingreso: string;
  fecha_egreso_estimado?: string | null;
  estado: string;
  resumen_trabajos: string;
  total: number;
  kilometraje: number;
  recomendaciones_proximo_service?: string;
}

/** Ficha completa del vehículo */
export interface PublicVehiculo {
  token: string;
  patente: string;
  marca: string;
  modelo: string;
  anio: number | null;
  color?: string;
  kilometraje_actual: number;
  proximo_service_km: number | null;
  cliente_nombre: string;
  historial: PublicOTResumen[];
  // Datos del taller — incluidos por Django cuando el backend los expone
  taller_nombre?: string;
  taller_tel?: string;
}

// ─── Errores ───────────────────────────────────────────────────────────────────

export class PublicApiNotFoundError extends Error {
  constructor(msg = "Recurso no encontrado o token inválido") {
    super(msg);
    this.name = "PublicApiNotFoundError";
  }
}

export class PublicApiError extends Error {
  constructor(
    public readonly status: number,
    msg: string,
  ) {
    super(msg);
    this.name = "PublicApiError";
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

async function publicGet<T>(path: string): Promise<T> {
  const url = buildUrl(path);
  const res = await fetch(url, {
    cache: "no-store", // Siempre fresco (el estado del presupuesto puede cambiar)
  });
  if (res.status === 404) throw new PublicApiNotFoundError();
  if (!res.ok) throw new PublicApiError(res.status, `HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

async function publicPatch<T>(path: string, body: unknown): Promise<T> {
  const url = buildUrl(path);
  const res = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (res.status === 404) throw new PublicApiNotFoundError();
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const err = await res.json();
      detail = err?.detail ?? err?.error ?? detail;
    } catch { /* ignorar */ }
    throw new PublicApiError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

// ─── API pública ───────────────────────────────────────────────────────────────

/**
 * Obtiene un presupuesto por su UUID token público.
 * Endpoint: GET /api/public/presupuestos/{token}/
 */
export async function getPublicPresupuesto(token: string): Promise<PublicPresupuesto> {
  return publicGet<PublicPresupuesto>(`/public/presupuestos/${token}/`);
}

/**
 * Obtiene la ficha pública de un vehículo con su historial de OTs.
 * Endpoint: GET /api/public/vehiculos/{token}/
 */
export async function getPublicVehiculo(token: string): Promise<PublicVehiculo> {
  return publicGet<PublicVehiculo>(`/public/vehiculos/${token}/`);
}

/**
 * Actualiza el estado de un presupuesto.
 * Solo permite ENVIADO → APROBADO | RECHAZADO.
 * Endpoint: PATCH /api/public/presupuestos/{token}/estado/
 */
export async function actualizarEstadoPublicPresupuesto(
  token: string,
  estado: "APROBADO" | "RECHAZADO",
): Promise<PublicPresupuesto> {
  return publicPatch<PublicPresupuesto>(`/public/presupuestos/${token}/estado/`, { estado });
}
