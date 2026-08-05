"use client";

/**
 * app/login/page.tsx — Tallerista Premium Login
 *
 * Layout split: panel izquierdo (branding + mockup del dashboard) / panel
 * derecho (card de acceso). Lógica idéntica a la versión anterior, diseño
 * renovado: menos glow, mockup más creíble, login contenido en una card.
 */

import { useState, useEffect, type FormEvent, type MouseEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { saveSession, getSession, clearSession, buildOlvideWALink, WA_SOPORTE } from "@/lib/trial";
import { loginDjango } from "@/lib/api";

// ─── Mockup del dashboard — panel izquierdo ──────────────────────────────────
// Reemplaza al preview anterior (una sola tarjeta angosta) por una captura
// creíble del panel real: sidebar, header, métricas, tabla y gráfico.
const SIDEBAR_ITEMS = [
  "Resumen", "Órdenes de trabajo", "Presupuestos", "Vehículos", "Clientes",
  "Caja", "Inventario", "Reportes", "Configuración",
];

const ESTADO_STYLE: Record<string, string> = {
  "En proceso": "bg-amber-500/10 text-amber-400 ring-amber-500/20",
  "Listo":      "bg-emerald-500/10 text-emerald-400 ring-emerald-500/20",
  "Ingresado":  "bg-sky-500/10 text-sky-400 ring-sky-500/20",
  "En espera":  "bg-slate-500/15 text-slate-400 ring-slate-500/20",
};

const ORDENES_DEMO = [
  { orden: "OT-0421", vehiculo: "Toyota Hilux 2021", cliente: "Marcos D.", estado: "En proceso", importe: "$185.000" },
  { orden: "OT-0418", vehiculo: "Fiat Toro 2022",     cliente: "Lucía R.",  estado: "Listo",      importe: "$92.400"  },
  { orden: "OT-0415", vehiculo: "VW Amarok 2020",     cliente: "Javier P.", estado: "Ingresado",  importe: "$240.000" },
  { orden: "OT-0409", vehiculo: "Peugeot 208 2019",   cliente: "Ana G.",    estado: "En espera",  importe: "$58.000"  },
];

const METRICAS_DEMO = [
  { label: "Órdenes activas",       valor: "12" },
  { label: "Facturación del mes",   valor: "$517.000" },
  { label: "Vehículos ingresados",  valor: "24" },
  { label: "Turnos de hoy",         valor: "4" },
];

const FACTURACION_DEMO = [38, 55, 46, 70, 62, 95];

function DashboardPreview() {
  return (
    <div className="w-full max-w-[600px] overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0b1220] shadow-xl shadow-black/30">

      {/* Barra de ventana */}
      <div className="flex items-center gap-2 border-b border-white/[0.06] bg-white/[0.02] px-4 py-2.5">
        <span className="h-2 w-2 rounded-full bg-red-500/50" />
        <span className="h-2 w-2 rounded-full bg-amber-500/50" />
        <span className="h-2 w-2 rounded-full bg-emerald-500/50" />
        <span className="ml-2 text-[9px] font-bold uppercase tracking-widest text-slate-600">
          Panel del taller
        </span>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="hidden w-[128px] shrink-0 border-r border-white/[0.06] py-3 sm:block">
          {SIDEBAR_ITEMS.map((item, i) => (
            <div
              key={item}
              className={
                i === 0
                  ? "border-l-2 border-orange-500 bg-orange-500/[0.06] px-3 py-1.5 text-[9.5px] font-bold text-orange-400"
                  : "border-l-2 border-transparent px-3 py-1.5 text-[9.5px] font-medium text-slate-500"
              }
            >
              {item}
            </div>
          ))}
        </div>

        {/* Área principal */}
        <div className="min-w-0 flex-1 p-4">

          {/* Header */}
          <div className="mb-3.5">
            <div className="text-[13px] font-black text-white">Resumen general</div>
            <div className="text-[9.5px] text-slate-500">Vista general de tu taller</div>
          </div>

          {/* Métricas */}
          <div className="mb-3.5 grid grid-cols-2 gap-2">
            {METRICAS_DEMO.map((m) => (
              <div key={m.label} className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
                <div className="truncate text-[8px] font-bold uppercase tracking-wide text-slate-500">{m.label}</div>
                <div className="mt-0.5 font-mono text-[12px] font-black text-white">{m.valor}</div>
              </div>
            ))}
          </div>

          {/* Tabla de órdenes recientes */}
          <div className="mb-3.5 overflow-hidden rounded-lg border border-white/[0.06]">
            <div className="grid grid-cols-[46px_1fr_58px_58px_56px] gap-2 border-b border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 text-[7.5px] font-bold uppercase tracking-wider text-slate-500">
              <span>Orden</span>
              <span>Vehículo / Cliente</span>
              <span>Estado</span>
              <span className="text-right">Importe</span>
              <span />
            </div>
            <div className="divide-y divide-white/[0.04]">
              {ORDENES_DEMO.map((o) => (
                <div key={o.orden} className="grid grid-cols-[46px_1fr_58px_58px_56px] items-center gap-2 px-2.5 py-1.5">
                  <span className="truncate font-mono text-[8.5px] font-bold text-slate-400">{o.orden}</span>
                  <span className="min-w-0 truncate text-[9px] text-slate-300">
                    {o.vehiculo} <span className="text-slate-600">· {o.cliente}</span>
                  </span>
                  <span className={`justify-self-start rounded-full px-1.5 py-0.5 text-center text-[7px] font-bold ring-1 ${ESTADO_STYLE[o.estado]}`}>
                    {o.estado}
                  </span>
                  <span className="text-right font-mono text-[9px] font-bold text-slate-200">{o.importe}</span>
                  <span />
                </div>
              ))}
            </div>
          </div>

          {/* Gráfico de facturación */}
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-[8px] font-bold uppercase tracking-wide text-slate-500">Facturación · 6 meses</span>
              <span className="font-mono text-[9px] font-bold text-orange-400">+18%</span>
            </div>
            <div className="flex h-9 items-end gap-1.5">
              {FACTURACION_DEMO.map((h, i) => (
                <div key={i} className="flex-1 rounded-t-sm bg-orange-500/70" style={{ height: `${h}%` }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Panel izquierdo — branding + mockup del dashboard ───────────────────────
function HeroPanel() {
  return (
    <div className="relative hidden flex-col overflow-hidden lg:flex lg:w-[56%]">

      {/* Un único glow, sutil, sin saturar */}
      <div className="pointer-events-none absolute -top-52 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-orange-500/[0.06] blur-3xl" />

      <div className="relative flex flex-1 flex-col px-12 py-12">

        {/* Marca */}
        <span className="text-xl font-black tracking-tight text-white">Tallerista</span>

        {/* Título y bajada — alineado con "Bienvenido" de la card de la derecha */}
        <div className="mt-[122px]">
          <h2 className="text-4xl font-black leading-tight tracking-tight text-white">
            Todo tu taller,<br />
            <span className="text-orange-400">bajo control.</span>
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-400">
            Gestioná órdenes, clientes, vehículos, presupuestos y más. Desde cualquier lugar, en tiempo real.
          </p>
        </div>

        {/* Mockup del dashboard */}
        <div className="mt-auto flex items-center justify-center pt-14">
          <DashboardPreview />
        </div>
      </div>
    </div>
  );
}

// ─── Eye icon ─────────────────────────────────────────────────────────────────
function EyeIcon({ open }: { open: boolean }) {
  return open
    ? <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
    : <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>;
}

// ─── Form principal ───────────────────────────────────────────────────────────
function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [identifier, setIdentifier] = useState("");
  const [password,   setPassword]   = useState("");
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState("");
  const [showPass,   setShowPass]   = useState(false);
  const [expiredMsg, setExpiredMsg] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (session) { router.replace("/"); return; }
    if (searchParams.get("expired") === "1") setExpiredMsg(true);
  }, [router, searchParams]);

  async function handleSubmit(e: FormEvent | MouseEvent) {
    e.preventDefault();
    setError(""); setExpiredMsg(false);
    if (!identifier.trim() || !password.trim()) {
      setError("Completá usuario y contraseña para continuar.");
      return;
    }
    setLoading(true);
    try {
      const auth = await loginDjango(identifier.trim().toLowerCase(), password);
      const prev = getSession();
      const sameUser = prev && (prev.user_id === auth.user_id || prev.email.toLowerCase() === auth.email.toLowerCase());
      if (!sameUser) clearSession();
      saveSession({
        email:           auth.email,
        owner_nombre:    auth.nombre,
        taller_nombre:   auth.taller_nombre,
        taller_ciudad:   auth.taller_ciudad ?? (sameUser ? (prev?.taller_ciudad ?? "") : ""),
        taller_tel:      auth.taller_tel    ?? (sameUser ? (prev?.taller_tel    ?? "") : ""),
        taller_cuit:     auth.taller_cuit   ?? (sameUser ? (prev?.taller_cuit   ?? "") : ""),
        taller_logo_url: auth.taller_logo_url ?? (sameUser ? (prev?.taller_logo_url ?? null) : null),
        trial_start:     auth.trial_start   ?? (sameUser ? prev?.trial_start : undefined) ?? new Date().toISOString(),
        plan_activo_hasta: auth.plan_activo_hasta ?? (sameUser ? prev?.plan_activo_hasta : null) ?? null,
        onboarding_done: sameUser ? (prev?.onboarding_done ?? false) : false,
        taller_id:       auth.taller_id,
        user_id:         auth.user_id,
        rol:             auth.rol ?? "ADMIN",
      });
      router.push("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al iniciar sesión.";
      if (msg.includes("400") || msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("credencial")) {
        setError("Usuario o contraseña incorrectos.");
      } else if (msg.includes("404") || msg.includes("Cannot")) {
        setError("No se pudo conectar con el servidor.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    // Un único fondo para toda la pantalla: sin cambio de color al 56% no hay
    // costura vertical entre el hero y el formulario.
    <div className="flex min-h-screen w-full flex-col bg-[#070d1a]">

      {/* ── Fila principal: hero + formulario ── */}
      <div className="flex flex-1">

        {/* ── Panel izquierdo ── */}
        <HeroPanel />

        {/* ── Panel derecho — card de acceso ── */}
        <div className="relative flex flex-1 flex-col">

          {/* Glow de fondo en mobile, donde el hero no se muestra — muy sutil */}
          <div className="pointer-events-none absolute inset-0 overflow-hidden lg:hidden">
            <div className="absolute -top-32 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-orange-500/[0.06] blur-3xl" />
          </div>

          <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-10 sm:px-10">

          {/* Logo — solo visible en mobile (el panel izquierdo lo muestra en desktop) */}
          <div className="mb-8 lg:hidden">
            <span className="text-xl font-black tracking-tight text-white">Tallerista</span>
          </div>

          {/* ── Card de acceso ── */}
          <div className="w-full max-w-[380px] rounded-2xl border border-white/[0.07] bg-white/[0.02] p-7 shadow-xl shadow-black/20 sm:p-8">

            {/* Encabezado del form */}
            <div className="mb-7">
              <h1 className="text-2xl font-black tracking-tight text-white">
                Bienvenido
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                Ingresá para acceder al panel de tu taller.
              </p>
            </div>

            {/* Banner sesión expirada */}
            {expiredMsg && (
              <div className="mb-5 flex items-center gap-2.5 rounded-xl bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-400 ring-1 ring-amber-500/20 animate-in slide-in-from-top-2">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Tu sesión expiró. Volvé a ingresar.
              </div>
            )}

            {/* ── FORM ── */}
            {/* method="post": si un gestor de contraseñas llega a disparar un submit
                nativo antes de que React lo intercepte, que mande la contraseña en
                el body y no en la URL como querystring. suppressHydrationWarning:
                esas extensiones también inyectan atributos (__gcruniqueid, etc.) en
                el form antes de hidratar — no es un bug nuestro, solo ruido. */}
            <form onSubmit={handleSubmit} method="post" suppressHydrationWarning className="space-y-4">

              {/* Email / usuario */}
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">
                  Correo o usuario
                </label>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={identifier}
                    onChange={e => { setIdentifier(e.target.value); setError(""); }}
                    placeholder="tu@email.com o nombre de usuario"
                    autoComplete="username"
                    suppressHydrationWarning
                    data-lpignore="true"
                    data-1p-ignore=""
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.05] py-3.5 pl-11 pr-4 text-sm font-medium text-white placeholder-slate-600 outline-none transition focus:border-orange-500/60 focus:bg-white/[0.08] focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
              </div>

              {/* Contraseña */}
              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="block text-xs font-bold uppercase tracking-widest text-slate-500">
                    Contraseña
                  </label>
                  <a
                    href={buildOlvideWALink(identifier)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-orange-400 transition hover:text-orange-300"
                  >
                    Recuperar contraseña
                  </a>
                </div>
                <div className="relative">
                  <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                    <svg className="h-4 w-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type={showPass ? "text" : "password"}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError(""); }}
                    placeholder="••••••••••"
                    autoComplete="current-password"
                    suppressHydrationWarning
                    data-lpignore="true"
                    data-1p-ignore=""
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.05] py-3.5 pl-11 pr-12 text-sm font-medium text-white placeholder-slate-600 outline-none transition focus:border-orange-500/60 focus:bg-white/[0.08] focus:ring-2 focus:ring-orange-500/20"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-500 transition hover:text-slate-200"
                  >
                    <EyeIcon open={showPass} />
                  </button>
                </div>
              </div>

              {/* Error */}
              {error && (
                <div className="flex items-center gap-2.5 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-400 ring-1 ring-red-500/20 animate-in slide-in-from-top-1">
                  <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                  {error}
                </div>
              )}

              {/* Submit — type="button" + onClick en vez de depender del submit nativo
                  del form: si un gestor de contraseñas retrasa la hidratación, un toque
                  que llegue antes no dispara una recarga de página (no hace nada, en vez
                  de perder lo escrito), y funciona apenas React se engancha. */}
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading}
                className="relative w-full overflow-hidden rounded-xl bg-orange-500 py-3.5 text-sm font-black text-white transition hover:bg-orange-400 disabled:opacity-60 active:scale-[0.99]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-200 border-t-white" />
                    Ingresando...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Acceder al sistema
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg>
                  </span>
                )}
              </button>
            </form>

            {/* ── Divider ── */}
            <div className="my-6 flex items-center gap-3">
              <div className="flex-1 border-t border-white/[0.07]" />
              <span className="text-xs font-medium text-slate-600">o</span>
              <div className="flex-1 border-t border-white/[0.07]" />
            </div>

            {/* ── Botón WhatsApp ── */}
            <a
              href={`https://wa.me/${WA_SOPORTE}?text=${encodeURIComponent("Hola! Quiero acceder a Tallerista")}`}
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02] py-3.5 text-sm font-semibold text-slate-300 transition hover:border-white/[0.14] hover:bg-white/[0.04] active:scale-[0.99]"
            >
              <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Solicitar acceso por WhatsApp
            </a>

            {/* ── Crear cuenta ── */}
            <p className="mt-6 text-center text-sm text-slate-500">
              ¿No tenés cuenta?{" "}
              <Link href="/registro" className="font-bold text-orange-400 transition hover:text-orange-300">
                Probá 7 días gratis
              </Link>
            </p>
          </div>

          <div className="mt-6 text-center">
            <Link href="/landing" className="text-xs text-slate-600 transition hover:text-slate-400">
              ← Volver a la página de inicio
            </Link>
          </div>

          </div>
        </div>
      </div>

      {/* ── Barra inferior — cruza hero y formulario sin cortes ── */}
      <div className="relative border-t border-white/[0.06]">
        <div className="px-6 py-4 text-center sm:px-10 lg:px-12">
          <p className="text-[11px] text-slate-600">
            © {new Date().getFullYear()} Tallerista · Desarrollado por{" "}
            <a
              href="https://famdesarrollos.com.ar"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-slate-500 underline-offset-2 transition hover:text-orange-400 hover:underline"
            >
              FAM Desarrollos
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Page export con Suspense boundary ────────────────────────────────────────
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#070d1a]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
