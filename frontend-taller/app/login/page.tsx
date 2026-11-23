"use client";

/**
 * app/login/page.tsx — Entrar a Tallerista.
 *
 * Una sola tarjeta blanca al centro, sobre la franja oscura de la marca y el
 * gris de estudio de la portada. Sin mockups ni distracciones: entrar y listo.
 */

import { MarcaTallerista } from "@/components/marca-tallerista";
import { useState, useEffect, type FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { saveSession, getSession, clearSession, esMismoUsuario, sesionDesdeDjango, buildOlvideWALink, WA_SOPORTE } from "@/lib/trial";
import { loginDjango } from "@/lib/api";

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
  const [hidratado,  setHidratado]  = useState(false);

  useEffect(() => {
    setHidratado(true);
    // Si esta página llegó a mostrarse es porque no hay cookie de sesión:
    // con cookie, proxy.ts redirige al panel antes de renderizarla. Así que
    // cualquier sesión guardada en el navegador es vieja (la cookie vence a
    // los 30 días, el localStorage no). Antes se redirigía a "/" confiando en
    // ella, y como sin cookie "/" es la portada, el usuario quedaba rebotando
    // entre portada y login sin poder volver a entrar nunca.
    if (getSession()) clearSession();
    if (searchParams.get("expired") === "1") setExpiredMsg(true);
  }, [searchParams]);

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
      const sameUser = esMismoUsuario(prev, auth);
      if (!sameUser) clearSession();
      saveSession(sesionDesdeDjango(auth, sameUser ? prev : null));
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

  const campo = "h-12 w-full rounded-xl border border-slate-300 bg-white pl-11 text-[15px] text-slate-900 outline-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/15";

  return (
    <div className="relative flex min-h-dvh flex-col overflow-hidden" style={{ background: "linear-gradient(#f3f3f4, #e9eaec 55%, #e3e4e6)" }}>
      {/* Franja oscura de la marca: la tarjeta queda mitad adentro, mitad afuera */}
      <div className="absolute inset-x-0 top-0 h-[50dvh] min-h-[330px] overflow-hidden bg-[#0f1113]">
        {/* El taller de la portada, quieto y oscurecido: da contexto sin distraer */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/taller-hero-poster.jpg" alt="" aria-hidden="true" className="absolute inset-0 h-full w-full scale-110 object-cover object-[50%_35%] opacity-50 blur-[6px] saturate-[.3]" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgba(15,17,19,.55) 0%, rgba(15,17,19,.75) 60%, rgba(15,17,19,.96) 100%)" }} aria-hidden="true" />
      </div>

      <main className="relative flex flex-1 flex-col items-center justify-center px-4 py-10">
        {/* Marca */}
        <Link href="/landing" className="flex flex-col items-center gap-3 text-center" aria-label="Tallerista, ir a la página de inicio">
          <MarcaTallerista className="h-14 w-14 shadow-2xl shadow-brand-600/30 [border-radius:1rem]" />
          <span className="font-display text-3xl font-extrabold tracking-tight text-white">Tallerista</span>
        </Link>
        <p className="mt-2 text-sm text-zinc-400">El sistema de tu taller</p>

        {/* ── Tarjeta de acceso ── */}
        <div className="mt-9 w-full max-w-[420px] rounded-3xl bg-white p-7 shadow-[0_40px_80px_-30px_rgba(15,17,19,.45),0_0_0_1px_rgba(15,17,19,.06)] sm:p-9">
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-slate-900">Entrá a tu taller</h1>
          <p className="mt-1.5 text-[15px] text-slate-500">Con tu usuario o email y tu contraseña.</p>

          {/* Banner sesión expirada */}
          {expiredMsg && (
            <div className="mt-5 flex items-center gap-2.5 rounded-xl bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800 ring-1 ring-amber-200 animate-in slide-in-from-top-2">
              <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Tu sesión venció. Volvé a entrar.
            </div>
          )}

          {/* method="post": si un gestor de contraseñas llega a disparar un submit
              nativo antes de que React lo intercepte, que mande la contraseña en
              el body y no en la URL. suppressHydrationWarning: esas extensiones
              inyectan atributos (__gcruniqueid, etc.) antes de hidratar. */}
          <form onSubmit={handleSubmit} method="post" suppressHydrationWarning className="mt-7 space-y-5">
            <div>
              <label htmlFor="usuario" className="mb-1.5 block text-sm font-medium text-slate-700">Usuario o email</label>
              <div className="relative">
                <svg className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                <input
                  id="usuario"
                  type="text"
                  value={identifier}
                  onChange={e => { setIdentifier(e.target.value); setError(""); }}
                  placeholder="Ej: juan.perez"
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  suppressHydrationWarning
                  data-lpignore="true"
                  data-1p-ignore=""
                  className={`${campo} pr-4`}
                />
              </div>
            </div>

            {/* El link de recuperar va después del campo en el HTML (la grilla lo
                muestra arriba a la derecha): si iba primero, Tab desde el usuario
                caía en el link y Enter abría WhatsApp. */}
            <div className="grid grid-cols-[1fr_auto] items-center gap-y-1.5">
              <label htmlFor="clave" className="col-start-1 row-start-1 block text-sm font-medium text-slate-700">Contraseña</label>
              <div className="relative col-span-2 row-start-2">
                <svg className="pointer-events-none absolute left-4 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                <input
                  id="clave"
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError(""); }}
                  placeholder="Tu contraseña"
                  autoComplete="current-password"
                  suppressHydrationWarning
                  data-lpignore="true"
                  data-1p-ignore=""
                  className={`${campo} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  aria-label={showPass ? "Ocultar contraseña" : "Mostrar contraseña"}
                  aria-pressed={showPass}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center text-slate-400 transition hover:text-slate-700"
                >
                  <EyeIcon open={showPass} />
                </button>
              </div>
              <a
                href={buildOlvideWALink(identifier)}
                target="_blank"
                rel="noopener noreferrer"
                className="col-start-2 row-start-1 text-sm font-semibold text-brand-700 transition hover:text-brand-800"
              >
                ¿La olvidaste?
              </a>
            </div>

            {error && (
              <div role="alert" className="flex items-center gap-2.5 rounded-xl bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 ring-1 ring-red-200 animate-in slide-in-from-top-1">
                <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                {error}
              </div>
            )}

            {/* Submit real del form: Enter, la tecla "Ir" del celular y el autoenvío
                de los gestores de contraseñas lo necesitan. Deshabilitado hasta que
                React se engancha, así un toque temprano no recarga ni borra lo escrito. */}
            <button
              type="submit"
              disabled={loading || !hidratado}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-brand-600 text-[15px] font-bold text-white shadow-lg shadow-brand-600/25 transition hover:bg-brand-700 active:scale-[0.99] disabled:opacity-60"
            >
              {loading ? (
                <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" />Entrando…</>
              ) : (
                <>Entrar<svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" /></svg></>
              )}
            </button>
          </form>

          <p className="mt-5 flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
            Conexión segura. Tus datos quedan solo en tu taller.
          </p>
        </div>

        {/* Debajo de la tarjeta */}
        <div className="mt-7 w-full max-w-[420px] space-y-3 text-center text-[15px]">
          <p className="text-slate-600">
            ¿Todavía no usás Tallerista?{" "}
            <Link href="/registro" className="font-semibold text-brand-700 hover:text-brand-800">Probalo 7 días gratis</Link>
          </p>
          <p className="text-sm text-slate-500">
            ¿Problemas para entrar?{" "}
            <a href={`https://wa.me/${WA_SOPORTE}?text=${encodeURIComponent("Hola! No puedo entrar a Tallerista")}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-emerald-700 hover:text-emerald-800">Escribinos por WhatsApp</a>
          </p>
        </div>
      </main>

      <footer className="relative flex flex-col items-center justify-center gap-1 px-4 pb-6 text-xs text-slate-500 sm:flex-row sm:gap-3">
        <Link href="/landing" className="hover:text-slate-800">← Volver al inicio</Link>
        <span className="hidden sm:inline" aria-hidden="true">·</span>
        <p>© {new Date().getFullYear()} Tallerista · Desarrollado por <a href="https://famdesarrollos.com.ar" target="_blank" rel="noopener noreferrer" className="font-semibold text-slate-700 hover:text-brand-700">FAM Desarrollos</a></p>
      </footer>
    </div>
  );
}

// ─── Page export con Suspense boundary ────────────────────────────────────────
export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#e9eaec]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-orange-500 border-t-transparent" />
        </div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
