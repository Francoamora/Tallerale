/**
 * lib/trial.ts
 *
 * Gestión del período de prueba de TallerOS.
 * Persiste en localStorage. Cuando el backend tenga auth real,
 * esto se migra a la base de datos.
 */

export const TRIAL_DAYS = 7;
export const WA_VENTAS = "543482277706"; // FAM Soluciones
export const WA_VENTAS_MSG = "Hola! Terminó mi prueba de TallerOS y quiero seguir usándolo. ¿Cómo activo mi cuenta?";

export interface SessionData {
  email: string;
  owner_nombre: string;
  taller_nombre: string;
  taller_ciudad: string;
  taller_tel: string;
  trial_start: string; // ISO
  onboarding_done: boolean;
  /** Token de autenticación Django (DRF Token o JWT access). OBLIGATORIO para llamadas a la API. */
  token: string;
  /** ID del taller en Django — usado para filtrar datos por tenant. */
  taller_id?: number;
  /** ID del usuario en Django. */
  user_id?: number;
}

const KEY = "ag_session_data";
const COOKIE_TOKEN = "ag_token";

/** Sincroniza el token a una cookie para que el middleware de Next.js pueda leerlo. */
function syncTokenCookie(token: string | null): void {
  if (typeof document === "undefined") return;
  if (token) {
    const secure = location.protocol === "https:" ? "; Secure" : "";
    document.cookie = `${COOKIE_TOKEN}=${token}; path=/; SameSite=Lax${secure}`;
  } else {
    document.cookie = `${COOKIE_TOKEN}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
  }
}

// ─── Guardar sesión al registrarse ───────────────────────────────────────────
export function saveSession(data: SessionData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(data));
  localStorage.setItem("ag_session", "true");
  syncTokenCookie(data.token || null);
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
      daysRemaining: TRIAL_DAYS,
      hoursRemaining: 0,
      tallerNombre: "",
      ownerNombre: "",
      onboardingDone: false,
      urgency: "safe",
    };
  }

  const start        = new Date(session.trial_start);
  const now          = new Date();
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

  // Sin token → la sesión no es válida para hacer llamadas a la API
  const isLoggedIn = Boolean(session.token);

  return {
    isLoggedIn,
    isExpired,
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
  // Limpiar cookie para que el middleware de Next.js también refleje el logout
  syncTokenCookie(null);
}

// ─── Leer token de auth ───────────────────────────────────────────────────────
/** Devuelve el token Django del usuario logueado, o "" si no hay sesión. */
export function getAuthToken(): string {
  const session = getSession();
  return session?.token ?? "";
}

// ─── Link de WhatsApp para activar ───────────────────────────────────────────
export function buildActivationWALink(tallerNombre?: string): string {
  const msg = tallerNombre
    ? `Hola! Soy el dueño de "${tallerNombre}" y quiero activar TallerOS. ¿Cómo sigo?`
    : WA_VENTAS_MSG;
  return `https://wa.me/${WA_VENTAS}?text=${encodeURIComponent(msg)}`;
}
