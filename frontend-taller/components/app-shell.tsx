"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import { clearSession, getTrialInfo } from "@/lib/trial";
import { TrialBanner } from "@/components/trial-banner";
import { logoutDjango } from "@/lib/api";

interface AppShellProps {
  currentPath: string;
  badge?: string;
  title: string;
  description: string;
  actions?: ReactNode;
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
    label: "Directorio Clientes",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    href: "/vehiculos",
    label: "Flota / Vehículos",
    icon: (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
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

function NavLink({ href, label, icon, currentPath }: { href: string; label: string; icon: ReactNode; currentPath: string }) {
  const isActive = currentPath === href || (href !== "/" && currentPath.startsWith(href));
  return (
    <Link
      href={href}
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
  children,
}: AppShellProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [ownerNombre, setOwnerNombre] = useState("Mi Taller");
  const [tallerNombre, setTallerNombre] = useState("");
  const [initials, setInitials] = useState("MT");
  const router = useRouter();

  useEffect(() => {
    const info = getTrialInfo();
    // Si no hay sesión con token → redirigir al login
    if (!info.isLoggedIn) {
      router.replace("/login");
      return;
    }
    const nombre = info.ownerNombre || "Mi Taller";
    setOwnerNombre(nombre);
    setTallerNombre(info.tallerNombre || "");
    const parts = nombre.trim().split(" ");
    setInitials(
      parts.length >= 2
        ? (parts[0][0] + parts[1][0]).toUpperCase()
        : nombre.slice(0, 2).toUpperCase()
    );
  }, []);

  const sidebarContent = (
    <>
      <div className="flex h-20 items-center border-b border-slate-100 px-6 dark:border-slate-800">
        <Link href="/" className="flex items-center gap-3 rounded-xl p-1.5 -m-1.5 transition hover:bg-slate-50 dark:hover:bg-slate-800/60 active:scale-95">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-500 text-sm font-black text-white shadow-sm">
            {initials}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="truncate text-sm font-bold tracking-tight text-slate-900 dark:text-white">
              {tallerNombre || ownerNombre}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-widest text-brand-600 dark:text-brand-500">TallerOS</span>
          </div>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        <p className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Operaciones
        </p>
        {navItems.map((item) => (
          <NavLink key={item.href} {...item} currentPath={currentPath} />
        ))}

        <div className="my-4 border-t border-slate-100 dark:border-slate-800" />

        <p className="mb-2 px-2 text-[11px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Finanzas
        </p>
        {finanzasItems.map((item) => (
          <NavLink key={item.href} {...item} currentPath={currentPath} />
        ))}
      </nav>

      {/* ── SECCIÓN DE USUARIO + LOGOUT ── */}
      <div className="border-t border-slate-100 p-3 dark:border-slate-800">
        <div className="flex items-center gap-3 rounded-xl px-2 py-2">
          {/* Avatar */}
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-500 text-[11px] font-black text-white">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-bold text-slate-800 dark:text-white">{ownerNombre}</p>
            <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">Administrador</p>
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
      <aside className="hidden w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 md:flex">
        {sidebarContent}
      </aside>

      {/* SIDEBAR MOBILE (overlay) */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <aside className="relative z-10 flex w-72 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            {sidebarContent}
          </aside>
        </div>
      )}

      {/* ÁREA CENTRAL DE TRABAJO */}
      <main className="flex w-full flex-1 flex-col">

        {/* BANNER DE TRIAL — días restantes o modal de expiración */}
        <TrialBanner />

        {/* CABECERA DE LA PÁGINA */}
        <header className="border-b border-slate-200 bg-white px-4 py-5 sm:px-10 sm:py-8 dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex max-w-7xl flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-start gap-4">
              {/* Hamburger para mobile */}
              <button
                onClick={() => setMobileOpen(true)}
                className="mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 md:hidden"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <div className="max-w-2xl">
                {badge && (
                  <span className="mb-3 inline-flex items-center rounded-md bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                    {badge}
                  </span>
                )}
                <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl dark:text-white">
                  {title}
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 sm:text-base dark:text-slate-400">
                  {description}
                </p>
              </div>
            </div>

            <div className="flex flex-col items-start gap-4 lg:items-end">
              {actions}
              <div className="flex items-center gap-2">
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
          </div>
        </header>

        {/* CONTENIDO DINÁMICO */}
        <div className="flex-1 p-4 sm:p-10 pb-24 md:pb-10">
          <div className="mx-auto max-w-7xl">
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
