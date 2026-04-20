/**
 * middleware.ts — Protección de rutas de TallerOS
 *
 * Rutas protegidas: cualquier cosa que NO sea /login, /registro, /landing, /p/* (portal público)
 * El token se verifica desde la cookie `ag_token` que se sincroniza desde localStorage
 * mediante el AppShell (ver components/app-shell.tsx).
 *
 * Si no hay cookie → redirect a /login.
 * Si hay cookie pero el backend devuelve 401, el cliente maneja el redirect.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Rutas completamente públicas (no requieren sesión)
const PUBLIC_PATHS = [
  "/login",
  "/registro",
  "/landing",
  "/p/",          // portal del cliente
  "/_next/",      // assets Next.js
  "/favicon",
  "/icons/",
  "/og-",
];

function isPublic(pathname: string): boolean {
  return PUBLIC_PATHS.some((p) => pathname.startsWith(p));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Dejar pasar rutas públicas y assets
  if (isPublic(pathname)) {
    return NextResponse.next();
  }

  // Verificar cookie de sesión (sincronizada por AppShell desde localStorage)
  const token = request.cookies.get("ag_token")?.value;

  if (!token) {
    // Sin token → redirect a login
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // Aplica a todas las rutas excepto archivos estáticos y API routes de Next.js
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icons|og-).*)",
  ],
};
