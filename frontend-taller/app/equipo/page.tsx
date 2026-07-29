"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { actualizarMiembro, crearInvitacion, getEquipo, type MiembroEquipo } from "@/lib/api";

const ROLES = ["ADMIN", "RECEPCION", "MECANICO", "CONTADOR"];
const NOMBRES: Record<string, string> = { ADMIN: "Administrador", RECEPCION: "Recepción", MECANICO: "Mecánico", CONTADOR: "Contador" };
const DESCRIPCIONES: Record<string, string> = {
  ADMIN: "Control completo del taller y del equipo.",
  RECEPCION: "Clientes, turnos, presupuestos y operación diaria.",
  MECANICO: "Órdenes de trabajo y seguimiento técnico.",
  CONTADOR: "Caja, cobros, gastos y reportes financieros.",
};

function iniciales(nombre: string) {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((parte) => parte[0]).join("").toUpperCase() || "US";
}

export default function EquipoPage() {
  const [miembros, setMiembros] = useState<MiembroEquipo[]>([]);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roleOpen, setRoleOpen] = useState(false);
  const [form, setForm] = useState({ email: "", rol: "MECANICO" });
  const [inviteLink, setInviteLink] = useState("");

  useEffect(() => {
    getEquipo()
      .then(setMiembros)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : "No se pudo cargar el equipo."))
      .finally(() => setLoading(false));
  }, []);

  const activos = useMemo(() => miembros.filter((miembro) => miembro.activo).length, [miembros]);

  async function invitar(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setSuccess("");
    try {
      const result = await crearInvitacion(form);
      const path = result.message.replace("Invitación creada: ", "");
      setInviteLink(`${window.location.origin}${path}`);
      setSuccess("Invitación generada. Copiá el enlace y compartilo con la persona.");
      setForm({ email: "", rol: "MECANICO" });
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo generar la invitación.");
    } finally {
      setSaving(false);
    }
  }

  async function copiarLink() {
    await navigator.clipboard.writeText(inviteLink);
    setSuccess("Enlace copiado al portapapeles.");
  }

  async function cambiar(miembro: MiembroEquipo, payload: { rol?: string; activo?: boolean }) {
    setError("");
    try {
      const actualizado = await actualizarMiembro(miembro.id, payload);
      setMiembros((actuales) => actuales.map((item) => item.id === miembro.id ? actualizado : item));
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo actualizar el acceso.");
    }
  }

  return (
    <AppShell currentPath="/equipo" badge="Administración" title="Equipo y accesos" description="Personas, roles y seguridad de tu taller en un solo lugar.">
      <div className="space-y-6">
        <section className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Miembros", value: miembros.length, detail: "accesos registrados" },
            { label: "Activos", value: activos, detail: "pueden ingresar" },
            { label: "Roles", value: new Set(miembros.map((m) => m.rol)).size, detail: "perfiles en uso" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{stat.label}</p>
              <div className="mt-2 flex items-end gap-2">
                <strong className="text-3xl font-black text-slate-900 dark:text-white">{stat.value}</strong>
                <span className="pb-1 text-xs text-slate-500">{stat.detail}</span>
              </div>
            </div>
          ))}
        </section>

        {(error || success) && (
          <div className={`rounded-2xl border px-5 py-4 text-sm font-semibold ${error ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300" : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-300"}`}>
            {error || success}
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
          <form onSubmit={invitar} className="h-fit rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-xl font-black text-slate-900 dark:text-white">Invitar una persona</h2>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">Generá un enlace privado. La persona elegirá su contraseña y el enlace vencerá automáticamente.</p>

            <label className="mt-6 block text-xs font-bold uppercase tracking-wider text-slate-500">Correo electrónico</label>
            <input required type="email" placeholder="persona@taller.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-orange-500 focus:ring-4 focus:ring-orange-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white" />

            <label className="mt-4 block text-xs font-bold uppercase tracking-wider text-slate-500">Rol inicial</label>
            <div className="relative mt-2">
              <button
                type="button"
                aria-haspopup="listbox"
                aria-expanded={roleOpen}
                onClick={() => setRoleOpen((open) => !open)}
                className={`flex w-full items-center gap-3 rounded-xl border bg-slate-50 px-4 py-3 text-left transition dark:bg-slate-950 ${
                  roleOpen
                    ? "border-orange-500 ring-4 ring-orange-500/10"
                    : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
                }`}
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-sm font-black text-orange-600 dark:bg-orange-950/60 dark:text-orange-400">
                  {form.rol === "ADMIN" ? "A" : form.rol === "RECEPCION" ? "R" : form.rol === "CONTADOR" ? "C" : "M"}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-slate-900 dark:text-white">{NOMBRES[form.rol]}</span>
                </span>
                <svg className={`h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 ${roleOpen ? "rotate-180 text-orange-500" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="m6 9 6 6 6-6" />
                </svg>
              </button>

              {roleOpen && (
                <div role="listbox" className="absolute left-0 right-0 top-full z-50 mt-2 max-h-56 overflow-y-auto rounded-2xl border border-slate-200 bg-white p-1.5 shadow-2xl shadow-slate-900/15 dark:border-slate-700 dark:bg-slate-900">
                  {ROLES.map((rol) => {
                    const selected = rol === form.rol;
                    return (
                      <button
                        key={rol}
                        type="button"
                        role="option"
                        aria-selected={selected}
                        onClick={() => {
                          setForm({ ...form, rol });
                          setRoleOpen(false);
                        }}
                        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition ${
                          selected
                            ? "bg-orange-50 dark:bg-orange-950/40"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800"
                        }`}
                      >
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-black ${
                          selected
                            ? "bg-orange-500 text-white"
                            : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-300"
                        }`}>
                          {rol === "ADMIN" ? "A" : rol === "RECEPCION" ? "R" : rol === "CONTADOR" ? "C" : "M"}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-bold text-slate-900 dark:text-white">{NOMBRES[rol]}</span>
                        </span>
                        {selected && (
                          <svg className="h-5 w-5 shrink-0 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="m5 12 4 4L19 6" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <details className="group mt-3 rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950/60">
              <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-xs font-bold text-slate-600 dark:text-slate-300">
                ¿Qué puede hacer cada rol?
                <svg className="h-4 w-4 text-slate-400 transition group-open:rotate-180" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="m6 9 6 6 6-6" />
                </svg>
              </summary>
              <div className="space-y-2 border-t border-slate-200 px-4 py-3 dark:border-slate-800">
                {ROLES.map((rol) => (
                  <div key={rol} className="grid grid-cols-[90px_1fr] gap-2 text-xs">
                    <strong className="text-slate-700 dark:text-slate-200">{NOMBRES[rol]}</strong>
                    <span className="text-slate-500">{DESCRIPCIONES[rol]}</span>
                  </div>
                ))}
              </div>
            </details>
            <button disabled={saving} className="mt-6 w-full rounded-xl bg-gradient-to-r from-orange-500 to-orange-600 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-orange-500/20 transition hover:-translate-y-0.5 disabled:opacity-60">
              {saving ? "Generando enlace…" : "Generar invitación segura"}
            </button>

            {inviteLink && (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900/60 dark:bg-emerald-950/30">
                <p className="truncate text-xs text-emerald-800 dark:text-emerald-300">{inviteLink}</p>
                <button type="button" onClick={copiarLink} className="mt-3 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white">Copiar enlace</button>
              </div>
            )}
          </form>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-black text-slate-900 dark:text-white">Personas con acceso</h2>
                <p className="mt-1 text-sm text-slate-500">Administrá permisos sin compartir contraseñas.</p>
              </div>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{activos} activos</span>
            </div>

            <div className="mt-6 space-y-3">
              {loading ? (
                <div className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
              ) : miembros.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 px-6 py-12 text-center dark:border-slate-700">
                  <p className="font-bold text-slate-700 dark:text-slate-200">Todavía no hay miembros</p>
                  <p className="mt-1 text-sm text-slate-500">Generá la primera invitación desde el formulario.</p>
                </div>
              ) : miembros.map((miembro) => (
                <article key={miembro.id} className={`flex flex-col gap-4 rounded-2xl border p-4 transition sm:flex-row sm:items-center ${miembro.activo ? "border-slate-200 dark:border-slate-800" : "border-slate-200 bg-slate-50 opacity-65 dark:border-slate-800 dark:bg-slate-950/50"}`}>
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-orange-700 text-sm font-black text-white">{iniciales(miembro.nombre)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="truncate font-bold text-slate-900 dark:text-white">{miembro.nombre}</h3>
                      <span className={`h-2 w-2 rounded-full ${miembro.activo ? "bg-emerald-500" : "bg-slate-400"}`} />
                    </div>
                    <p className="truncate text-sm text-slate-500">{miembro.email}</p>
                  </div>
                  <select value={miembro.rol} onChange={(e) => cambiar(miembro, { rol: e.target.value })} className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold dark:border-slate-700 dark:bg-slate-950 dark:text-white">
                    {ROLES.map((rol) => <option key={rol} value={rol}>{NOMBRES[rol]}</option>)}
                  </select>
                  <button onClick={() => cambiar(miembro, { activo: !miembro.activo })} className={`rounded-xl border px-4 py-2 text-sm font-bold transition ${miembro.activo ? "border-red-200 text-red-600 hover:bg-red-50 dark:border-red-900/60 dark:text-red-400" : "border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-900/60 dark:text-emerald-400"}`}>
                    {miembro.activo ? "Desactivar" : "Activar"}
                  </button>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </AppShell>
  );
}
