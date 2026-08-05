"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { buildPublicApiUrl } from "@/lib/api";

export default function RecuperarContrasenaPage() {
  const { id, token } = useParams<{ id: string; token: string }>();
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [mostrar, setMostrar] = useState(false);
  const [estado, setEstado] = useState<{ tone: "idle" | "error" | "success"; message: string }>({ tone: "idle", message: "" });
  const [guardando, setGuardando] = useState(false);

  async function restablecer(event: React.FormEvent) {
    event.preventDefault();
    if (password.length < 8) {
      setEstado({ tone: "error", message: "La contraseña debe tener al menos 8 caracteres." });
      return;
    }
    if (password !== confirmacion) {
      setEstado({ tone: "error", message: "Las contraseñas no coinciden." });
      return;
    }
    setGuardando(true);
    setEstado({ tone: "idle", message: "" });
    try {
      const response = await fetch(buildPublicApiUrl(`/public/recuperacion/${id}/${token}/`), {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ password }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.detail || data.message || "No se pudo actualizar la contraseña.");
      setEstado({ tone: "success", message: "Contraseña actualizada. Te llevamos al ingreso…" });
      window.setTimeout(() => router.push("/login"), 1400);
    } catch (error) {
      setEstado({ tone: "error", message: error instanceof Error ? error.message : "No se pudo actualizar la contraseña." });
    } finally {
      setGuardando(false);
    }
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#07101f] px-5 py-10 text-white">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -left-32 top-0 h-96 w-96 rounded-full bg-violet-500/15 blur-3xl" />
        <div className="absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-orange-500/10 blur-3xl" />
      </div>
      <section className="relative w-full max-w-md rounded-[2rem] border border-white/10 bg-slate-900/90 p-7 shadow-2xl shadow-black/30 backdrop-blur-xl sm:p-9">
        <Link href="/landing" className="text-lg font-black tracking-tight">Tallerista</Link>
        <p className="mt-10 text-[10px] font-black uppercase tracking-[0.18em] text-violet-300">Recuperación segura</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight">Creá tu nueva contraseña</h1>
        <p className="mt-3 text-sm leading-relaxed text-slate-400">Por seguridad, al confirmarla se cerrarán tus sesiones anteriores.</p>

        <form onSubmit={restablecer} className="mt-8 space-y-5">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Nueva contraseña</label>
            <div className="relative mt-2">
              <input required minLength={8} autoComplete="new-password" type={mostrar ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Mínimo 8 caracteres" className="w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3.5 pr-20 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10" />
              <button type="button" onClick={() => setMostrar((value) => !value)} className="absolute inset-y-0 right-3 my-auto h-8 rounded-lg px-2 text-xs font-bold text-slate-400 transition hover:bg-slate-800 hover:text-white">{mostrar ? "Ocultar" : "Ver"}</button>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-slate-400">Repetí la contraseña</label>
            <input required minLength={8} autoComplete="new-password" type={mostrar ? "text" : "password"} value={confirmacion} onChange={(event) => setConfirmacion(event.target.value)} placeholder="Repetí tu contraseña" className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-950/70 px-4 py-3.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-violet-500 focus:ring-4 focus:ring-violet-500/10" />
          </div>
          {estado.message && <div className={`rounded-xl border px-4 py-3 text-sm font-semibold ${estado.tone === "success" ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300" : "border-red-500/20 bg-red-500/10 text-red-300"}`}>{estado.message}</div>}
          <button disabled={guardando || estado.tone === "success"} className="w-full rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 px-5 py-4 text-sm font-black text-white shadow-xl shadow-violet-500/20 transition hover:-translate-y-0.5 disabled:translate-y-0 disabled:opacity-60">{guardando ? "Actualizando…" : estado.tone === "success" ? "Contraseña actualizada" : "Actualizar contraseña"}</button>
        </form>
        <p className="mt-6 text-center text-xs text-slate-500">¿Recordaste tu clave? <Link href="/login" className="font-bold text-slate-300 hover:text-white">Iniciar sesión</Link></p>
      </section>
    </main>
  );
}
