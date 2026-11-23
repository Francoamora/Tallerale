"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { TrialBanner } from "@/components/trial-banner";
import { getSesionDjango, logoutDjango } from "@/lib/api";
import { MarcaTallerista } from "@/components/marca-tallerista";
import { clearSession, getTrialInfo, getSession, saveSession, sesionDesdeDjango } from "@/lib/trial";
import { cn } from "@/lib/utils";

interface AppShellProps {
  currentPath: string;
  badge?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  /** Contenido a la izquierda del título; con él, el título va centrado. */
  leading?: ReactNode;
  /** Pantallas de trabajo denso: cabecera y márgenes más chicos. */
  compact?: boolean;
  children: ReactNode;
}

type Rol = "ADMIN" | "RECEPCION" | "MECANICO" | "CONTADOR";

interface SesionVisible {
  ownerNombre: string;
  tallerNombre: string;
  rol: Rol | null;
  esSuperusuario: boolean;
}

/**
 * Copia en memoria de la sesión visible. AppShell se vuelve a montar en cada
 * navegación (no vive en un layout), y antes cada pantalla arrancaba con
 * "Mi Taller" y el menú vacío hasta releer el localStorage. La primera carga
 * sigue leyendo en un efecto (el HTML del servidor no conoce la sesión y la
 * hidratación tiene que coincidir); las navegaciones siguientes ya la tienen.
 */
let sesionEnMemoria: SesionVisible | null = null;

const SESION_VACIA: SesionVisible = { ownerNombre: "", tallerNombre: "", rol: null, esSuperusuario: false };

function leerSesionVisible(): SesionVisible | null {
  const info = getTrialInfo();
  if (!info.isLoggedIn) return null;
  const session = getSession();
  return {
    ownerNombre: info.ownerNombre || "Mi Taller",
    tallerNombre: info.tallerNombre || "",
    rol: session?.rol ?? null,
    esSuperusuario: Boolean(session?.es_superusuario),
  };
}

// ─── Navegación ─────────────────────────────────────────────────────────────

interface ItemNav { href: string; label: string; corto: string; icon: ReactNode }

const icono = (d: string) => (
  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
    <path strokeLinecap="round" strokeLinejoin="round" d={d} />
  </svg>
);

const OPERACION: ItemNav[] = [
  { href: "/", label: "Panel principal", corto: "Panel", icon: icono("M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6") },
  { href: "/trabajos", label: "Órdenes de trabajo", corto: "Trabajos", icon: icono("M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085") },
  { href: "/trabajos/tablero", label: "Tablero del taller", corto: "Tablero", icon: icono("M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125z") },
  { href: "/presupuestos", label: "Presupuestos", corto: "Presupuestos", icon: icono("M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z") },
  { href: "/clientes", label: "Clientes y vehículos", corto: "Clientes", icon: icono("M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z") },
  { href: "/turnos", label: "Agenda de turnos", corto: "Agenda", icon: icono("M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z") },
];

const FINANZAS: ItemNav[] = [
  { href: "/caja", label: "Caja y cobros", corto: "Caja", icon: icono("M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z") },
  { href: "/gastos", label: "Gastos y compras", corto: "Gastos", icon: icono("M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z") },
];

const ADMINISTRACION: ItemNav[] = [
  { href: "/equipo", label: "Equipo y accesos", corto: "Equipo", icon: icono("M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z") },
  { href: "/configuracion", label: "Configuración", corto: "Configuración", icon: icono("M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065zM15 12a3 3 0 11-6 0 3 3 0 016 0z") },
];

const CEO: ItemNav = { href: "/ceo", label: "Centro CEO", corto: "CEO", icon: icono("M3 21h18M5 21V10l7-6 7 6v11M9 21v-6h6v6") };

const ROL_LABEL: Record<Rol, string> = { ADMIN: "Administrador", RECEPCION: "Recepción", MECANICO: "Mecánico", CONTADOR: "Contador" };

function itemsDeOperacion(rol: Rol | null): ItemNav[] {
  if (rol === "ADMIN" || rol === "RECEPCION") return OPERACION;
  if (rol === "MECANICO") return OPERACION.filter((i) => ["/", "/trabajos", "/trabajos/tablero"].includes(i.href));
  if (rol === "CONTADOR") return OPERACION.filter((i) => i.href === "/");
  return [];
}

function estaActivo(href: string, currentPath: string): boolean {
  if (href === "/trabajos") return currentPath.startsWith("/trabajos") && !currentPath.startsWith("/trabajos/tablero");
  return currentPath === href || (href !== "/" && currentPath.startsWith(`${href}/`));
}

function iniciales(nombre: string): string {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("") || "T";
}

// ─── Shell ──────────────────────────────────────────────────────────────────

export function AppShell({ currentPath, badge, title, description, actions, leading, compact = false, children }: AppShellProps) {
  const router = useRouter();
  const [sesion, setSesion] = useState<SesionVisible>(() => sesionEnMemoria ?? SESION_VACIA);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [menuUsuario, setMenuUsuario] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const { rol, esSuperusuario } = sesion;
  const nombreTaller = sesion.tallerNombre || sesion.ownerNombre;
  const operacion = itemsDeOperacion(rol);
  const finanzas = rol === "ADMIN" || rol === "CONTADOR" ? FINANZAS : [];
  const administracion = rol === "ADMIN" ? ADMINISTRACION : [];

  useEffect(() => {
    function aplicar(visible: SesionVisible) {
      sesionEnMemoria = visible;
      setSesion(visible);
    }

    const visible = leerSesionVisible();
    if (visible) {
      aplicar(visible);
      return;
    }

    // En algunos navegadores mobile puede haber una lectura fantasma justo al
    // montar: se reintenta una vez antes de asumir que falta la copia local.
    let cancelado = false;
    const reintento = window.setTimeout(() => {
      const visibleReintento = leerSesionVisible();
      if (visibleReintento) {
        aplicar(visibleReintento);
        return;
      }
      // Si esta pantalla se mostró, proxy.ts vio una cookie de sesión: lo que
      // falta es sólo la copia local (Safari borra el localStorage tras 7 días
      // sin uso y conserva la cookie). Se reconstruye desde Django. Si la sesión
      // real tampoco es válida, la API responde 401 y apiRequest ya limpia la
      // cookie y lleva al login; ante otros errores (backend caído) no se
      // redirige para no entrar en un ciclo entre panel y login.
      getSesionDjango()
        .then((estado) => {
          if (cancelado) return;
          saveSession(sesionDesdeDjango(estado, null));
          const reconstruida = leerSesionVisible();
          if (reconstruida) aplicar(reconstruida);
        })
        .catch(() => { /* 401 ya resuelto por apiRequest; el resto, sin ciclo */ });
    }, 80);
    return () => {
      cancelado = true;
      window.clearTimeout(reintento);
    };
  }, []);

  // Menú lateral (mobile): bloquea el scroll del fondo y cierra con Escape.
  useEffect(() => {
    if (!mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const cerrar = (event: KeyboardEvent) => { if (event.key === "Escape") setMobileOpen(false); };
    window.addEventListener("keydown", cerrar);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", cerrar);
    };
  }, [mobileOpen]);

  // Menú de usuario: cierra al hacer clic afuera o con Escape.
  useEffect(() => {
    if (!menuUsuario) return;
    const alClickear = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) setMenuUsuario(false);
    };
    const alTeclear = (event: KeyboardEvent) => { if (event.key === "Escape") setMenuUsuario(false); };
    document.addEventListener("mousedown", alClickear);
    window.addEventListener("keydown", alTeclear);
    return () => {
      document.removeEventListener("mousedown", alClickear);
      window.removeEventListener("keydown", alTeclear);
    };
  }, [menuUsuario]);

  async function handleLogout() {
    try {
      await logoutDjango();
    } catch {
      // Si falla la revocación remota, igual limpiamos la sesión local.
    } finally {
      sesionEnMemoria = null;
      clearSession();
      router.push("/login");
    }
  }

  const ancho = "mx-auto w-full max-w-[1600px] px-4 sm:px-6 lg:px-8";

  return (
    <div className="flex min-h-screen w-full flex-col">
      {/* ── Barra superior: navegación fija en todas las pantallas ── */}
      {/* Barra oscura en los dos temas: separa la navegación del contenido y
          le da presencia al naranja de la marca. Logo a la izquierda, accesos
          al centro y usuario a la derecha. */}
      <header className="sticky top-0 z-40 border-b border-slate-800 bg-slate-950 text-white">
        <div className={cn(ancho, "flex h-16 items-center gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]")}>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Abrir menú"
            className="-ml-1 grid h-9 w-9 place-items-center rounded-lg text-slate-300 transition hover:bg-white/10 hover:text-white lg:hidden"
          >
            {icono("M4 6h16M4 12h16M4 18h16")}
          </button>

          <Link href="/" className="mr-2 flex min-w-0 items-center gap-2.5 justify-self-start rounded-lg py-1">
            <MarcaTallerista className="h-9 w-9 shrink-0 drop-shadow-[0_4px_12px_rgba(234,88,12,0.35)]" />
            <span className="min-w-0 leading-tight">
              <span className="block max-w-[11rem] truncate text-sm font-bold text-white">{nombreTaller || " "}</span>
              <span className="block text-[11px] font-medium text-white/55">con <span className="font-semibold text-brand-400">Tallerista</span></span>
            </span>
          </Link>

          <nav aria-label="Secciones" className="hidden h-full min-w-0 items-center gap-1 lg:flex">
            {operacion.map((item) => <LinkSuperior key={item.href} item={item} currentPath={currentPath} />)}
            {finanzas.length > 0 && <span className="mx-2 h-6 w-px bg-white/15" aria-hidden="true" />}
            {finanzas.map((item) => <LinkSuperior key={item.href} item={item} currentPath={currentPath} />)}
          </nav>

          {/* Menú de usuario: preferencias, administración y salida */}
          <div ref={menuRef} className="relative ml-auto justify-self-end">
            <button
              type="button"
              onClick={() => setMenuUsuario((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuUsuario}
              className="flex items-center gap-2.5 rounded-xl p-1 pr-2 transition hover:bg-white/10"
            >
              <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-xs font-bold text-slate-900 ring-2 ring-brand-500/70">
                {iniciales(sesion.ownerNombre)}
              </span>
              <span className="hidden text-left leading-tight xl:block">
                <span className="block max-w-[10rem] truncate text-xs font-semibold text-white">{sesion.ownerNombre}</span>
                <span className="block text-[10px] text-white/70">{esSuperusuario ? "Soporte" : rol ? ROL_LABEL[rol] : ""}</span>
              </span>
              <svg className="hidden h-4 w-4 text-white/60 xl:block" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
            </button>

            {menuUsuario && (
              <div role="menu" className="absolute right-0 top-full mt-2 w-64 overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-xl dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                <div className="border-b border-slate-100 px-4 py-3 dark:border-slate-700">
                  <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{sesion.ownerNombre}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{esSuperusuario ? "Soporte de Tallerista" : rol ? ROL_LABEL[rol] : ""} · {nombreTaller}</p>
                </div>
                <div className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Tema</span>
                  <ThemeToggle />
                </div>
                {(administracion.length > 0 || esSuperusuario) && (
                  <div className="border-t border-slate-100 py-1 dark:border-slate-700">
                    {[...administracion, ...(esSuperusuario ? [CEO] : [])].map((item) => (
                      <Link key={item.href} href={item.href} role="menuitem" className="flex items-center gap-3 px-4 py-2 text-sm text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/50">
                        <span className="text-slate-400">{item.icon}</span>{item.label}
                      </Link>
                    ))}
                  </div>
                )}
                <div className="border-t border-slate-100 py-1 dark:border-slate-700">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => { setMenuUsuario(false); setShowLogoutConfirm(true); }}
                    className="flex w-full items-center gap-3 px-4 py-2 text-sm text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    {icono("M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1")}
                    Cerrar sesión
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <TrialBanner />

      {/* ── Cabecera de la pantalla ── */}
      <div className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <div className={cn(ancho, "flex flex-col gap-3 py-4 sm:min-h-[5.5rem] sm:flex-row sm:items-center sm:justify-between sm:gap-6", Boolean(leading) && "lg:grid lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]")}>
          {leading && <div className="hidden min-w-0 lg:block">{leading}</div>}
          {/* Misma altura en todas las pantallas: con etiqueta arriba en unas, sin
              ella en otras y descripciones de una o dos líneas, la cabecera medía
              89, 110 o 130 px y al cambiar de sección todo el contenido saltaba.
              La sección ya la marca la barra superior, así que la etiqueta
              (badge) va sólo como texto para lectores de pantalla. */}
          <div className={cn("min-w-0", Boolean(leading) && "lg:text-center")}>
            {badge && <p className="sr-only">{badge}</p>}
            <h1 className="truncate font-display text-3xl font-extrabold uppercase leading-none tracking-tight text-slate-900 dark:text-white sm:text-[2.2rem]">{title}</h1>
            <p className="mt-0.5 hidden h-5 truncate text-sm text-slate-600 dark:text-slate-400 sm:block">{description}</p>
          </div>
          {actions && <div className={cn("acciones-cabecera flex shrink-0 flex-wrap items-center gap-2", Boolean(leading) && "lg:justify-end")}>{actions}</div>}
        </div>
      </div>

      {/* ── Contenido ── */}
      <main className="min-w-0 flex-1 overflow-x-clip">
        <div className={cn(ancho, compact ? "py-5" : "py-6 sm:py-8", "pb-[calc(6rem+env(safe-area-inset-bottom))] md:pb-10")}>{children}</div>
      </main>

      {/* ── Menú lateral (tablet y celular) ── */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex h-[100dvh] lg:hidden" role="dialog" aria-modal="true" aria-label="Menú principal">
          <button type="button" aria-label="Cerrar menú" className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-10 flex h-[100dvh] w-[min(20rem,calc(100vw-3rem))] flex-col overflow-y-auto border-r border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex h-14 shrink-0 items-center justify-between border-b border-slate-100 px-4 dark:border-slate-800">
              <span className="flex min-w-0 items-center gap-2"><MarcaTallerista className="h-7 w-7 shrink-0" /><span className="truncate text-sm font-bold text-slate-900 dark:text-white">{nombreTaller}</span></span>
              <button type="button" onClick={() => setMobileOpen(false)} aria-label="Cerrar menú" className="grid h-9 w-9 place-items-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                {icono("M6 18L18 6M6 6l12 12")}
              </button>
            </div>
            <nav className="flex-1 space-y-5 p-3" aria-label="Secciones">
              <GrupoLateral titulo="Operación" items={operacion} currentPath={currentPath} onNavigate={() => setMobileOpen(false)} />
              <GrupoLateral titulo="Finanzas" items={finanzas} currentPath={currentPath} onNavigate={() => setMobileOpen(false)} />
              <GrupoLateral titulo="Administración" items={[...administracion, ...(esSuperusuario ? [CEO] : [])]} currentPath={currentPath} onNavigate={() => setMobileOpen(false)} />
            </nav>
          </aside>
        </div>
      )}

      {/* ── Pestañas inferiores (celular) ── */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] dark:border-slate-800 dark:bg-slate-900 md:hidden" aria-label="Accesos rápidos">
        <div className="flex items-stretch">
          {[OPERACION[0], OPERACION[1], OPERACION[3], OPERACION[4], FINANZAS[0]]
            .filter((item) => operacion.includes(item) || finanzas.includes(item))
            .map((item) => {
              const activo = estaActivo(item.href, currentPath);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-semibold transition-colors",
                    activo ? "text-brand-600 dark:text-brand-400" : "text-slate-500 dark:text-slate-400",
                  )}
                >
                  {item.icon}
                  {item.corto}
                </Link>
              );
            })}
        </div>
      </nav>

      {/* ── Confirmación de salida ── */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="titulo-logout">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
            <h3 id="titulo-logout" className="text-lg font-bold text-slate-900 dark:text-white">¿Cerrar sesión?</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Vas a salir del panel de {nombreTaller}.</p>
            <div className="mt-6 flex gap-3">
              <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-700">
                Cancelar
              </button>
              <button onClick={handleLogout} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white hover:bg-red-700">
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function LinkSuperior({ item, currentPath }: { item: ItemNav; currentPath: string }) {
  const activo = estaActivo(item.href, currentPath);
  return (
    <Link
      href={item.href}
      aria-current={activo ? "page" : undefined}
      className={cn(
        "group relative flex h-full items-center whitespace-nowrap px-1 text-sm font-medium transition-colors",
        activo ? "text-white" : "text-white/85 hover:text-white",
      )}
    >
      <span className={cn("flex items-center gap-2 rounded-lg px-3 py-1.5 transition-colors", activo ? "bg-white/10" : "group-hover:bg-white/5")}>
        <span className={activo ? "text-brand-400" : "text-white/60 group-hover:text-white"}>{item.icon}</span>
        {item.corto}
      </span>
      {/* Rayita de marca pegada al borde inferior de la barra */}
      {activo && <span className="absolute inset-x-2 bottom-0 h-0.5 rounded-full bg-brand-500" aria-hidden="true" />}
    </Link>
  );
}

function GrupoLateral({ titulo, items, currentPath, onNavigate }: { titulo: string; items: ItemNav[]; currentPath: string; onNavigate: () => void }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="mb-1 px-3 text-xs font-semibold text-slate-400">{titulo}</p>
      {items.map((item) => {
        const activo = estaActivo(item.href, currentPath);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={activo ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
              activo ? "bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300" : "text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800",
            )}
          >
            <span className={activo ? "text-brand-600 dark:text-brand-400" : "text-slate-400"}>{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
