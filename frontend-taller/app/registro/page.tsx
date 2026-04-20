"use client";

/**
 * app/registro/page.tsx
 *
 * Registro multi-paso de TallerOS.
 * Paso 1: Datos de la cuenta (nombre, email, contraseña)
 * Paso 2: Datos del taller (nombre del taller, ciudad, teléfono)
 * Paso 3: ¡Listo! — inicia prueba de 7 días → redirect onboarding
 */

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { saveSession, clearSession } from "@/lib/trial";
import { registerDjango } from "@/lib/api";

// ─── Progress dots ────────────────────────────────────────────────────────────
function Steps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <div className="mb-8 flex items-center justify-center gap-3">
      {([1, 2, 3] as const).map((step) => (
        <div key={step} className="flex items-center gap-3">
          <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-black transition-all ${
            step < current
              ? "bg-emerald-500 text-white"
              : step === current
              ? "bg-orange-500 text-white shadow-lg shadow-orange-500/40"
              : "bg-white/10 text-slate-600"
          }`}>
            {step < current ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            ) : step}
          </div>
          {step < 3 && (
            <div className={`h-px w-8 transition-all ${step < current ? "bg-emerald-500" : "bg-white/10"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Campo de formulario ──────────────────────────────────────────────────────
function Field({
  label, type = "text", value, onChange, placeholder, required = true, hint,
}: {
  label: string; type?: string; value: string;
  onChange: (v: string) => void; placeholder: string;
  required?: boolean; hint?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-slate-500">
        {label} {required && <span className="text-orange-400">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full rounded-xl bg-white/8 py-3.5 px-4 text-sm font-medium text-white placeholder-slate-600 outline-none ring-1 ring-white/10 transition focus:bg-white/12 focus:ring-orange-500/50"
      />
      {hint && <p className="mt-1.5 text-[11px] text-slate-600">{hint}</p>}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function RegistroPage() {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Paso 1
  const [nombre, setNombre] = useState("");
  const [email, setEmail]   = useState("");
  const [pass, setPass]     = useState("");
  const [pass2, setPass2]   = useState("");
  const [showPass, setShowPass] = useState(false);

  // Paso 2
  const [tallerNombre, setTallerNombre] = useState("");
  const [tallerCiudad, setTallerCiudad] = useState("");
  const [tallerTel, setTallerTel]       = useState("");

  // ── Paso 1: validación y avance ───────────────────────────────────────────
  function handlePaso1(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!nombre.trim() || !email.trim() || !pass.trim()) {
      setError("Completá todos los campos obligatorios.");
      return;
    }
    if (pass.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres.");
      return;
    }
    if (pass !== pass2) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setStep(2);
  }

  // ── Paso 2: registrar en Django y crear sesión ───────────────────────────
  async function handlePaso2(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (!tallerNombre.trim()) {
      setError("El nombre del taller es obligatorio.");
      return;
    }
    setLoading(true);

    try {
      // Limpiar sesión anterior ANTES de crear la nueva (aislamiento de datos)
      clearSession();

      const auth = await registerDjango({
        email:         email.trim().toLowerCase(),
        password:      pass,
        nombre:        nombre.trim(),
        taller_nombre: tallerNombre.trim(),
        taller_ciudad: tallerCiudad.trim(),
        taller_tel:    tallerTel.trim(),
      });

      // Guardar sesión con el token real de Django
      saveSession({
        email:           auth.email,
        owner_nombre:    auth.nombre,
        taller_nombre:   auth.taller_nombre,
        taller_ciudad:   tallerCiudad.trim(),
        taller_tel:      tallerTel.trim(),
        trial_start:     auth.trial_start ?? new Date().toISOString(),
        onboarding_done: false,
        token:           auth.token,
        taller_id:       auth.taller_id,
        user_id:         auth.user_id,
      });

      setStep(3);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error al registrarse.";
      if (msg.includes("already") || msg.toLowerCase().includes("existe") || msg.toLowerCase().includes("email")) {
        setError("Ya existe una cuenta con ese email. ¿Querés iniciar sesión?");
      } else if (msg.includes("404") || msg.includes("Cannot")) {
        setError("No se pudo conectar con el servidor. Contactá a FAM Soluciones por WhatsApp.");
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  // ── Paso 3: ir al onboarding ──────────────────────────────────────────────
  function irAlOnboarding() {
    router.push("/onboarding");
  }

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-12">

      {/* Fondo decorativo */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[500px] -translate-x-1/2 rounded-full bg-orange-500/8 blur-3xl" />
        <div className="absolute inset-0 opacity-[0.02]" style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,1) 1px, transparent 1px)",
          backgroundSize: "50px 50px",
        }} />
      </div>

      <div className="relative w-full max-w-[400px]">

        {/* ── Marca ── */}
        <div className="mb-8 text-center">
          <Link href="/landing" className="inline-flex items-center gap-2.5 transition hover:opacity-80">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg shadow-orange-500/30">
              <span className="text-sm font-black text-white">OS</span>
            </div>
            <span className="text-lg font-black text-white">
              Taller<span className="text-orange-400">OS</span>
            </span>
          </Link>
          <p className="mt-2 text-sm text-slate-500">Creá tu cuenta gratis · 7 días de prueba</p>
        </div>

        {/* ── Card ── */}
        <div className="rounded-3xl bg-white/[0.04] p-8 ring-1 ring-white/10 backdrop-blur-xl">

          <Steps current={step} />

          {/* ═══ PASO 1: Cuenta ══════════════════════════════════════════════ */}
          {step === 1 && (
            <>
              <div className="mb-6 text-center">
                <h1 className="text-lg font-black text-white">Creá tu cuenta</h1>
                <p className="mt-1 text-xs text-slate-500">Paso 1 de 2 · Datos de acceso</p>
              </div>

              <form onSubmit={handlePaso1} className="space-y-4">
                <Field
                  label="Tu nombre"
                  value={nombre}
                  onChange={setNombre}
                  placeholder="Juan García"
                  hint="Nombre del dueño o encargado del taller"
                />
                <Field
                  label="Email"
                  type="email"
                  value={email}
                  onChange={setEmail}
                  placeholder="juan@mitaller.com"
                />
                <div>
                  <label className="mb-2 block text-[11px] font-bold uppercase tracking-widest text-slate-500">
                    Contraseña <span className="text-orange-400">*</span>
                  </label>
                  <div className="relative">
                    <input
                      type={showPass ? "text" : "password"}
                      value={pass}
                      onChange={(e) => setPass(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full rounded-xl bg-white/8 py-3.5 pl-4 pr-12 text-sm font-medium text-white placeholder-slate-600 outline-none ring-1 ring-white/10 transition focus:bg-white/12 focus:ring-orange-500/50"
                    />
                    <button type="button" onClick={() => setShowPass(!showPass)}
                      className="absolute inset-y-0 right-0 flex items-center pr-4 text-slate-600 hover:text-slate-300">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        {showPass
                          ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                        }
                      </svg>
                    </button>
                  </div>
                </div>
                <Field
                  label="Repetir contraseña"
                  type={showPass ? "text" : "password"}
                  value={pass2}
                  onChange={setPass2}
                  placeholder="Repetí la contraseña"
                />

                {error && (
                  <div className="animate-in slide-in-from-top-2 rounded-xl bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-400 ring-1 ring-red-500/20">
                    {error}
                  </div>
                )}

                <button type="submit"
                  className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-500/20 transition hover:from-orange-600 hover:to-orange-700 active:scale-[0.98]"
                >
                  Continuar →
                </button>
              </form>
            </>
          )}

          {/* ═══ PASO 2: Taller ══════════════════════════════════════════════ */}
          {step === 2 && (
            <>
              <div className="mb-6 text-center">
                <h1 className="text-lg font-black text-white">Tu taller</h1>
                <p className="mt-1 text-xs text-slate-500">Paso 2 de 2 · Así aparecerá en tus documentos</p>
              </div>

              <form onSubmit={handlePaso2} className="space-y-4">
                <Field
                  label="Nombre del taller"
                  value={tallerNombre}
                  onChange={setTallerNombre}
                  placeholder="Ej: Taller García, El Pocho Mecánica…"
                  hint="Aparecerá en presupuestos y órdenes de trabajo"
                />
                <Field
                  label="Ciudad"
                  value={tallerCiudad}
                  onChange={setTallerCiudad}
                  placeholder="Ej: Rafaela, Santa Fe"
                  required={false}
                />
                <Field
                  label="WhatsApp del taller"
                  type="tel"
                  value={tallerTel}
                  onChange={setTallerTel}
                  placeholder="Ej: 3482 123456"
                  required={false}
                  hint="Lo usamos para que tus clientes te contacten"
                />

                {/* Vista previa del header del taller */}
                {tallerNombre && (
                  <div className="rounded-2xl bg-slate-800/60 p-4 ring-1 ring-white/10">
                    <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-slate-500">Vista previa del panel</p>
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-500 text-xs font-black text-white">
                        {tallerNombre.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">{tallerNombre}</p>
                        <p className="text-[10px] text-slate-400">
                          {tallerCiudad || "Tu ciudad"} · TallerOS
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="rounded-xl bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-400 ring-1 ring-red-500/20">
                    {error}
                  </div>
                )}

                <div className="flex gap-3">
                  <button type="button" onClick={() => setStep(1)}
                    className="flex-1 rounded-xl border border-white/10 py-3.5 text-sm font-bold text-slate-400 transition hover:border-white/20 hover:text-white"
                  >
                    ← Atrás
                  </button>
                  <button type="submit" disabled={loading}
                    className="flex-1 rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-500/20 transition hover:from-orange-600 hover:to-orange-700 disabled:opacity-60 active:scale-[0.98]"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-orange-300 border-t-white" />
                        Creando…
                      </span>
                    ) : "Empezar prueba 🚀"}
                  </button>
                </div>
              </form>
            </>
          )}

          {/* ═══ PASO 3: ¡Listo! ════════════════════════════════════════════ */}
          {step === 3 && (
            <div className="text-center">
              {/* Animación confetti simple */}
              <div className="mb-6 text-6xl">🎉</div>
              <h1 className="text-xl font-black text-white">¡Bienvenido a TallerOS!</h1>
              <p className="mt-2 text-sm font-semibold text-orange-400">
                {tallerNombre} ya está listo
              </p>
              <p className="mt-4 text-sm leading-relaxed text-slate-400">
                Tu período de prueba gratuita de <strong className="text-white">7 días</strong> arrancó ahora.
                Vas a ver el contador en la parte superior del panel.
              </p>

              <div className="my-6 rounded-2xl bg-emerald-500/10 px-5 py-4 ring-1 ring-emerald-500/20">
                <p className="text-sm font-bold text-emerald-400">
                  ✓ Tu prueba termina el {new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString("es-AR", { day: "numeric", month: "long" })}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Cuando termine, te avisamos por este sistema para que la actives.
                </p>
              </div>

              <button
                onClick={irAlOnboarding}
                className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 py-4 text-sm font-black text-white shadow-lg shadow-orange-500/20 transition hover:from-orange-600 hover:to-orange-700 active:scale-[0.98]"
              >
                Empezar a usar el taller →
              </button>
            </div>
          )}
        </div>

        {/* Link a login */}
        {step < 3 && (
          <p className="mt-6 text-center text-xs text-slate-600">
            ¿Ya tenés cuenta?{" "}
            <Link href="/login" className="font-bold text-slate-400 transition hover:text-orange-400">
              Iniciá sesión
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
