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

// ─── Dashboard Speedometer SVG — panel izquierdo ─────────────────────────────
function DashboardIllustration() {
  // Generar marcas del velocímetro (de 220° a -40°, horario)
  const totalMarks = 60;
  const startAngle = 140; // grados desde el eje X positivo
  const endAngle   = 40;
  const sweep      = 360 - startAngle + endAngle; // 260°

  const marks = Array.from({ length: totalMarks + 1 }, (_, i) => {
    const pct   = i / totalMarks;
    const angle = startAngle + pct * sweep;
    const rad   = (angle * Math.PI) / 180;
    const isMajor = i % 5 === 0;
    const r1 = isMajor ? 108 : 114;
    const r2 = 122;
    return {
      x1: 160 + r1 * Math.cos(rad), y1: 160 + r1 * Math.sin(rad),
      x2: 160 + r2 * Math.cos(rad), y2: 160 + r2 * Math.sin(rad),
      isMajor,
      active: pct < 0.72,
    };
  });

  // Aguja — apunta a ~72% de la escala
  const needlePct   = 0.72;
  const needleAngle = startAngle + needlePct * sweep;
  const needleRad   = (needleAngle * Math.PI) / 180;
  const nx = 160 + 90 * Math.cos(needleRad);
  const ny = 160 + 90 * Math.sin(needleRad);

  // Arco de progreso naranja
  const arcR     = 115;
  const arcStart = startAngle * Math.PI / 180;
  const arcEnd   = (startAngle + needlePct * sweep) * Math.PI / 180;
  const largeArc = needlePct * sweep > 180 ? 1 : 0;
  const arcPath  = [
    `M ${160 + arcR * Math.cos(arcStart)} ${160 + arcR * Math.sin(arcStart)}`,
    `A ${arcR} ${arcR} 0 ${largeArc} 1 ${160 + arcR * Math.cos(arcEnd)} ${160 + arcR * Math.sin(arcEnd)}`,
  ].join(" ");

  return (
    <div className="flex w-full flex-col items-center gap-8 px-8">

      {/* ── Velocímetro principal ── */}
      <div className="relative">
        <svg viewBox="0 0 320 320" className="w-[260px] drop-shadow-2xl">
          <defs>
            <radialGradient id="faceGrad" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="100%" stopColor="#0f172a" />
            </radialGradient>
            <filter id="glowFilter">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
              <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>

          {/* Fondo exterior */}
          <circle cx="160" cy="160" r="148" fill="#0f172a" stroke="#1e293b" strokeWidth="2"/>

          {/* Cara del gauge */}
          <circle cx="160" cy="160" r="132" fill="url(#faceGrad)"/>

          {/* Track gris base */}
          <circle cx="160" cy="160" r="115" fill="none" stroke="#1e293b" strokeWidth="10"
            strokeDasharray="2 4" strokeLinecap="round"/>

          {/* Arco naranja de progreso */}
          <path d={arcPath} fill="none" stroke="#f97316" strokeWidth="10"
            strokeLinecap="round" filter="url(#glowFilter)" opacity="0.95"/>

          {/* Marcas */}
          {marks.map((m, i) => (
            <line key={i}
              x1={m.x1} y1={m.y1} x2={m.x2} y2={m.y2}
              stroke={m.active ? (m.isMajor ? "#f97316" : "#fb923c") : "#1e293b"}
              strokeWidth={m.isMajor ? 2.5 : 1.5}
              strokeLinecap="round"
              opacity={m.isMajor ? 1 : 0.6}
            />
          ))}

          {/* Aguja */}
          <line x1="160" y1="160" x2={nx} y2={ny}
            stroke="#f97316" strokeWidth="3" strokeLinecap="round" filter="url(#glowFilter)"/>
          <line x1="160" y1="160"
            x2={160 - 18 * Math.cos(needleRad)}
            y2={160 - 18 * Math.sin(needleRad)}
            stroke="#f97316" strokeWidth="2" strokeLinecap="round" opacity="0.5"/>

          {/* Centro */}
          <circle cx="160" cy="160" r="10" fill="#f97316" filter="url(#glowFilter)"/>
          <circle cx="160" cy="160" r="5"  fill="#fff" opacity="0.9"/>

          {/* Velocidad número */}
          <text x="160" y="196" textAnchor="middle" fill="#fff"
            fontSize="38" fontWeight="900" fontFamily="system-ui, sans-serif"
            letterSpacing="-1">218</text>
          <text x="160" y="213" textAnchor="middle" fill="#f97316"
            fontSize="10" fontWeight="700" fontFamily="system-ui, sans-serif"
            letterSpacing="3">KM/H</text>

          {/* Labels escala */}
          <text x="52"  y="228" fill="#475569" fontSize="9" fontWeight="600" textAnchor="middle">0</text>
          <text x="160" y="68"  fill="#475569" fontSize="9" fontWeight="600" textAnchor="middle">150</text>
          <text x="268" y="228" fill="#475569" fontSize="9" fontWeight="600" textAnchor="middle">300</text>

          {/* Anillo exterior decorativo */}
          <circle cx="160" cy="160" r="148" fill="none"
            stroke="#f97316" strokeWidth="1" opacity="0.12"/>
        </svg>

        {/* Glow ambiental naranja bajo el gauge */}
        <div className="pointer-events-none absolute -bottom-6 left-1/2 h-24 w-48 -translate-x-1/2 rounded-full bg-orange-500/20 blur-2xl" />
      </div>

      {/* ── Gauges secundarios ── */}
      <div className="flex w-full max-w-[260px] items-center justify-between">
        {/* RPM */}
        <div className="flex flex-col items-center gap-1">
          <svg viewBox="0 0 80 80" className="w-16">
            <circle cx="40" cy="40" r="34" fill="#0f172a" stroke="#1e293b" strokeWidth="2"/>
            <circle cx="40" cy="40" r="28" fill="none" stroke="#1e293b" strokeWidth="7" strokeDasharray="2 4"/>
            <circle cx="40" cy="40" r="28" fill="none" stroke="#f97316" strokeWidth="7"
              strokeDasharray={`${2 * Math.PI * 28 * 0.55} ${2 * Math.PI * 28}`}
              strokeDashoffset={2 * Math.PI * 28 * 0.25}
              strokeLinecap="round" opacity="0.8"/>
            <text x="40" y="44" textAnchor="middle" fill="#fff" fontSize="13" fontWeight="900"
              fontFamily="system-ui">5.5</text>
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">RPM ×1000</span>
        </div>

        {/* Temp */}
        <div className="flex flex-col items-center gap-1">
          <svg viewBox="0 0 80 80" className="w-16">
            <circle cx="40" cy="40" r="34" fill="#0f172a" stroke="#1e293b" strokeWidth="2"/>
            <circle cx="40" cy="40" r="28" fill="none" stroke="#1e293b" strokeWidth="7" strokeDasharray="2 4"/>
            <circle cx="40" cy="40" r="28" fill="none" stroke="#10b981" strokeWidth="7"
              strokeDasharray={`${2 * Math.PI * 28 * 0.45} ${2 * Math.PI * 28}`}
              strokeDashoffset={2 * Math.PI * 28 * 0.25}
              strokeLinecap="round" opacity="0.8"/>
            <text x="40" y="42" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="900"
              fontFamily="system-ui">90°</text>
            <text x="40" y="53" textAnchor="middle" fill="#10b981" fontSize="7" fontWeight="700"
              fontFamily="system-ui">TEMP</text>
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Motor °C</span>
        </div>

        {/* Combustible */}
        <div className="flex flex-col items-center gap-1">
          <svg viewBox="0 0 80 80" className="w-16">
            <circle cx="40" cy="40" r="34" fill="#0f172a" stroke="#1e293b" strokeWidth="2"/>
            <circle cx="40" cy="40" r="28" fill="none" stroke="#1e293b" strokeWidth="7" strokeDasharray="2 4"/>
            <circle cx="40" cy="40" r="28" fill="none" stroke="#f59e0b" strokeWidth="7"
              strokeDasharray={`${2 * Math.PI * 28 * 0.7} ${2 * Math.PI * 28}`}
              strokeDashoffset={2 * Math.PI * 28 * 0.25}
              strokeLinecap="round" opacity="0.8"/>
            <text x="40" y="42" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="900"
              fontFamily="system-ui">70%</text>
            <text x="40" y="53" textAnchor="middle" fill="#f59e0b" fontSize="7" fontWeight="700"
              fontFamily="system-ui">COMB</text>
          </svg>
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Combustible</span>
        </div>
      </div>
    </div>
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

        {/* Dashboard illustration */}
        <div className="mt-auto flex items-center justify-center pb-8">
          <DashboardIllustration />
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
