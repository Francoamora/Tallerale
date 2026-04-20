// ─── Entidades base ────────────────────────────────────────

export interface Cliente {
  id: number;
  nombre: string;
  apellido: string;
  nombre_completo: string;
  telefono: string;
  email: string;
  dni?: string;
  saldo_balance: number;
}

export interface Vehiculo {
  id: number;
  cliente_id: number;
  patente: string;
  marca: string;
  modelo: string;
  anio: number | null;
  color: string;
  kilometraje_actual: number;
  proximo_service_km: number | null;
  token?: string;
}

// ─── Trabajos ──────────────────────────────────────────────

export interface TrabajoItem {
  id: number;
  tipo: "MANO_OBRA" | "REPUESTO" | "INSUMO" | "OTRO";
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

// Matches TrabajoRecienteOut (list endpoint)
export interface Trabajo {
  id: number;
  estado: string;
  fecha_ingreso: string;
  total: number;
  cliente_id: number;
  cliente_nombre: string;
  vehiculo: string;
  patente: string;
  resumen: string;
}

// Matches TrabajoDetalleOut (detail endpoint)
export interface TrabajoDetalle {
  id: number;
  token?: string;
  estado: string;
  fecha_ingreso: string;
  fecha_egreso_estimado: string | null;
  kilometraje: number;
  resumen_trabajos: string;
  observaciones_cliente: string;
  observaciones_internas: string;
  estado_general: string;
  estado_cubiertas_trabajo: string;
  recomendaciones_proximo_service: string;
  proximo_control_km: number | null;
  total_mano_obra: number;
  total_repuestos: number;
  descuento: number;
  total: number;
  cliente: Cliente;
  vehiculo: Vehiculo;
  items: TrabajoItem[];
}

// ─── Turnos ────────────────────────────────────────────────

// Matches TurnoOut (API)
export interface Turno {
  id: number;
  fecha_hora: string;
  motivo: string;
  notas: string;
  estado: string;
  cliente_nombre: string;
  vehiculo_desc: string;
  patente: string;
}

// ─── Presupuestos ──────────────────────────────────────────

export interface PresupuestoItem {
  id: number;
  tipo: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  subtotal: number;
}

// Matches PresupuestoOut (list endpoint)
export interface Presupuesto {
  id: number;
  fecha_creacion: string;
  estado: string;
  resumen_corto: string;
  total: number;
  cliente_nombre: string;
  vehiculo: string;
  patente: string;
}

// Matches PresupuestoDetalleOut (detail endpoint)
export interface PresupuestoDetalle {
  id: number;
  token?: string;
  fecha_creacion: string;
  estado: string;
  resumen_corto: string;
  total_mano_obra: number;
  total_repuestos: number;
  descuento: number;
  total: number;
  cliente: Cliente | null;
  vehiculo: Vehiculo | null;
  items: PresupuestoItem[];
}

// ─── Cuenta corriente ──────────────────────────────────────

export interface MovimientoCuenta {
  id: number;
  tipo: "PAGO" | "DEUDA";
  monto: number;
  fecha: string;
  descripcion: string;
  metodo_pago: string;
  fecha_promesa: string | null;
}

// ─── Gastos ────────────────────────────────────────────────

export interface Gasto {
  id: number;
  fecha: string;
  tipo: string;
  descripcion: string;
  monto: number;
  comprobante: string;
}

// ─── Dashboard stats ───────────────────────────────────────

export interface TrabajoEstadoCount {
  estado: string;
  cantidad: number;
}

export interface IngresoMensual {
  month: string;
  label: string;
  total: number;
  trabajos: number;
}

export interface TrabajoReciente {
  id: number;
  estado: string;
  fecha_ingreso: string;
  total: number;
  cliente_nombre: string;
  vehiculo: string;
  patente: string;
  resumen: string;
}

export interface AlertaService {
  vehiculo_id: number;
  cliente_nombre: string;
  patente: string;
  vehiculo: string;
  kilometraje_actual: number;
  proximo_service_km: number;
  diferencia_km: number;
  status: string;
}

export interface TurnoProximo {
  id: number;
  fecha_hora: string;
  estado: string;
  cliente_nombre: string;
  vehiculo: string;
  motivo: string;
}

export interface DashboardStats {
  total_clientes: number;
  total_vehiculos: number;
  trabajos_activos: number;
  ingresos_mes_actual: number;
  cuenta_corriente_pendiente: number;
  ticket_promedio: number;
  trabajos_por_estado: TrabajoEstadoCount[];
  ingresos_mensuales: IngresoMensual[];
  trabajos_recientes: TrabajoReciente[];
  alertas_service: AlertaService[];
  turnos_proximos: TurnoProximo[];
}
