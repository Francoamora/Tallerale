"use client";

/**
 * components/landing-nav.tsx
 * Navbar de la landing — client component para manejar el menú mobile.
 */

import { MarcaTallerista } from "@/components/marca-tallerista";
import { useState, useEffect } from "react";
import Link from "next/link";
import { WA_SOPORTE } from "@/lib/trial";

// Sin link a "Probá gratis" acá: ya está el botón "Probar gratis" al lado,
// repetirlo como link de texto solo suma ruido.
const NAV_LINKS = [
  { href: "#como-funciona", label: "Cómo funciona" },
  { href: "#features", label: "Funciones" },
  { href: "#contacto", label: "Contacto" },
];

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
      <header className="top-0 z-50 fixed inset-x-0 border-b border-white/10 bg-[#0f1113]/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-8 lg:py-5">

          {/* ── Logo + firma de la casa ── */}
          {/* El link a FAM va afuera del <Link> del logo: anidar anchors es HTML inválido. */}
          <div className="flex min-w-0 items-center gap-2.5">
            <Link href="/landing" onClick={close} aria-label="Tallerista" className="shrink-0 transition active:scale-95"><MarcaTallerista className="h-9 w-9" /></Link>
            <div className="flex min-w-0 flex-col leading-none">
              <Link href="/landing" onClick={close} className="text-[15px] font-black tracking-tight text-white transition active:scale-95">
                Tallerista
              </Link>
              <a
                href="https://famdesarrollos.com.ar"
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 truncate text-[10px] font-medium text-zinc-400 transition hover:text-orange-400 sm:text-xs"
              >
                Hecho por FAM Desarrollos
              </a>
            </div>
          </div>

          {/* ── Nav desktop ── */}
          <nav className="hidden items-center gap-9 md:flex">
            {NAV_LINKS.map(l => (
              <a key={l.href} href={l.href}
                className="text-sm font-semibold text-zinc-300 transition hover:text-white">
                {l.label}
              </a>
            ))}
          </nav>

          {/* ── CTAs ── */}
          <div className="flex shrink-0 items-center gap-2 sm:gap-5">
            <Link href="/login"
              className="hidden text-sm font-semibold text-zinc-300 transition hover:text-white sm:block">
              Acceder
            </Link>
            {/* En mobile va compacto: la firma de FAM comparte la fila y el espacio es poco. */}
            <Link href="/registro"
              className="flex items-center gap-1.5 whitespace-nowrap rounded-xl bg-brand-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-brand-700 active:scale-95 sm:px-4">
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
              className="-mr-1 ml-1 flex h-11 w-11 touch-manipulation items-center justify-center rounded-xl text-white ring-1 ring-white/20 transition active:scale-95 active:bg-white/10 md:hidden"
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
          <div className="border-t border-white/10 bg-[#0f1113] md:hidden animate-in slide-in-from-top-2 duration-200">
            <nav className="px-4 py-3 space-y-1">
              {NAV_LINKS.map(l => (
                <a
                  key={l.href}
                  href={l.href}
                  onClick={close}
                  className="flex items-center gap-3 rounded-xl px-4 py-3.5 text-sm font-semibold text-zinc-200 transition hover:bg-white/5 active:bg-white/10"
                >
                  {l.label}
                </a>
              ))}
            </nav>

            {/* Acciones mobile */}
            <div className="border-t border-white/10 px-4 py-4 flex flex-col gap-2.5">
              <Link
                href="/login"
                onClick={close}
                className="flex w-full items-center justify-center rounded-xl py-3 text-sm font-bold text-white ring-1 ring-white/20 transition hover:bg-white/5"
              >
                Iniciar sesión
              </Link>
              <Link
                href="/registro"
                onClick={close}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-bold text-white transition hover:bg-brand-700 active:scale-[0.98]"
              >
                Probar 7 días gratis
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>

              {/* WA mobile */}
              <a
                href={`https://wa.me/${WA_SOPORTE}?text=${encodeURIComponent("Hola! Quiero info sobre Tallerista")}`}
                onClick={close}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#25D366] py-3 text-sm font-semibold text-zinc-950 transition hover:brightness-95"
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
