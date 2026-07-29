/**
 * lib/trial.ts
 *
 * Datos visuales de sesión y período de prueba.
 * La credencial real vive únicamente en una cookie HttpOnly del servidor.
 */

export const TRIAL_DAYS = 7;
export const WA_VENTAS = "5493482254317"; // Activación de cuenta
export const WA_VENTAS_MSG = "Hola! Terminó mi prueba de TallerOS y quiero seguir usándolo. ¿Cómo activo mi cuenta?";

export interface SessionData {
  email: string;
  owner_nombre: string;
  taller_nombre: string;
  taller_ciudad: string;
  taller_tel: string;
  taller_cuit?: string;
  taller_logo_url?: string | null;
  trial_start: string; // ISO
  plan_activo_hasta?: string | null; // ISO — presente si hay un plan pago acordado
  onboarding_done: boolean;
  /** ID del taller en Django — usado para filtrar datos por tenant. */
  taller_id?: number;
  /** ID del usuario en Django. */
  user_id?: number;
  rol?: "ADMIN" | "RECEPCION" | "MECANICO" | "CONTADOR";
}

const KEY = "ag_session_data";

// ─── Guardar sesión al registrarse ───────────────────────────────────────────
export function saveSession(data: SessionData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(data));
  localStorage.setItem("ag_session", "true");
}

// ─── Leer sesión ──────────────────────────────────────────────────────────────
export function getSession(): SessionData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SessionData;
  } catch {
    return null;
  }
}

// ─── Marcar onboarding completo ───────────────────────────────────────────────
export function markOnboardingDone(): void {
  const session = getSession();
  if (!session) return;
  saveSession({ ...session, onboarding_done: true });
}

// ─── Info del trial ───────────────────────────────────────────────────────────
export interface TrialInfo {
  isLoggedIn: boolean;
  isExpired: boolean;
  isPlanActivo: boolean;       // true si hay un plan pago vigente (acordado por WhatsApp)
  daysRemaining: number;       // 0 si expirado
  hoursRemaining: number;      // para el último día
  tallerNombre: string;
  ownerNombre: string;
  onboardingDone: boolean;
  urgency: "safe" | "warning" | "danger"; // >3 / 3-2 / 1-0
}

export function getTrialInfo(): TrialInfo {
  const session = getSession();

  if (!session) {
    return {
      isLoggedIn: false,
      isExpired: false,
      isPlanActivo: false,
      daysRemaining: TRIAL_DAYS,
      hoursRemaining: 0,
      tallerNombre: "",
      ownerNombre: "",
      onboardingDone: false,
      urgency: "safe",
    };
  }

  const now = new Date();

  // Mismo criterio que el backend (taller/models.py PerfilTaller.acceso_vigente):
  // un plan pago vigente manda por sobre el estado del trial.
  const planActivoHasta = session.plan_activo_hasta ? new Date(session.plan_activo_hasta) : null;
  const isPlanActivo = Boolean(planActivoHasta && planActivoHasta.getTime() > now.getTime());

  if (isPlanActivo) {
    return {
      isLoggedIn: true,
      isExpired: false,
      isPlanActivo: true,
      daysRemaining: TRIAL_DAYS,
      hoursRemaining: 0,
      tallerNombre: session.taller_nombre,
      ownerNombre: session.owner_nombre,
      onboardingDone: session.onboarding_done,
      urgency: "safe",
    };
  }

  const start        = new Date(session.trial_start);
  const msElapsed    = now.getTime() - start.getTime();
  const daysElapsed  = msElapsed / (1000 * 60 * 60 * 24);
  const daysRaw      = TRIAL_DAYS - daysElapsed;
  const daysRemaining = Math.max(0, Math.ceil(daysRaw));
  const hoursRemaining = daysRemaining === 1
    ? Math.max(0, Math.ceil((TRIAL_DAYS * 24) - (msElapsed / (1000 * 60 * 60))))
    : 0;
  const isExpired    = daysRaw <= 0;

  const urgency: TrialInfo["urgency"] =
    daysRemaining <= 1 ? "danger"
    : daysRemaining <= 3 ? "warning"
    : "safe";

  const isLoggedIn = Boolean(session);

  return {
    isLoggedIn,
    isExpired,
    isPlanActivo: false,
    daysRemaining,
    hoursRemaining,
    tallerNombre: session.taller_nombre,
    ownerNombre: session.owner_nombre,
    onboardingDone: session.onboarding_done,
    urgency,
  };
}

// ─── Cerrar sesión ────────────────────────────────────────────────────────────
/** Limpia TODA la data de la sesión actual, incluyendo hints descartados. */
export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
  localStorage.removeItem("ag_session");
  // Limpiar hints del usuario anterior para que el nuevo vea sus propias guías
  localStorage.removeItem("ag_hints_dismissed");
}

// ─── Link de WhatsApp para activar ───────────────────────────────────────────
export function buildActivationWALink(tallerNombre?: string): string {
  const msg = tallerNombre
    ? `Hola! Soy el dueño de "${tallerNombre}" y quiero activar TallerOS. ¿Cómo sigo?`
    : WA_VENTAS_MSG;
  return `https://wa.me/${WA_VENTAS}?text=${encodeURIComponent(msg)}`;
}

// ─── Link de WhatsApp para recuperar contraseña ──────────────────────────────
// Sin recuperación por email (no hay envío de mails configurado en el
// backend): el mismo canal manual que ya se usa para altas y cobros resuelve
// también los resets, sin infraestructura nueva.
export const WA_SOPORTE = WA_VENTAS; // Un solo número para todo el contacto de WhatsApp

export function buildOlvideWALink(identifier?: string): string {
  const base = "Hola! No recuerdo mi contraseña de TallerOS y necesito recuperar el acceso.";
  const msg = identifier?.trim()
    ? `${base} Mi usuario/email es: ${identifier.trim()}`
    : base;
  return `https://wa.me/${WA_SOPORTE}?text=${encodeURIComponent(msg)}`;
}
