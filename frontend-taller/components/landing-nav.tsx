"use client";

/**
 * components/landing-nav.tsx
 * Navbar de la landing — client component para manejar el menú mobile.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { WA_SOPORTE } from "@/lib/trial";

// Sin link a "Probá gratis" acá: ya está el botón "Probar gratis" al lado,
// repetirlo como link de texto solo suma ruido.
const NAV_LINKS = [
  { href: "#features",  label: "Funciones" },
  { href: "#portal",    label: "Cómo funciona" },
  { href: "#contacto",  label: "Contacto" },
];

function LogoOS() {
  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-sm shadow-orange-500/30 text-xs font-black text-white">
      OS
    </div>
  );
}

export function LandingNav() {
  const [open, setOpen] = useState(false);

  // Cerrar al cambiar de ruta o hacer click en un link
  function close() { setOpen(false); }

  // Bloquear scroll del body cuando está abierto
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-8 lg:py-5">

          {/* ── Logo + firma de la casa ── */}
          {/* El link a FAM va afuera del <Link> del logo: anidar anchors es HTML inválido. */}
          <div className="flex min-w-0 items-center gap-2.5">
            <Link href="/landing" onClick={close} className="shrink-0 transition active:scale-95">
              <LogoOS />
            </Link>
            <div className="flex min-w-0 flex-col leading-none">
              <Link href="/landing" onClick={close} className="text-[15px] font-black tracking-tight transition active:scale-95">
                <span className="text-slate-900">Taller</span>
                <span className="text-orange-500">ista</span>
              </Link>
              <a
                href="https://famdesarrollos.com.ar"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 truncate text-[7px] font-bold uppercase tracking-wider text-slate-400 transition hover:text-orange-500 sm:text-[9px]"
              >
                Creado por FAM Desarrollos
              </a>
            </div>
          </div>

          {/* ── Nav desktop ── */}
          <nav className="hidden items-center gap-9 md:flex">
            {NAV_LINKS.map(l => (
              <a key={l.href} href={l.href}
                className="text-sm font-semibold text-slate-500 transition hover:text-slate-900">
                {l.label}
              </a>
            ))}
          </nav>

          {/* ── CTAs ── */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-5">
            <Link href="/login"
              className="hidden text-sm font-semibold text-slate-600 transition hover:text-slate-900 sm:block">
              Acceder
            </Link>
            {/* En mobile va compacto: la firma de FAM comparte la fila y el espacio es poco. */}
            <Link href="/registro"
              className="flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-slate-900 px-3 py-2 text-sm font-bold text-white transition hover:bg-slate-700 active:scale-95 sm:px-4">
              <span className="sm:hidden">Probar</span>
              <span className="hidden sm:inline">Probar gratis</span>
              <svg className="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            {/* Hamburger — solo mobile. 44×44 mínimo (Apple HIG) para que sea fácil de tocar. */}
            <button
              type="button"
              onClick={() => setOpen(!open)}
              aria-label={open ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={open}
              className="-mr-1 ml-1 flex h-11 w-11 touch-manipulation items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-700 shadow-sm transition active:scale-95 active:bg-slate-100 md:hidden"
            >
              {open ? (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              ) : (
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* ── Menú mobile desplegable ── */}
        {open && (
          <div className="border-t border-slate-100 bg-white md:hidden animate-in slide-in-from-top-2 duration-200">
            <nav className="px-4 py-3 space-y-1">
              {NAV_LINKS.map(l => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={close}
                  className="flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 active:bg-slate-100"
                >
                  {l.label}
                </a>
              ))}
            </nav>

            {/* Acciones mobile */}
            <div className="border-t border-slate-100 px-4 py-4 flex flex-col gap-2.5">
              <Link
                href="/login"
                onClick={close}
                className="flex w-full items-center justify-center rounded-xl border border-slate-200 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/registro"
                onClick={close}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 py-3 text-sm font-black text-white shadow-lg shadow-orange-500/25 transition hover:from-orange-600 hover:to-orange-700 active:scale-[0.98]"
              >
                Empezar gratis — 7 días
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>

              {/* WA mobile */}
              <a
                href={`https://wa.me/${WA_SOPORTE}?text=${encodeURIComponent("Hola! Quiero info sobre Tallerista")}`}
                onClick={close}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-[#25D366]/30 bg-[#25D366]/5 py-3 text-sm font-semibold text-[#1a9e4f] transition hover:bg-[#25D366]/10"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
                Consultar por WhatsApp
              </a>
            </div>
          </div>
        )}
      </header>
    </>
  );
}
