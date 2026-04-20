"use client";

/**
 * app/login/page.tsx
 *
 * Autenticación real contra Django REST Framework.
 * POST /api/auth/login/ → { token, user_id, email, nombre, taller_nombre, taller_id, trial_start }
 * El token se guarda en SessionData y se envía en cada API request.
 */

import { useState, useEffect, type FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { saveSession, getSession, clearSession } from "@/lib/trial";
import { loginDjango } from "@/lib/api";

// ─── Inner component (necesita Suspense porque usa useSearchParams) ────────────
function LoginForm() {
  const router       = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState("");
  const [showPass, setShowPass] = useState(false);
  const [expiredMsg, setExpiredMsg] = useState(false);

  useEffect(() => {
    // Si ya tiene sesión válida con token → ir al panel
    const session = getSession();
    if (session?.token) {
      router.replace("/");
      return;
    }
    // Parámetro ?expired=1 → mostrar aviso
    if (searchParams.get("expired") === "1") {
      setExpiredMsg(true);
    }
  }, [router, searchParams]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setExpiredMsg(false);
    if (!email.trim() || !password.trim()) {
      setError("Completá email y contraseña para continuar.");
      return;
    }
    setLoading(true);
    try {
      const auth = await loginDjango(email.trim().toLowerCase(), password);
      const prevSession = getSession();
      const sameUser =
        prevSession &&
        (prevSession.user_id === auth.user_id ||
          prevSession.email.toLowerCase() === auth.email.toLowerCase());

      // Si cambió de cuenta en el mismo navegador, limpiamos la sesión anterior
      // para no heredar metadatos del otro taller.
      if (!sameUser) {
        clearSession();
      }

      saveSession({
        email:           auth.email,
        owner_nombre:    auth.nombre,
        taller_nombre:   auth.taller_nombre,
        taller_ciudad:   auth.taller_ciudad ?? (sameUser ? (prevSession?.taller_ciudad ?? "") : ""),
        taller_tel:      auth.taller_tel ?? (sameUser ? (prevSession?.taller_tel ?? "") : ""),
        trial_start:     auth.trial_start ?? (sameUser ? prevSession?.trial_start : undefined) ?? new Date().toISOString(),
        onboarding_done: sameUser ? (prevSession?.onboarding_done ?? false) : false,
        token:           auth.token,
        taller_id:       auth.taller_id,
        user_id:         auth.user_id,
      });
      router.push("/");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al iniciar sesión.";
      // Mensajes amigables para errores comunes de DRF
      if (msg.includes("400") || msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("credencial")) {
        setError("Email o contraseña incorrectos. Revisá los datos e intentá de nuevo.");
      } else if (msg.includes("404") || msg.includes("Cannot")) {
        setError("No se pudo conectar con el servidor. ¿Está corriendo Django en local?");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-12">

      {/* ── Decoración de fondo ── */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-orange-500/8 blur-3xl" />
        <div className="absolute -bottom-40 left-0 h-80 w-80 rounded-full bg-blue-500/6 blur-3xl" />
        <div className="absolute -bottom-40 right-0 h-80 w-80 rounded-full bg-orange-500/6 blur-3xl" />
        {/* Grid sutil */}
        <div className="absolute inset-0 opacity-[0.025]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }} />
      </div>

      <div className="relative w-full max-w-[380px]">

        {/* ── Marca ── */}
        <div className="mb-10 text-center">
          {/* Logo */}
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-2xl shadow-orange-500/40">
            <span className="text-xl font-black tracking-tight text-white">OS</span>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">
            <span>Taller</span>
            <span className="text-orange-400">OS</span>
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-400">
            El sistema operativo de tu taller
          </p>
        </div>

        {/* ── Banner sesión expirada ── */}
        {expiredMsg && (
          <div className="mb-4 animate-in slide-in-from-top-2 rounded-2xl bg-amber-500/10 px-4 py-3 text-center text-sm font-semibold text-amber-400 ring-1 ring-amber-500/20">
            ⏰ Tu sesión expiró. Volvé a ingresar para continuar.
          </div>
        )}

        {/* ── Card ── */}
        <div className="rounded-3xl bg-white/[0.04] p-8 ring-1 ring-white/10 backdrop-blur-xl">
          <h2 className="mb-6 text-center text-base font-bold text-slate-200">
            Iniciá sesión en tu taller
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">

            {/* Email o usuario */}
            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-slate-500">
                Email o usuario
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <svg className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(""); }}
                  placeholder="tu@email.com o tu usuario anterior"
                  autoComplete="username"
                  className="w-full rounded-xl bg-white/8 py-3.5 pl-11 pr-4 text-sm font-medium text-white placeholder-slate-600 outline-none ring-1 ring-white/10 transition focus:bg-white/12 focus:ring-orange-500/50"
                />
              </div>
            </div>

            {/* Contraseña */}
            <div>
              <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-slate-500">
                Contraseña
              </label>
              <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-4">
                  <svg className="h-4 w-4 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                <input
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full rounded-xl bg-white/8 py-3.5 pl-11 pr-12 text-sm font-medium text-white placeholder-slate-600 outline-none ring-1 ring-white/10 transition focus:bg-white/12 focus:ring-orange-500/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-600 hover:text-slate-300 transition"
                >
                  {showPass
                    ? <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    : <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  }
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="animate-in slide-in-from-top-2 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-400 ring-1 ring-red-500/20">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-500/25 transition hover:from-orange-600 hover:to-orange-700 disabled:opacity-60 active:scale-[0.98]"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-300 border-t-white" />
                  Ingresando...
                </span>
              ) : "Ingresar al panel"}
            </button>
          </form>

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 border-t border-white/8" />
            <span className="text-xs text-slate-600">o</span>
            <div className="flex-1 border-t border-white/8" />
          </div>

          {/* Crear cuenta */}
          <div className="text-center text-sm text-slate-500">
            ¿No tenés cuenta?{" "}
            <Link href="/registro" className="font-bold text-orange-400 transition hover:text-orange-300">
              Probá 7 días gratis →
            </Link>
          </div>

          {/* WA contacto */}
          <a
            href="https://wa.me/543482277706?text=Hola!%20Quiero%20acceder%20a%20TallerOS"
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/8 py-3 text-sm font-semibold text-slate-400 transition hover:border-[#25D366]/40 hover:text-[#25D366]"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Solicitar acceso por WhatsApp
          </a>

          {/* Back to landing */}
          <div className="mt-5 text-center">
            <Link
              href="/landing"
              className="text-xs font-medium text-slate-600 transition hover:text-slate-400"
            >
              ← Volver a la página de inicio
            </Link>
          </div>
        </div>

        {/* ── Crédito FAM ── */}
        <div className="mt-8 text-center">
          <div className="group relative inline-flex items-center gap-1.5">
            <p className="text-[11px] text-slate-700">Desarrollado por</p>
            <span className="relative cursor-default">
              <span className="text-[11px] font-bold text-slate-500 transition group-hover:text-orange-400">
                FAM Soluciones
              </span>
              {/* Tooltip teléfono */}
              <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-white opacity-0 shadow-xl transition-all duration-200 group-hover:-translate-y-1 group-hover:opacity-100">
                📱 3482277706
                <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-800" />
              </span>
            </span>
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
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
