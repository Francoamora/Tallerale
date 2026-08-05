"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { buildPublicApiUrl } from "@/lib/api";

export default function AceptarInvitacionPage() {
  const { token } = useParams<{ token: string }>();
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: "idle" | "error" | "success"; message: string }>({ tone: "idle", message: "" });
  const [loading, setLoading] = useState(false);

  const passwordChecks = useMemo(() => ({
    length: password.length >= 8,
    letter: /[A-Za-zÁÉÍÓÚáéíóúÑñ]/.test(password),
    number: /\d/.test(password),
  }), [password]);
  const passwordValid = Object.values(passwordChecks).every(Boolean);

  async function aceptar(event: React.FormEvent) {
    event.preventDefault();
    if (!passwordValid) {
      setFeedback({ tone: "error", message: "La contraseña todavía no cumple todos los requisitos." });
      return;
    }
    setLoading(true);
    setFeedback({ tone: "idle", message: "" });
    try {
      const response = await fetch(buildPublicApiUrl(`/public/invitaciones/${token}/aceptar`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim(), password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || data.message || "No se pudo aceptar la invitación.");
      setFeedback({ tone: "success", message: "Tu acceso fue creado. Te llevamos al ingreso…" });
      window.setTimeout(() => router.push("/login"), 1200);
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No se pudo aceptar la invitación." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#07101f] px-5 py-10 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-orange-500/10 blur-3xl" />
        <div className="absolute -bottom-40 right-0 h-[500px] w-[500px] rounded-full bg-blue-500/10 blur-3xl" />
      </div>

      <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] max-w-5xl items-center gap-12 lg:grid-cols-[1fr_440px]">
        <section className="hidden lg:block">
          <Link href="/landing" className="inline-flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 text-sm font-black shadow-lg shadow-orange-500/25">TA</span>
            <span className="text-xl font-black">Taller<span className="text-orange-500">ista</span></span>
          </Link>
          <p className="mt-14 text-xs font-black uppercase tracking-[0.25em] text-orange-400">Invitación privada</p>
          <h1 className="mt-4 max-w-xl text-5xl font-black leading-[1.05] tracking-tight">
            Tu lugar en el taller ya está preparado.
          </h1>
          <p className="mt-6 max-w-lg text-lg leading-relaxed text-slate-400">
            Creá tu acceso personal para trabajar con el equipo. Tu contraseña solo la conocés vos.
          </p>
          <div className="mt-10 grid max-w-lg gap-4">
            {[
              ["Acceso personal", "Nunca necesitás compartir tu contraseña."],
              ["Información protegida", "Solo vas a ver el taller al que te invitaron."],
              ["Permisos por rol", "Tu acceso se adapta a las tareas que te asignaron."],
            ].map(([title, detail]) => (
              <div key={title} className="flex items-start gap-4">
                <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-sm font-black text-emerald-400">✓</span>
                <div><p className="font-bold text-slate-100">{title}</p><p className="mt-0.5 text-sm text-slate-500">{detail}</p></div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[2rem] border border-white/10 bg-slate-900/85 p-6 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-9">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500 text-xs font-black">TA</span>
            <span className="font-black">Taller<span className="text-orange-500">ista</span></span>
          </div>

          <span className="inline-flex rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-orange-400">Acceso seguro</span>
          <h2 className="mt-5 text-3xl font-black tracking-tight">Sumate al equipo</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">Completá tus datos para activar la invitación. El enlace puede utilizarse una sola vez.</p>

          <form onSubmit={aceptar} className="mt-8 space-y-5">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Nombre y apellido</label>
              <input required autoComplete="name" placeholder="Ej. Juan Pérez" value={nombre} onChange={(event) => setNombre(event.target.value)} className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10" />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Crear contraseña</label>
              <div className="relative mt-2">
                <input required minLength={8} type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Mínimo 8 caracteres" value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3.5 pr-20 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10" />
                <button type="button" onClick={() => setShowPassword((show) => !show)} className="absolute inset-y-0 right-3 my-auto h-8 rounded-lg px-2 text-xs font-bold text-slate-400 transition hover:bg-slate-800 hover:text-white">{showPassword ? "Ocultar" : "Ver"}</button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  ["8 caracteres", passwordChecks.length],
                  ["Una letra", passwordChecks.letter],
                  ["Un número", passwordChecks.number],
                ].map(([label, valid]) => (
                  <span key={String(label)} className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${valid ? "bg-emerald-500/15 text-emerald-400" : "bg-slate-800 text-slate-500"}`}>{valid ? "✓ " : ""}{label}</span>
                ))}
              </div>
            </div>

            {feedback.message && (
              <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${feedback.tone === "success" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-red-500/20 bg-red-500/10 text-red-300"}`}>
                {feedback.message}
              </div>
            )}

            <button disabled={loading || feedback.tone === "success"} className="w-full rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-5 py-4 text-sm font-black text-white shadow-xl shadow-orange-500/20 transition hover:-translate-y-0.5 hover:shadow-orange-500/30 disabled:translate-y-0 disabled:opacity-60">
              {loading ? "Creando tu acceso…" : feedback.tone === "success" ? "Acceso creado" : "Aceptar invitación"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-600">¿Ya tenés una cuenta? <Link href="/login" className="font-bold text-slate-400 hover:text-orange-400">Iniciar sesión</Link></p>
        </section>
      </div>
    </main>
  );
}
