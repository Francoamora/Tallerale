/**
 * proxy.ts — Protección de rutas de Tallerista
 *
 * La cookie de sesión permite decidir la ruta antes de descargar y montar la
 * interfaz. La API sigue validando el token real en cada operación.
 */

import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const AUTH_PATHS = ["/login", "/registro", "/landing", "/invitacion"];
const ALWAYS_PUBLIC = ["/p/", "/api/", "/_next/", "/images/", "/videos/", "/favicon", "/icons/", "/file.svg", "/globe.svg", "/next.svg", "/vercel.svg", "/window.svg"];

function isAlwaysPublic(pathname: string): boolean {
  return ALWAYS_PUBLIC.some((path) => pathname.startsWith(path));
}

function isAuthPath(pathname: string): boolean {
  return AUTH_PATHS.some((path) => pathname.startsWith(path));
}

/**
 * En dev reiniciamos el server seguido (cambios de config), y cada reinicio
 * puede dejar atrás chunks/HTML de la build anterior. Si Safari cachea el
 * documento HTML de una página protegida, un reinicio de por medio puede
 * dejar al celular navegando con JS desincronizado del server actual —
 * exactamente el tipo de comportamiento errático (sesión que "se cuelga",
 * redirects raros) que reportó el usuario. Nunca cachear el documento evita
 * esta clase de bug por completo, sin costo real en producción.
 */
function sinCache(response: NextResponse): NextResponse {
  response.headers.set("Cache-Control", "no-store, must-revalidate");
  return response;
}

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Solo en dev: reenvía /api/* al Django local preservando la barra final
  // tal cual llega. next.config.ts rewrites() se la recorta (path-to-regexp
  // no la conserva en :path*), y Django la exige (APPEND_SLASH) — sin esto,
  // cualquier POST a un endpoint terminaba en 500.
  if (
    process.env.NODE_ENV !== "production" &&
    pathname.startsWith("/api/") &&
    !pathname.startsWith("/api/backend/")
  ) {
    return sinCache(NextResponse.rewrite(new URL(`${pathname}${search}`, "http://127.0.0.1:8000")));
  }

  if (isAlwaysPublic(pathname)) return NextResponse.next();

  const isLoggedIn = Boolean(request.cookies.get("ag_token")?.value);

  if (isLoggedIn && isAuthPath(pathname)) {
    return sinCache(NextResponse.redirect(new URL("/", request.url)));
  }

  if (!isLoggedIn) {
    if (pathname === "/") return sinCache(NextResponse.redirect(new URL("/landing", request.url)));
    if (isAuthPath(pathname)) return sinCache(NextResponse.next());
    return sinCache(NextResponse.redirect(new URL("/login", request.url)));
  }

  return sinCache(NextResponse.next());
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
