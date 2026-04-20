/**
 * middleware.ts — Protección de rutas de TallerOS
 *
 * Lógica:
 * - Sin sesión + ruta "/" → /landing  (visitantes nuevos ven la landing)
 * - Sin sesión + ruta protegida → /login
 * - Con sesión + /landing, /login, /registro → / (ya están logueados)
 * - Rutas públicas (/p/*, assets) → siempre pasan
 *
 * El token se lee desde la cookie "ag_token" que se setea en saveSession()
 * y se borra en clearSession() (lib/trial.ts).
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rutas de auth que no necesitan sesión
const AUTH_PATHS = ["/login", "/registro", "/landing"];

// Rutas 100% públicas (portal cliente, assets de Next.js)
const ALWAYS_PUBLIC = ["/p/", "/_next/", "/favicon", "/icons/", "/file.svg", "/globe.svg", "/next.svg", "/vercel.svg", "/window.svg"];

function isAlwaysPublic(pathname: string): boolean {
  return ALWAYS_PUBLIC.some((p) => pathname.startsWith(p));
}

function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((p) => pathname.startsWith(p));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Assets de Next.js y portal público: pasan siempre
  if (isAlwaysPublic(pathname)) {
    return NextResponse.next();
  }

  const token = request.cookies.get("ag_token")?.value;
  const isLoggedIn = Boolean(token);

  // Usuario CON sesión intenta entrar a páginas de auth → lo mandamos al panel
  if (isLoggedIn && isAuthPath(pathname)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Usuario SIN sesión
  if (!isLoggedIn) {
    // Raíz del dominio → landing (marketing)
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/landing", request.url));
    }
    // Páginas de auth (login, registro, landing) → dejar pasar
    if (isAuthPath(pathname)) {
      return NextResponse.next();
    }
    // Cualquier otra ruta protegida → login
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Aplica a todo excepto archivos estáticos de Next.js
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
