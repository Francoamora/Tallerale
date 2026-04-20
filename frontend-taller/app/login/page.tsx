"use client";

/**
 * app/login/page.tsx — TallerOS Premium Login
 *
 * Layout split: panel izquierdo (auto SVG + branding) / panel derecho (form).
 * Lógica idéntica, diseño completamente renovado.
 */

import { useState, useEffect, type FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { saveSession, getSession, clearSession } from "@/lib/trial";
import { loginDjango } from "@/lib/api";

// ─── Auto SVG (sedan sport, vista lateral) ────────────────────────────────────
function CarIllustration() {
  return (
    <svg viewBox="0 0 900 420" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full max-w-[680px]">
      <defs>
        <radialGradient id="glow" cx="50%" cy="100%" r="50%">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="wheelGlow" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#334155" />
          <stop offset="100%" stopColor="#1e293b" />
        </linearGradient>
        <linearGradient id="roofGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#475569" />
          <stop offset="100%" stopColor="#334155" />
        </linearGradient>
        <linearGradient id="windowGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.08" />
        </linearGradient>
        <linearGradient id="accentLine" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#f97316" stopOpacity="0" />
          <stop offset="30%" stopColor="#f97316" stopOpacity="1" />
          <stop offset="70%" stopColor="#fb923c" stopOpacity="1" />
          <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
        </linearGradient>
        <filter id="shadow" x="-10%" y="-10%" width="120%" height="130%">
          <feDropShadow dx="0" dy="8" stdDeviation="12" floodColor="#000" floodOpacity="0.5"/>
        </filter>
        <clipPath id="windowClip1">
          <path d="M345 185 L420 155 L500 155 L510 185 Z" />
        </clipPath>
        <clipPath id="windowClip2">
          <path d="M518 185 L522 155 L590 155 L610 185 Z" />
        </clipPath>
      </defs>

      {/* ── Glow de suelo ── */}
      <ellipse cx="450" cy="370" rx="380" ry="40" fill="url(#glow)" />

      {/* ── Sombra del auto ── */}
      <ellipse cx="450" cy="358" rx="320" ry="14" fill="#000" opacity="0.45" />

      {/* ── Línea del suelo ── */}
      <line x1="60" y1="358" x2="840" y2="358" stroke="#f97316" strokeWidth="1.5" strokeOpacity="0.25" />

      {/* ── Cuerpo inferior (falda) ── */}
      <path d="M178 310 Q180 328 200 332 L700 332 Q720 328 722 310 Z"
        fill="#0f172a" />

      {/* ── Cuerpo principal ── */}
      <path d="
        M140 310
        L155 265
        L200 220
        L320 178
        L400 155
        L540 148
        L650 158
        L710 195
        L750 245
        L760 310
        Z"
        fill="url(#bodyGrad)"
        filter="url(#shadow)"
      />

      {/* ── Techo ── */}
      <path d="
        M320 178
        L340 148
        L430 122
        L540 118
        L625 130
        L660 158
        L540 148
        L400 155
        Z"
        fill="url(#roofGrad)"
      />

      {/* ── Línea de acento naranja en el lateral ── */}
      <path d="M160 285 Q450 270 740 278"
        stroke="url(#accentLine)" strokeWidth="2.5" strokeLinecap="round" />

      {/* ── Ventana trasera ── */}
      <path d="M345 183 L355 148 L430 125 L435 183 Z"
        fill="url(#windowGrad)" stroke="#475569" strokeWidth="1" />
      {/* reflejo ventana trasera */}
      <path d="M355 165 L360 135 L375 128 L370 160 Z"
        fill="#fff" opacity="0.06" />

      {/* ── Ventanas centrales ── */}
      <path d="M440 183 L442 122 L540 118 L545 183 Z"
        fill="url(#windowGrad)" stroke="#475569" strokeWidth="1" />
      {/* reflejo */}
      <path d="M450 170 L452 128 L470 126 L468 168 Z"
        fill="#fff" opacity="0.06" />

      {/* ── Ventana delantera ── */}
      <path d="M550 183 L548 125 L628 132 L650 155 L655 183 Z"
        fill="url(#windowGrad)" stroke="#475569" strokeWidth="1" />
      {/* reflejo */}
      <path d="M558 172 L556 132 L575 134 L574 170 Z"
        fill="#fff" opacity="0.06" />

      {/* ── Pilar B y C ── */}
      <rect x="436" y="120" width="7" height="64" rx="2" fill="#1e293b" />
      <rect x="543" y="118" width="8" height="66" rx="2" fill="#1e293b" />

      {/* ── Faros delanteros ── */}
      <path d="M748 230 L760 225 L762 255 L748 258 Z"
        fill="#fef3c7" opacity="0.9" />
      <path d="M748 230 L762 225 L763 235 L748 237 Z"
        fill="#fbbf24" opacity="0.7" />
      {/* haz de luz */}
      <path d="M762 240 L860 215 L865 250 L762 248 Z"
        fill="#fbbf24" opacity="0.04" />

      {/* ── Faros traseros ── */}
      <path d="M142 248 L155 245 L158 278 L142 280 Z"
        fill="#ef4444" opacity="0.75" />
      <path d="M142 260 L155 258 L155 268 L142 267 Z"
        fill="#f87171" opacity="0.9" />

      {/* ── Rejilla delantera ── */}
      <path d="M730 260 Q745 255 755 270 Q745 280 730 278 Z"
        fill="#0f172a" stroke="#374151" strokeWidth="1" />

      {/* ── Manija de puerta ── */}
      <rect x="488" y="232" width="38" height="10" rx="5" fill="#475569" />
      <rect x="490" y="234" width="34" height="6" rx="3" fill="#64748b" />

      {/* ── Espejo retrovisor ── */}
      <path d="M710 210 L730 205 L732 222 L710 220 Z"
        fill="#334155" stroke="#475569" strokeWidth="1" />

      {/* ══ RUEDA TRASERA ══ */}
      {/* glow rueda */}
      <circle cx="240" cy="335" r="68" fill="url(#wheelGlow)" />
      {/* llanta exterior */}
      <circle cx="240" cy="335" r="58" fill="#111827" stroke="#374151" strokeWidth="3" />
      {/* aro */}
      <circle cx="240" cy="335" r="44" fill="#0f172a" stroke="#4b5563" strokeWidth="2" />
      {/* rayos */}
      {[0,40,80,120,160,200,240,280,320].map((angle, i) => (
        <line key={i}
          x1={240 + 14 * Math.cos(angle * Math.PI / 180)}
          y1={335 + 14 * Math.sin(angle * Math.PI / 180)}
          x2={240 + 42 * Math.cos(angle * Math.PI / 180)}
          y2={335 + 42 * Math.sin(angle * Math.PI / 180)}
          stroke="#6b7280" strokeWidth="5" strokeLinecap="round"
        />
      ))}
      {/* centro */}
      <circle cx="240" cy="335" r="14" fill="#1f2937" stroke="#f97316" strokeWidth="2" />
      <circle cx="240" cy="335" r="5" fill="#f97316" />
      {/* neumático highlight */}
      <path d="M195 298 Q205 285 225 282" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />

      {/* ══ RUEDA DELANTERA ══ */}
      {/* glow rueda */}
      <circle cx="660" cy="335" r="68" fill="url(#wheelGlow)" />
      {/* llanta exterior */}
      <circle cx="660" cy="335" r="58" fill="#111827" stroke="#374151" strokeWidth="3" />
      {/* aro */}
      <circle cx="660" cy="335" r="44" fill="#0f172a" stroke="#4b5563" strokeWidth="2" />
      {/* rayos */}
      {[0,40,80,120,160,200,240,280,320].map((angle, i) => (
        <line key={i}
          x1={660 + 14 * Math.cos(angle * Math.PI / 180)}
          y1={335 + 14 * Math.sin(angle * Math.PI / 180)}
          x2={660 + 42 * Math.cos(angle * Math.PI / 180)}
          y2={335 + 42 * Math.sin(angle * Math.PI / 180)}
          stroke="#6b7280" strokeWidth="5" strokeLinecap="round"
        />
      ))}
      {/* centro */}
      <circle cx="660" cy="335" r="14" fill="#1f2937" stroke="#f97316" strokeWidth="2" />
      <circle cx="660" cy="335" r="5" fill="#f97316" />
      {/* neumático highlight */}
      <path d="M615 298 Q625 285 645 282" stroke="#6b7280" strokeWidth="2.5" strokeLinecap="round" opacity="0.5" />

      {/* ── Detalle parabrisas borde ── */}
      <path d="M322 178 L342 145 L355 148 L335 182 Z"
        fill="#0f172a" />
      <path d="M656 178 L650 155 L665 162 L672 183 Z"
        fill="#0f172a" />
    </svg>
  );
}

// ─── Panel izquierdo — hero con auto ─────────────────────────────────────────
function HeroPanel() {
  return (
    <div className="relative hidden flex-col overflow-hidden bg-[#070d1a] lg:flex lg:w-[55%]">

      {/* Grid de fondo */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.03]" style={{
        backgroundImage:
          "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
        backgroundSize: "60px 60px",
      }} />

      {/* Glow naranja superior */}
      <div className="pointer-events-none absolute -top-60 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-orange-500/10 blur-3xl" />

      {/* Líneas decorativas de velocidad */}
      <div className="pointer-events-none absolute bottom-48 left-0 right-0 overflow-hidden opacity-20">
        {[0, 18, 36, 54, 72].map((y, i) => (
          <div key={i} className="mb-3 h-px bg-gradient-to-r from-transparent via-orange-500 to-transparent"
            style={{ marginLeft: `${i * 12}px`, marginRight: `${i * 12}px` }} />
        ))}
      </div>

      {/* ── Contenido ── */}
      <div className="relative flex flex-1 flex-col px-12 pt-12">

        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/30">
            <span className="text-sm font-black text-white">OS</span>
          </div>
          <div>
            <span className="text-xl font-black tracking-tight text-white">Taller<span className="text-orange-400">OS</span></span>
          </div>
        </div>

        {/* Headline */}
        <div className="mt-16">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-orange-500/10 px-3 py-1.5 ring-1 ring-orange-500/20">
            <span className="h-1.5 w-1.5 rounded-full bg-orange-400" />
            <span className="text-xs font-bold text-orange-400">Sistema multi-taller</span>
          </div>
          <h2 className="text-4xl font-black leading-tight tracking-tight text-white">
            Tu taller,<br />
            <span className="text-orange-400">en control total.</span>
          </h2>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-slate-400">
            Presupuestos, órdenes de trabajo, clientes, caja y agenda — todo en un solo lugar.
          </p>
        </div>

        {/* Auto illustration */}
        <div className="mt-auto -mb-4 -mx-4">
          <CarIllustration />
        </div>
      </div>

      {/* Stats bar inferior */}
      <div className="relative border-t border-white/5 bg-white/[0.02] px-12 py-5">
        <div className="flex items-center gap-8">
          {[
            { n: "100%", label: "Multi-tenant" },
            { n: "7 días", label: "Prueba gratis" },
            { n: "24/7", label: "Acceso desde el cel" },
          ].map((s) => (
            <div key={s.n}>
              <div className="text-lg font-black text-orange-400">{s.n}</div>
              <div className="text-[11px] text-slate-500">{s.label}</div>
            </div>
          ))}
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
    if (session?.token) { router.replace("/"); return; }
    if (searchParams.get("expired") === "1") setExpiredMsg(true);
  }, [router, searchParams]);

  async function handleSubmit(e: FormEvent) {
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
        trial_start:     auth.trial_start   ?? (sameUser ? prev?.trial_start : undefined) ?? new Date().toISOString(),
        onboarding_done: sameUser ? (prev?.onboarding_done ?? false) : false,
        token:           auth.token,
        taller_id:       auth.taller_id,
        user_id:         auth.user_id,
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
    <div className="flex min-h-screen w-full">

      {/* ── Panel izquierdo con el auto ── */}
      <HeroPanel />

      {/* ── Panel derecho — formulario ── */}
      <div className="flex flex-1 flex-col bg-[#0b1120] lg:bg-[#0d1526]">

        {/* Fondo móvil: gradiente + minicar hint */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden lg:hidden">
          <div className="absolute -top-32 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-orange-500/8 blur-3xl" />
          <div className="absolute -bottom-20 left-0 h-60 w-60 rounded-full bg-orange-500/5 blur-3xl" />
        </div>

        <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-10 sm:px-10">

          {/* Logo — solo visible en mobile (el panel izquierdo lo muestra en desktop) */}
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/30">
              <span className="text-sm font-black text-white">OS</span>
            </div>
            <span className="text-xl font-black tracking-tight text-white">
              Taller<span className="text-orange-400">OS</span>
            </span>
          </div>

          <div className="w-full max-w-[380px]">

            {/* Encabezado del form */}
            <div className="mb-8">
              <h1 className="text-2xl font-black tracking-tight text-white">
                Bienvenido de nuevo
              </h1>
              <p className="mt-1 text-sm text-slate-400">
                Ingresá para acceder al panel de tu taller.
              </p>
            </div>

            {/* Banner sesión expirada */}
            {expiredMsg && (
              <div className="mb-5 flex items-center gap-2.5 rounded-2xl bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-400 ring-1 ring-amber-500/20 animate-in slide-in-from-top-2">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                Tu sesión expiró. Volvé a ingresar.
              </div>
            )}

            {/* ── FORM ── */}
            <form onSubmit={handleSubmit} className="space-y-4">

              {/* Email / usuario */}
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">
                  Email o usuario
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
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.06] py-3.5 pl-11 pr-4 text-sm font-medium text-white placeholder-slate-600 outline-none transition focus:border-orange-500/60 focus:bg-white/[0.09] focus:ring-2 focus:ring-orange-500/20"
                  />
                </div>
              </div>

              {/* Contraseña */}
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-slate-500">
                  Contraseña
                </label>
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
                    className="w-full rounded-xl border border-white/[0.08] bg-white/[0.06] py-3.5 pl-11 pr-12 text-sm font-medium text-white placeholder-slate-600 outline-none transition focus:border-orange-500/60 focus:bg-white/[0.09] focus:ring-2 focus:ring-orange-500/20"
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

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="relative w-full overflow-hidden rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-500/25 transition hover:from-orange-400 hover:to-orange-500 disabled:opacity-60 active:scale-[0.99]"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-200 border-t-white" />
                    Ingresando...
                  </span>
                ) : (
                  <span className="flex items-center justify-center gap-2">
                    Ingresar al panel
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
              href="https://wa.me/543482277706?text=Hola!%20Quiero%20acceder%20a%20TallerOS"
              target="_blank"
              rel="noopener noreferrer"
              className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.03] py-3.5 text-sm font-semibold text-slate-300 transition hover:border-[#25D366]/40 hover:bg-[#25D366]/10 hover:text-[#25D366] active:scale-[0.99]"
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
                Probá 7 días gratis →
              </Link>
            </p>

            <div className="mt-4 text-center">
              <Link href="/landing" className="text-xs text-slate-600 transition hover:text-slate-400">
                ← Volver a la página de inicio
              </Link>
            </div>

          </div>
        </div>

        {/* ── Footer ── */}
        <div className="relative border-t border-white/[0.05] px-8 py-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-600">
              © 2025 TallerOS
            </p>
            <div className="group relative flex items-center gap-1 cursor-default">
              <p className="text-[11px] text-slate-700">Desarrollado por</p>
              <span className="text-[11px] font-bold text-slate-500 transition group-hover:text-orange-400">
                FAM Soluciones
              </span>
              <span className="pointer-events-none absolute -top-10 right-0 whitespace-nowrap rounded-xl bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-white opacity-0 shadow-xl transition-all duration-200 group-hover:-translate-y-1 group-hover:opacity-100">
                📱 3482277706
                <span className="absolute -bottom-1 right-6 border-4 border-transparent border-t-slate-800" />
              </span>
            </div>
          </div>
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
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-xl shadow-orange-500/30">
            <span className="text-base font-black text-white">OS</span>
          </div>
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
