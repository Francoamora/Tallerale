"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { clearSession, getSession, getTrialInfo } from "@/lib/trial";
import { TrialBanner } from "@/components/trial-banner";
import { logoutDjango } from "@/lib/api";

interface AppShellProps {
  currentPath: string;
  badge?: string;
  title: string;
  description: string;
  actions?: ReactNode;
  compact?: boolean;
  children: ReactNode;
}

const navItems = [
  {
    href: "/",
    label: "Panel Principal",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    href: "/trabajos",
    label: "Trabajos Activos",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: "/trabajos/tablero",
    label: "Vista de Tablero",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5.5A1.5 1.5 0 015.5 4h3A1.5 1.5 0 0110 5.5v13A1.5 1.5 0 018.5 20h-3A1.5 1.5 0 014 18.5v-13zm10 0A1.5 1.5 0 0115.5 4h3A1.5 1.5 0 0120 5.5v7a1.5 1.5 0 01-1.5 1.5h-3a1.5 1.5 0 01-1.5-1.5v-7z" />
      </svg>
    ),
  },
  {
    href: "/presupuestos",
    label: "Presupuestos",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
  {
    href: "/clientes",
    label: "Clientes y Vehículos",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: "/turnos",
    label: "Agenda de Turnos",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
  },
];

const finanzasItems = [
  {
    href: "/caja",
    label: "Caja / Cobros",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
  {
    href: "/gastos",
    label: "Gastos y Compras",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
    ),
  },
];

const administracionItems = [
  {
    href: "/equipo",
    label: "Equipo y accesos",
    icon: <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 0110 0z" /></svg>,
  },
  {
    href: "/configuracion",
    label: "Configuración",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

function NavLink({ href, label, icon, currentPath, onNavigate }: { href: string; label: string; icon: ReactNode; currentPath: string; onNavigate?: () => void }) {
  const isActive = href === "/trabajos"
    ? currentPath.startsWith("/trabajos") && !currentPath.startsWith("/trabajos/tablero")
    : currentPath === href || (href !== "/" && currentPath.startsWith(`${href}/`));
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={cn(
        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
        isActive
          ? "bg-brand-50 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400"
          : "text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
      )}
    >
      <span className={isActive ? "text-brand-600 dark:text-brand-400" : "text-slate-400 dark:text-slate-500"}>
        {icon}
      </span>
      {label}
    </Link>
  );
}

export function AppShell({
  currentPath,
  badge,
  title,
  description,
  actions,
  compact = false,
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [ownerNombre, setOwnerNombre] = useState("Mi Taller");
  const [tallerNombre, setTallerNombre] = useState("");
  const [initials, setInitials] = useState("MT");
  const [role, setRole] = useState<"ADMIN" | "RECEPCION" | "MECANICO" | "CONTADOR" | null>(null);
  const router = useRouter();
  const navItemsVisibles = role === "ADMIN" || role === "RECEPCION"
    ? navItems
    : role === "MECANICO"
      ? navItems.filter((item) => ["/", "/trabajos", "/trabajos/tablero"].includes(item.href))
      : role === "CONTADOR"
        ? navItems.filter((item) => item.href === "/")
        : [];

  useEffect(() => {
    function aplicarSesion(info: ReturnType<typeof getTrialInfo>) {
      setRole(getSession()?.rol ?? null);
      const nombre = info.ownerNombre || "Mi Taller";
      setOwnerNombre(nombre);
      setTallerNombre(info.tallerNombre || "");
      const parts = nombre.trim().split(" ");
      setInitials(
        parts.length >= 2
          ? (parts[0][0] + parts[1][0]).toUpperCase()
          : nombre.slice(0, 2).toUpperCase()
      );
    }

    const info = getTrialInfo();
    if (info.isLoggedIn) {
      aplicarSesion(info);
      return;
    }

    // Este componente se remonta en cada navegación (no es un layout persistente),
    // así que esta lectura de localStorage corre en cada cambio de página. En
    // algunos navegadores mobile puede haber una lectura fantasma justo al
    // montar — antes de redirigir, reintentamos una vez más antes de asumir
    // que la sesión realmente se perdió.
    const reintento = window.setTimeout(() => {
      const infoReintento = getTrialInfo();
      if (infoReintento.isLoggedIn) {
        aplicarSesion(infoReintento);
      } else {
        router.replace("/login");
      }
    }, 80);
    return () => window.clearTimeout(reintento);
  }, [router]);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [mobileOpen]);

  const sidebarContent = (
    <>
      <div className="flex h-20 shrink-0 items-center justify-between border-b border-slate-100 px-5 dark:border-slate-800">
        <Link href="/" onClick={() => setMobileOpen(false)} className="flex min-w-0 items-center gap-3 rounded-xl p-1.5 -m-1.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/60 active:scale-95">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-sm font-black text-white shadow-sm">
            {initials}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="truncate text-sm font-bold tracking-tight text-slate-900 dark:text-white">
              {tallerNombre || ownerNombre}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-600 dark:text-brand-500">Tallerista</span>
          </div>
        </Link>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          aria-label="Cerrar menú"
          className="ml-3 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500 transition active:scale-95 dark:bg-slate-800 dark:text-slate-300 md:hidden"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <nav className="scrollbar-none min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain p-4">
        <p className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Operaciones
        </p>
        {navItemsVisibles.map((item) => (
          <NavLink key={item.href} {...item} currentPath={currentPath} onNavigate={() => setMobileOpen(false)} />
        ))}

        {(role === "ADMIN" || role === "CONTADOR") && <>
          <div className="my-4 border-t border-slate-100 dark:border-slate-800" />
          <p className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Finanzas</p>
          {finanzasItems.map((item) => <NavLink key={item.href} {...item} currentPath={currentPath} onNavigate={() => setMobileOpen(false)} />)}
        </>}

        {role === "ADMIN" && <>
          <div className="my-4 border-t border-slate-100 dark:border-slate-800" />
          <p className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">Administración</p>
          {administracionItems.map((item) => <NavLink key={item.href} {...item} currentPath={currentPath} onNavigate={() => setMobileOpen(false)} />)}
        </>}
      </nav>

      {/* ── SECCIÓN DE USUARIO + LOGOUT ── */}
      <div className="shrink-0 border-t border-slate-100 p-3 dark:border-slate-800">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          {/* Avatar */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-[11px] font-black text-white">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-bold text-slate-800 dark:text-white">{ownerNombre}</p>
            <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
              {role ? { ADMIN: "Administrador", RECEPCION: "Recepción", MECANICO: "Mecánico", CONTADOR: "Contador" }[role] : "Cargando acceso…"}
            </p>
          </div>
          {/* Logout button */}
          <button
            onClick={() => setShowLogoutConfirm(true)}
            title="Cerrar sesión"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>
    </>
  );

  async function handleLogout() {
    try {
      await logoutDjango();
    } catch {
      // Si falla la revocación remota, igual limpiamos la sesión local.
    } finally {
      clearSession();
      router.push("/login");
    }
  }

  return (
    <div className="flex min-h-screen w-full">

      {/* MODAL LOGOUT */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm rounded-3xl bg-white p-8 shadow-2xl animate-in zoom-in-95 dark:bg-slate-800">
            <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600 dark:bg-red-900/30">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>
            <h3 className="text-xl font-black text-slate-900 dark:text-white">¿Cerrar sesión?</h3>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Vas a salir del panel de {tallerNombre || ownerNombre}.
            </p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 rounded-xl bg-red-600 py-3 text-sm font-bold text-white hover:bg-red-700"
              >
                Cerrar sesión
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIDEBAR DESKTOP */}
      <aside className="hidden min-h-screen w-64 self-stretch flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:flex">
        {sidebarContent}
      </aside>

      {/* SIDEBAR MOBILE (overlay) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex h-[100dvh] md:hidden" role="dialog" aria-modal="true" aria-label="Menú principal">
          <button type="button" aria-label="Cerrar menú" className="absolute inset-0 bg-slate-950/60 backdrop-blur-[2px]" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-10 flex h-[100dvh] w-[min(20rem,calc(100vw-3rem))] flex-col overflow-hidden border-r border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* ÁREA CENTRAL DE TRABAJO */}
      <main className="flex min-w-0 w-full flex-1 flex-col overflow-x-clip">

        {/* BANNER DE TRIAL — días restantes o modal de expiración */}
        <TrialBanner />

        {/* CABECERA DE LA PÁGINA */}
        <header className={cn(
          "border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900",
          compact ? "py-3 sm:px-6 sm:py-4" : "py-5 sm:px-10 sm:py-8",
        )}>
          <div className={cn(
            "mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4",
            compact ? "max-w-[1600px]" : "max-w-7xl",
          )}>
            <div className="flex min-w-0 items-start gap-3 sm:gap-4">
              {/* Hamburger para mobile */}
              <button
                onClick={() => setMobileOpen(true)}
                className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 md:hidden"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="min-w-0 sm:max-w-2xl">
                {badge && (
                  <span className={cn(
                    "inline-flex items-center rounded-md bg-slate-100 font-bold uppercase tracking-widest text-slate-500 dark:bg-slate-800 dark:text-slate-400",
                    compact ? "mb-1 px-2 py-0.5 text-[9px]" : "mb-2 px-2.5 py-1 text-[10px] sm:mb-3",
                  )}>
                    {badge}
                  </span>
                )}
                <h1 className={cn(
                  "truncate font-bold tracking-tight text-slate-900 dark:text-white sm:overflow-visible sm:text-clip sm:whitespace-normal",
                  compact ? "text-lg sm:text-2xl" : "text-xl sm:text-4xl",
                )}>
                  {title}
                </h1>
                <p className={cn(
                  "leading-relaxed text-slate-600 dark:text-slate-400",
                  compact ? "mt-0.5 hidden text-xs sm:block" : "mt-1 hidden text-sm sm:mt-2 sm:block sm:text-base",
                )}>
                  {description}
                </p>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
              {actions}
              <ThemeToggle />
              {/* Avatar + logout — desktop header */}
              <button
                onClick={() => setShowLogoutConfirm(true)}
                title="Cerrar sesión"
                className="hidden md:flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition hover:border-red-300 hover:bg-red-50 hover:text-red-500 dark:border-slate-700 dark:hover:bg-red-900/20 dark:hover:text-red-400"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </header>

        {/* CONTENIDO DINÁMICO */}
        <div className={cn(
          "flex-1 p-4 pb-24 md:pb-10",
          compact ? "sm:p-6" : "sm:p-10",
        )}>
          <div className={cn("mx-auto min-w-0", compact ? "max-w-[1600px]" : "max-w-7xl")}>
            {children}
          </div>
        </div>
      </main>

      {/* ══ BOTTOM NAVIGATION — MOBILE ONLY ══════════════════════════════ */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:hidden">
        <div className="flex items-stretch">
          {[
            {
              href: "/",
              label: "Panel",
              exact: true,
              icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>,
            },
            {
              href: "/trabajos",
              label: "Trabajos",
              exact: false,
              icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
            },
            {
              href: "/presupuestos",
              label: "Presupuestos",
              exact: false,
              icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
            },
            {
              href: "/clientes",
              label: "Clientes",
              exact: false,
              icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
            },
            {
              href: "/caja",
              label: "Caja",
              exact: false,
              icon: <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" /></svg>,
            },
          ].map((item) => {
            const isActive = item.exact
              ? currentPath === item.href
              : currentPath === item.href || currentPath.startsWith(item.href + "/") || currentPath.startsWith(item.href + "?");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[9px] font-bold uppercase tracking-wider transition-colors active:scale-95",
                  isActive
                    ? "text-brand-600 dark:text-brand-400"
                    : "text-slate-400 hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
                )}
              >
                <span className={isActive ? "text-brand-600 dark:text-brand-400" : "text-slate-400 dark:text-slate-500"}>
                  {item.icon}
                </span>
                {item.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
