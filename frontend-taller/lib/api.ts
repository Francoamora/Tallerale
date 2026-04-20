// src/lib/api.ts
import type { Cliente, DashboardStats, Gasto, MovimientoCuenta, Presupuesto, PresupuestoDetalle, Trabajo, TrabajoDetalle, Turno, Vehiculo } from "@/lib/types";
import { getAuthToken, clearSession } from "@/lib/trial";

const FALLBACK_API_ROOT = "http://127.0.0.1:8000/api";

function resolveApiRoot() {
  const configured = process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");

  if (process.env.NODE_ENV !== "production") {
    return FALLBACK_API_ROOT;
  }

  return "";
}

export const API_ROOT = resolveApiRoot();

export const PUBLIC_API_ROOT = (
  process.env.NEXT_PUBLIC_API_BASE_URL ??
  (process.env.NODE_ENV !== "production" ? FALLBACK_API_ROOT : "")
).replace(/\/$/, "");

function buildUrl(path: string, root = API_ROOT) {
  if (!root) {
    throw new Error(
      "Falta configurar NEXT_PUBLIC_API_BASE_URL/API_BASE_URL para conectar el frontend con el backend.",
    );
  }
  return `${root}${path.startsWith("/") ? path : `/${path}`}`;
}

export function buildPublicApiUrl(path: string) {
  return buildUrl(path, PUBLIC_API_ROOT);
}

// ==========================================
// CLIENTE HTTP (FETCH WRAPPER SENIOR)
// ==========================================

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | undefined>;
}

async function apiRequest<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { params, ...customConfig } = options;
  let url = buildUrl(path);

  if (params) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, v]) => v !== undefined && v !== "")
    ) as Record<string, string>;

    const queryString = new URLSearchParams(cleanParams).toString();
    if (queryString) url += `?${queryString}`;
  }

  // ── TOKEN DE AUTH ──────────────────────────────────────────────────────────
  // Lee el token Django del usuario logueado y lo adjunta en cada request.
  // Sin token válido Django rechazará la petición (401) o devolverá datos
  // del "anonimo" si la view no tiene IsAuthenticated — ambos casos se manejan.
  const token = typeof window !== "undefined" ? getAuthToken() : "";

  const headers: HeadersInit = {
    Accept: "application/json",
    ...(token ? { Authorization: `Token ${token}` } : {}),
    ...(customConfig.body ? { "Content-Type": "application/json" } : {}),
    ...customConfig.headers,
  };

  const config: RequestInit = {
    cache: "no-store",
    ...customConfig,
    headers,
  };

  try {
    const response = await fetch(url, config);

    // ── INTERCEPTOR 401 / 403 ─────────────────────────────────────────────
    // Token expirado o inválido → limpiar sesión y redirigir al login.
    if (response.status === 401 || response.status === 403) {
      if (typeof window !== "undefined") {
        clearSession();
        window.location.href = "/login?expired=1";
      }
      throw new Error("Sesión expirada. Iniciá sesión nuevamente.");
    }

    if (!response.ok) {
      let errorMessage = `Error de servidor (${response.status})`;
      try {
        const errorData = await response.json();
        if (errorData.detail) errorMessage = errorData.detail;
        else if (errorData.message) errorMessage = errorData.message;
      } catch (e) {
        // Fallback silencioso si no es JSON válido
      }
      throw new Error(errorMessage);
    }

    if (response.status === 204) return null as T;

    return (await response.json()) as Promise<T>;
  } catch (error) {
    console.error(`[API Error] ${path}:`, error);
    throw error;
  }
}


// ==========================================
// TIPOS EXTRAS (Desacoplados de types.ts)
// ==========================================

export type MovimientoCaja = {
  id: string;
  fecha: string;
  tipo: "INGRESO" | "EGRESO";
  concepto: string;
  monto: number;
  metodo: string;
};

export type TrabajoKanban = {
  id: number;
  estado: string;
  patente: string;
  vehiculo: string;
  cliente_nombre: string;
  total: number;
  fecha_ingreso: string;
  resumen_corto: string;
  dias_en_taller: number;
};

export type TableroData = {
  [key in "INGRESADO" | "EN_PROCESO" | "FINALIZADO" | "ENTREGADO"]: {
    trabajos: TrabajoKanban[];
    total_plata: number;
  };
};


// ==========================================
// AUTH — Login / Registro
// ==========================================

export interface AuthResponse {
  token: string;          // DRF Token key
  user_id: number;
  email: string;
  nombre: string;
  taller_nombre: string;
  taller_id?: number;
  trial_start?: string;   // ISO — solo en register
}

/**
 * Autentica contra Django y devuelve el token de sesión.
 * Django endpoint: POST /api/auth/login/
 * Body: { email, password }
 * Response: { token, user_id, email, nombre, taller_nombre, taller_id }
 */
export async function loginDjango(email: string, password: string): Promise<AuthResponse> {
  const url = buildUrl("/auth/login/");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });
  if (!response.ok) {
    let msg = `Error ${response.status}`;
    try {
      const data = await response.json();
      msg = data.detail || data.non_field_errors?.[0] || data.message || msg;
    } catch { /* noop */ }
    throw new Error(msg);
  }
  return response.json() as Promise<AuthResponse>;
}

/**
 * Registra un nuevo usuario+taller en Django y devuelve el token.
 * Django endpoint: POST /api/auth/register/
 */
export async function registerDjango(payload: {
  email: string;
  password: string;
  nombre: string;
  taller_nombre: string;
  taller_ciudad?: string;
  taller_tel?: string;
}): Promise<AuthResponse> {
  const url = buildUrl("/auth/register/");
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(payload),
    cache: "no-store",
  });
  if (!response.ok) {
    let msg = `Error ${response.status}`;
    try {
      const data = await response.json();
      // DRF devuelve errores por campo, tomamos el primero que encuentre
      const firstField = Object.values(data)[0];
      if (Array.isArray(firstField)) msg = (firstField as string[])[0];
      else if (typeof firstField === "string") msg = firstField;
      else if (data.detail) msg = data.detail;
    } catch { /* noop */ }
    throw new Error(msg);
  }
  return response.json() as Promise<AuthResponse>;
}

export async function logoutDjango(): Promise<void> {
  const token = typeof window !== "undefined" ? getAuthToken() : "";
  if (!token) return;

  const url = buildUrl("/auth/logout/");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Token ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok && response.status !== 401 && response.status !== 403) {
    let msg = `Error ${response.status}`;
    try {
      const data = await response.json();
      msg = data.detail || data.message || msg;
    } catch {
      // noop
    }
    throw new Error(msg);
  }
}

// ==========================================
// MÓDULOS DE NEGOCIO (Rutas)
// ==========================================

// ─── Analítica ───
export function getDashboardData() {
  return apiRequest<DashboardStats>("/dashboard/stats");
}

// ─── Clientes ───
export function getClientes(query?: string) {
  return apiRequest<Cliente[]>("/clientes", { params: { q: query } });
}
export function getClienteById(id: number) {
  return apiRequest<Cliente>(`/clientes/${id}`);
}
export function crearCliente(payload: unknown) {
  return apiRequest<Cliente>("/clientes/", { method: "POST", body: JSON.stringify(payload) });
}
export function editarCliente(id: number, payload: unknown) {
  return apiRequest<Cliente>(`/clientes/${id}`, { method: "PUT", body: JSON.stringify(payload) });
}
export function getMovimientosCliente(clienteId: number) {
  return apiRequest<MovimientoCuenta[]>(`/clientes/${clienteId}/movimientos`);
}

// ─── Vehículos ───
export function getVehiculos(query?: string) {
  return apiRequest<Vehiculo[]>("/vehiculos", { params: { q: query } });
}
export function getVehiculosPorCliente(clienteId: number) {
  return apiRequest<Vehiculo[]>("/vehiculos", { params: { cliente_id: clienteId } });
}
export function getVehiculoById(id: number) {
  return apiRequest<Vehiculo>(`/vehiculos/${id}`);
}
export function crearVehiculo(payload: unknown) {
  return apiRequest<Vehiculo>("/vehiculos/", { method: "POST", body: JSON.stringify(payload) });
}

// ─── Operaciones (Trabajos & Kanban) ───
export function getTrabajos(query?: string) {
  return apiRequest<Trabajo[]>("/trabajos/", { params: { q: query } });
}
export function getTrabajosPorCliente(clienteId: number) {
  return apiRequest<Trabajo[]>("/trabajos/", { params: { cliente_id: clienteId } });
}
export function getTableroTrabajos() {
  return apiRequest<TableroData>("/trabajos/tablero");
}
export function getTrabajoById(id: number) {
  return apiRequest<TrabajoDetalle>(`/trabajos/${id}`);
}
export function crearTrabajo(payload: unknown) {
  return apiRequest<TrabajoDetalle>("/trabajos/", { method: "POST", body: JSON.stringify(payload) });
}
export function actualizarEstadoTrabajo(id: number, estado: string) {
  return apiRequest(`/trabajos/${id}/estado`, { method: "PATCH", body: JSON.stringify({ estado }) });
}
export function editarTrabajo(id: number, payload: unknown) {
  return apiRequest<TrabajoDetalle>(`/trabajos/${id}`, { method: "PUT", body: JSON.stringify(payload) });
}
export function eliminarTrabajo(id: number) {
  return apiRequest(`/trabajos/${id}`, { method: "DELETE" });
}

// ─── Tesorería (Caja Diaria) ───
export function getMovimientosCaja() {
  return apiRequest<MovimientoCaja[]>("/finanzas/caja");
}
export function getGastos() {
  return apiRequest<Gasto[]>("/finanzas/gastos");
}
export function crearGasto(payload: unknown) {
  return apiRequest("/compras/", { method: "POST", body: JSON.stringify(payload) });
}

// ─── Turnos (Agenda) ───
export function getTurnos(query?: string) {
  return apiRequest<Turno[]>("/turnos/", { params: { q: query } });
}
export function getTurnoById(id: number) {
  return apiRequest<Turno>(`/turnos/${id}`);
}
export function crearTurno(payload: unknown) {
  return apiRequest<Turno>("/turnos/", { method: "POST", body: JSON.stringify(payload) });
}
export function actualizarEstadoTurno(id: number, estado: string) {
  return apiRequest(`/turnos/${id}/estado`, { method: "PATCH", body: JSON.stringify({ estado }) });
}
export function editarTurno(id: number, payload: unknown) {
  return apiRequest<Turno>(`/turnos/${id}`, { method: "PUT", body: JSON.stringify(payload) });
}
export function eliminarTurno(id: number) {
  return apiRequest(`/turnos/${id}`, { method: "DELETE" });
}

// ─── Presupuestos (Cotizaciones Rápidas) ───
export function getPresupuestos(query?: string) {
  return apiRequest<Presupuesto[]>("/presupuestos/", { params: { q: query } });
}
export function getPresupuestoById(id: number) {
  return apiRequest<PresupuestoDetalle>(`/presupuestos/${id}`);
}
export function crearPresupuesto(payload: unknown) {
  return apiRequest<PresupuestoDetalle>("/presupuestos/", { method: "POST", body: JSON.stringify(payload) });
}
export function actualizarEstadoPresupuesto(id: number, estado: string) {
  return apiRequest(`/presupuestos/${id}/estado`, { method: "PATCH", body: JSON.stringify({ estado }) });
}
export function editarPresupuesto(id: number, payload: unknown) {
  return apiRequest<PresupuestoDetalle>(`/presupuestos/${id}`, { method: "PUT", body: JSON.stringify(payload) });
}
export function eliminarPresupuesto(id: number) {
  return apiRequest(`/presupuestos/${id}`, { method: "DELETE" });
}
