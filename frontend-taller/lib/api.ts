import type { Cliente, DashboardStats, Gasto, MovimientoCuenta, Presupuesto, PresupuestoDetalle, Trabajo, TrabajoDetalle, TrabajoItem, Turno, Vehiculo, VehiculoHistorial } from "@/lib/types";
import { clearSession } from "@/lib/trial";

const FALLBACK_API_ROOT = "http://127.0.0.1:8000/api";
export const API_ROOT = "/api/backend";

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
// CLIENTE HTTP
// ==========================================

interface FetchOptions extends RequestInit {
  params?: Record<string, string | number | undefined>;
}

async function apiRequest<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { params, ...customConfig } = options;
  let url = buildUrl(path);

  if (params) {
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== "")
    ) as Record<string, string>;

    const queryString = new URLSearchParams(cleanParams).toString();
    if (queryString) url += `?${queryString}`;
  }

  // FormData (subida de archivos) necesita que el browser fije su propio
  // Content-Type con el boundary del multipart — si lo pisamos con
  // application/json, Django no puede parsear el body.
  const esFormData = typeof FormData !== "undefined" && customConfig.body instanceof FormData;

  const headers: HeadersInit = {
    Accept: "application/json",
    ...(customConfig.body && !esFormData ? { "Content-Type": "application/json" } : {}),
    ...customConfig.headers,
  };

  const config: RequestInit = {
    cache: "no-store",
    ...customConfig,
    headers,
  };

  try {
    const response = await fetch(url, config);

    // 401 invalida la sesión. Un 403 solo significa que el rol no tiene acceso:
    // nunca debe expulsar a un usuario autenticado.
    if (response.status === 401) {
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
      } catch {
        // Fallback silencioso si no es JSON válido
      }
      const fallo = new Error(errorMessage);
      // Un 4xx es el servidor diciendo "no" por una regla del negocio: la
      // pantalla lo muestra al usuario, no hace falta ensuciar la consola.
      if (response.status < 500) Object.assign(fallo, { esperado: true });
      throw fallo;
    }

    if (response.status === 204) return null as T;

    return (await response.json()) as Promise<T>;
  } catch (error) {
    if (!(error instanceof Error && "esperado" in error)) console.error(`[API Error] ${path}:`, error);
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
  cliente_id?: number | null;
  cliente_nombre?: string;
  detalle?: string;
  categoria?: string;
};

export type CajaResumen = {
  ingresos: number;
  egresos: number;
  resultado: number;
  cantidad_movimientos: number;
  cantidad_ingresos?: number;
  cantidad_egresos?: number;
  por_medio?: { metodo: string; ingresos: number; egresos: number }[];
};

export type FiltrosCaja = {
  fecha_desde?: string;
  fecha_hasta?: string;
  metodo?: string;
  q?: string;
  cliente_id?: number;
  tipo?: "INGRESO" | "EGRESO";
};

export type GastosResumen = {
  mes_actual: number;
  mes_anterior: number;
  total_periodo: number;
  cantidad_periodo: number;
  por_tipo: Array<{ tipo: string; total: number; cantidad: number }>;
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
  items_total: number;
  items_completados: number;
  responsable_nombre: string;
  iniciado_en: string | null;
  /** Días en la etapa actual (desde que empezó, terminó o se entregó). */
  dias_en_etapa: number;
  items: { id: number; descripcion: string; completado: boolean }[];
  cliente_id: number;
  cliente_telefono: string;
  responsable_id: number | null;
};

export type TableroData = {
  [key in "INGRESADO" | "EN_PROCESO" | "FINALIZADO" | "ENTREGADO"]: {
    trabajos: TrabajoKanban[];
    total_plata: number;
  };
};

export type Aviso = {
  tipo: "TURNO" | "PRESUPUESTO" | "RETIRO" | "SERVICE" | "DEUDA";
  prioridad: "ALTA" | "MEDIA";
  titulo: string;
  detalle: string;
  mensaje: string;
  href: string;
  telefono?: string | null;
};


// ==========================================
// AUTH — Login / Registro
// ==========================================

export interface AuthResponse {
  token?: string;         // El proxy lo conserva en una cookie HttpOnly.
  user_id: number;
  email: string;
  nombre: string;
  taller_nombre: string;
  taller_ciudad?: string;
  taller_tel?: string;
  taller_cuit?: string;
  taller_logo_url?: string | null;
  taller_id?: number;
  trial_start?: string;   // ISO — solo en register
  plan_activo_hasta?: string | null; // ISO — presente si hay un plan pago acordado
  rol?: "ADMIN" | "RECEPCION" | "MECANICO" | "CONTADOR";
  es_superusuario?: boolean;
}

/** Estado fresco de Django; deliberadamente no incluye la credencial. */
export type SesionResponse = Omit<AuthResponse, "token">;

export type CeoTaller = {
  id: number;
  taller_nombre: string;
  owner_nombre: string;
  email: string;
  ciudad: string;
  telefono: string;
  trial_start: string;
  trial_hasta: string;
  plan_activo_hasta: string | null;
  estado_acceso: "PLAN_ACTIVO" | "PRUEBA_VIGENTE" | "VENCIDO";
  acceso_vigente: boolean;
  dias_restantes: number;
  clientes: number;
  trabajos: number;
  es_superusuario: boolean;
};

export type CeoResumen = {
  total_talleres: number;
  pruebas_vigentes: number;
  planes_activos: number;
  vencidos: number;
  por_vencer: number;
  talleres: CeoTaller[];
};

export type CeoEnlaceRecuperacion = {
  path: string;
  expires_at: string;
  email: string;
};

export function getCeoResumen() { return apiRequest<CeoResumen>("/ceo/resumen/"); }
export function actualizarPlanCeo(id: number, payload: { accion: "ACTIVAR_30_DIAS" | "EXTENDER_30_DIAS" | "FIJAR_FECHA" | "QUITAR_PLAN"; hasta?: string }) {
  return apiRequest<CeoTaller>(`/ceo/talleres/${id}/plan/`, { method: "PATCH", body: JSON.stringify(payload) });
}
export function generarEnlaceRecuperacionCeo(id: number) {
  return apiRequest<CeoEnlaceRecuperacion>(`/ceo/talleres/${id}/enlace-recuperacion/`, { method: "POST" });
}

export type MiembroEquipo = { id: number; user_id: number; nombre: string; email: string; usuario: string; rol: string; activo: boolean; es_dueno: boolean };
export function getEquipo() { return apiRequest<MiembroEquipo[]>("/equipo/"); }
export function crearMiembro(payload: { nombre: string; usuario?: string; email?: string; password: string; rol: string }) { return apiRequest<MiembroEquipo>("/equipo/", { method: "POST", body: JSON.stringify(payload) }); }
export function sugerirUsuario(nombre: string) { return apiRequest<{ usuario: string }>("/equipo/sugerir-usuario", { params: { nombre } }); }
export function actualizarMiembro(id: number, payload: { rol?: string; activo?: boolean; password?: string }) { return apiRequest<MiembroEquipo>(`/equipo/${id}`, { method: "PATCH", body: JSON.stringify(payload) }); }
export function crearInvitacion(payload: { email: string; rol: string }) { return apiRequest<{ message: string }>("/equipo/invitaciones/", { method: "POST", body: JSON.stringify(payload) }); }

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
 * Extiende la vigencia del link público al compartirlo (el token no cambia).
 * Se dispara junto con el envío, sin esperarlo: navigator.share exige correr
 * directo desde el toque del usuario y Safari lo bloquea si antes se espera
 * un pedido al servidor. Para cuando el cliente abre el link ya está renovado.
 */
export function renovarPortalVehiculo(id: number) {
  return apiRequest<{ portal_expires_at: string }>(`/vehiculos/${id}/portal/renovar`, { method: "POST" });
}

export function renovarPortalPresupuesto(id: number) {
  return apiRequest<{ portal_expires_at: string }>(`/presupuestos/${id}/portal/renovar`, { method: "POST" });
}

export function getSesionDjango() {
  return apiRequest<SesionResponse>("/auth/sesion/");
}

export function getAvisos() {
  return apiRequest<Aviso[]>("/avisos");
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
  const url = buildUrl("/auth/logout/");
  const response = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json" },
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
// PERFIL DEL TALLER
// ==========================================

export type CondicionIva = "" | "MONOTRIBUTO" | "RESPONSABLE_INSCRIPTO" | "EXENTO";

export interface PerfilTallerData {
  nombre: string;
  taller_nombre: string;
  taller_ciudad: string;
  taller_tel: string;
  taller_cuit: string;
  logo_url?: string | null;
  razon_social?: string;
  condicion_iva?: CondicionIva;
  domicilio_fiscal?: string;
  ingresos_brutos?: string;
  inicio_actividades?: string | null;
  taller_email?: string;
  email_contador?: string;
  telefono_contador?: string;
  mostrar_iva?: boolean;
}

/**
 * Baja la planilla (.xlsx) del período para el contador: ventas, cobros y
 * compras. Se pide con fetch porque es un archivo, no JSON.
 */
export async function descargarPlanillaContador(fechaDesde: string, fechaHasta: string): Promise<Blob> {
  const url = `${buildUrl("/finanzas/exportar-contador")}?fecha_desde=${fechaDesde}&fecha_hasta=${fechaHasta}`;
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    let mensaje = "No pudimos armar la planilla.";
    try {
      const data = await response.json();
      mensaje = data.detail || data.message || mensaje;
    } catch {
      // respuesta sin JSON
    }
    throw new Error(mensaje);
  }
  return response.blob();
}

export async function getPerfilTaller(): Promise<PerfilTallerData> {
  return apiRequest<PerfilTallerData>("/perfil/");
}

export async function updatePerfilTaller(data: PerfilTallerData): Promise<PerfilTallerData> {
  return apiRequest<PerfilTallerData>("/perfil/", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
}

/** Sube (o reemplaza) el logo del taller. Se usa en presupuestos y comprobantes. */
export async function subirLogoTaller(archivo: File): Promise<PerfilTallerData> {
  const formData = new FormData();
  formData.append("archivo", archivo);
  return apiRequest<PerfilTallerData>("/perfil/logo/", { method: "POST", body: formData });
}

/** Quita el logo del taller — vuelve a mostrarse el placeholder de iniciales. */
export async function eliminarLogoTaller(): Promise<PerfilTallerData> {
  return apiRequest<PerfilTallerData>("/perfil/logo/", { method: "DELETE" });
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
export function crearClienteConVehiculo(payload: unknown) {
  return apiRequest<{ cliente: Cliente; vehiculo: Vehiculo }>("/directorio/alta-completa", {
    method: "POST",
    body: JSON.stringify(payload),
  });
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
export function getHistorialVehiculo(id: number) {
  return apiRequest<VehiculoHistorial>(`/vehiculos/${id}/historial/`);
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
export function actualizarItemTrabajo(trabajoId: number, itemId: number, completado: boolean) {
  return apiRequest<{
    id: number;
    completado: boolean;
    completado_en: string | null;
    items_total: number;
    items_completados: number;
  }>(`/trabajos/${trabajoId}/items/${itemId}/completado`, {
    method: "PATCH",
    body: JSON.stringify({ completado }),
  });
}
/** Suma a la orden algo que se hizo, sin pasar por la edición completa. */
export function agregarItemTrabajo(
  trabajoId: number,
  payload: { tipo: TrabajoItem["tipo"]; descripcion: string; cantidad?: number; precio_unitario?: number; completado?: boolean },
) {
  return apiRequest<TrabajoItem>(`/trabajos/${trabajoId}/items`, { method: "POST", body: JSON.stringify(payload) });
}
export function precioItemTrabajo(trabajoId: number, itemId: number, payload: { precio_unitario?: number; cantidad?: number }) {
  return apiRequest<TrabajoItem>(`/trabajos/${trabajoId}/items/${itemId}`, { method: "PATCH", body: JSON.stringify(payload) });
}
export function quitarItemTrabajo(trabajoId: number, itemId: number) {
  return apiRequest<{ message: string }>(`/trabajos/${trabajoId}/items/${itemId}`, { method: "DELETE" });
}
export function editarTrabajo(id: number, payload: unknown) {
  return apiRequest<TrabajoDetalle>(`/trabajos/${id}`, { method: "PUT", body: JSON.stringify(payload) });
}
export function eliminarTrabajo(id: number) {
  return apiRequest(`/trabajos/${id}`, { method: "DELETE" });
}

// ─── Tesorería (Caja Diaria) ───
export function getMovimientosCaja(params?: FiltrosCaja) {
  return apiRequest<MovimientoCaja[]>("/finanzas/caja", { params });
}
export function getResumenCaja(params?: FiltrosCaja) {
  return apiRequest<CajaResumen>("/finanzas/caja/resumen", { params });
}
export function getGastos(params?: {
  fecha_desde?: string;
  fecha_hasta?: string;
  tipo?: string;
  metodo?: string;
  buscar?: string;
}) {
  return apiRequest<Gasto[]>("/finanzas/gastos", { params });
}
export function getResumenGastos(params?: {
  fecha_desde?: string;
  fecha_hasta?: string;
  tipo?: string;
  metodo?: string;
  buscar?: string;
}) {
  return apiRequest<GastosResumen>("/finanzas/gastos/resumen", { params });
}
export function eliminarGasto(id: number) {
  return apiRequest<{ message: string }>(`/finanzas/gastos/${id}`, { method: "DELETE" });
}
export function crearGasto(payload: {
  tipo: string;
  descripcion: string;
  monto: number;
  comprobante: string;
  metodo_pago: string;
  fecha: string;
}) {
  return apiRequest("/compras/", { method: "POST", body: JSON.stringify(payload) });
}
/** Varias líneas de una misma compra (una factura): se guardan todas o ninguna. */
export function crearCompraLote(payload: {
  metodo_pago: string;
  fecha?: string;
  comprobante?: string;
  lineas: { tipo: string; descripcion: string; monto: number }[];
}) {
  return apiRequest<{ message: string; cantidad: number; total: number }>("/compras/lote", { method: "POST", body: JSON.stringify(payload) });
}
export type RegistrarPagoPayload = {
  cliente_id?: number;
  cliente_express?: { nombre: string; telefono?: string };
  monto_total_venta: number;
  monto_pagado: number;
  metodo_pago: string;
  descripcion: string;
  fecha_promesa?: string;
};
export function registrarPago(payload: RegistrarPagoPayload) {
  return apiRequest<{ message: string; nuevo_saldo: number }>("/pagos/", {
    method: "POST",
    body: JSON.stringify(payload),
  });
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
