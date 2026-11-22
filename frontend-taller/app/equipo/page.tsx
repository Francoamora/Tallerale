"use client";

/**
 * Equipo y accesos: el dueño crea los usuarios de su gente (no hace falta
 * email) y les pasa el acceso por WhatsApp. Cada rol ve sólo lo suyo.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { actualizarMiembro, crearMiembro, getEquipo, sugerirUsuario, type MiembroEquipo } from "@/lib/api";
import { copiarAlPortapapeles } from "@/lib/portapapeles";
import { getSession } from "@/lib/trial";
import { cn } from "@/lib/utils";

const ROLES = [
  { value: "MECANICO", label: "Mecánico", resumen: "Ve el tablero y sus trabajos, tilda tareas y suma lo que hizo. No ve plata." },
  { value: "RECEPCION", label: "Recepción", resumen: "Atiende: clientes, turnos, presupuestos, órdenes y cobros. No ve la caja." },
  { value: "CONTADOR", label: "Contador", resumen: "Caja, cobros, gastos y la planilla del mes. No toca el taller." },
  { value: "ADMIN", label: "Administrador", resumen: "Todo, incluida la configuración y el equipo." },
] as const;
const NOMBRE_ROL: Record<string, string> = Object.fromEntries(ROLES.map((r) => [r.value, r.label]));

/** Qué puede hacer cada rol (es lo mismo que controla el servidor). */
const PERMISOS: { tarea: string; roles: string[] }[] = [
  { tarea: "Tablero y tildar tareas", roles: ["ADMIN", "RECEPCION", "MECANICO"] },
  { tarea: "Clientes y vehículos", roles: ["ADMIN", "RECEPCION", "CONTADOR"] },
  { tarea: "Órdenes, presupuestos y turnos", roles: ["ADMIN", "RECEPCION"] },
  { tarea: "Ver precios y cobrar", roles: ["ADMIN", "RECEPCION", "CONTADOR"] },
  { tarea: "Caja, gastos y planilla del contador", roles: ["ADMIN", "CONTADOR"] },
  { tarea: "Configuración y equipo", roles: ["ADMIN"] },
];

const campo =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white";

/** Contraseña fácil de dictar o tipear en el celular: palabra + 4 números. */
function generarClave() {
  const palabras = ["tuerca", "piston", "embrague", "bujia", "correa", "freno", "llanta", "motor", "cardan", "radiador", "tornillo", "palanca"];
  const azar = new Uint32Array(2);
  crypto.getRandomValues(azar);
  return `${palabras[azar[0] % palabras.length]}${String(1000 + (azar[1] % 9000))}`;
}

function iniciales(nombre: string) {
  return nombre.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase() || "U";
}

type Acceso = { nombre: string; usuario: string; clave: string; nuevo: boolean };

export default function EquipoPage() {
  const [miembros, setMiembros] = useState<MiembroEquipo[]>([]);
  const [loading, setLoading] = useState(true);
  const [aviso, setAviso] = useState<{ texto: string; error?: boolean } | null>(null);
  const [tallerNombre, setTallerNombre] = useState("");

  const [nombre, setNombre] = useState("");
  const [rol, setRol] = useState("MECANICO");
  const [usuario, setUsuario] = useState("");
  const [usuarioTocado, setUsuarioTocado] = useState(false);
  const [clave, setClave] = useState(generarClave);
  const [guardando, setGuardando] = useState(false);
  const [acceso, setAcceso] = useState<Acceso | null>(null);
  const [verPermisos, setVerPermisos] = useState(false);
  const pedidoSugerencia = useRef(0);

  useEffect(() => {
    setTallerNombre(getSession()?.taller_nombre ?? "");
    getEquipo()
      .then(setMiembros)
      .catch((e: unknown) => setAviso({ texto: e instanceof Error ? e.message : "No se pudo cargar el equipo.", error: true }))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!aviso) return;
    const t = window.setTimeout(() => setAviso(null), 3500);
    return () => window.clearTimeout(t);
  }, [aviso]);

  // Mientras escribe el nombre, se propone un usuario libre ("juan.sanmartin").
  useEffect(() => {
    if (usuarioTocado || nombre.trim().length < 2) return;
    const pedido = ++pedidoSugerencia.current;
    const t = window.setTimeout(() => {
      sugerirUsuario(nombre.trim())
        .then((r) => { if (pedido === pedidoSugerencia.current) setUsuario(r.usuario); })
        .catch(() => {});
    }, 350);
    return () => window.clearTimeout(t);
  }, [nombre, usuarioTocado]);

  const activos = useMemo(() => miembros.filter((m) => m.activo).length, [miembros]);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (nombre.trim().length < 2) return setAviso({ texto: "Escribí el nombre de la persona.", error: true });
    if (!usuario.trim()) return setAviso({ texto: "Falta el usuario.", error: true });
    if (clave.length < 8) return setAviso({ texto: "La contraseña tiene que tener al menos 8 caracteres.", error: true });
    setGuardando(true);
    try {
      const nuevo = await crearMiembro({ nombre: nombre.trim(), usuario: usuario.trim().toLowerCase(), password: clave, rol });
      setMiembros((actuales) => [...actuales, nuevo]);
      setAcceso({ nombre: nuevo.nombre, usuario: nuevo.usuario, clave, nuevo: true });
      setNombre("");
      setUsuario("");
      setUsuarioTocado(false);
      setClave(generarClave());
    } catch (err) {
      setAviso({ texto: err instanceof Error ? err.message : "No se pudo crear el acceso.", error: true });
    } finally {
      setGuardando(false);
    }
  }

  async function cambiar(m: MiembroEquipo, payload: { rol?: string; activo?: boolean }) {
    try {
      const actualizado = await actualizarMiembro(m.id, payload);
      setMiembros((actuales) => actuales.map((x) => (x.id === m.id ? actualizado : x)));
      setAviso({ texto: payload.activo === false ? `${m.nombre} ya no puede entrar.` : payload.activo ? `${m.nombre} puede volver a entrar.` : `${m.nombre} ahora es ${NOMBRE_ROL[actualizado.rol]}.` });
    } catch (err) {
      setAviso({ texto: err instanceof Error ? err.message : "No se pudo actualizar.", error: true });
    }
  }

  async function nuevaClave(m: MiembroEquipo) {
    const nueva = generarClave();
    try {
      await actualizarMiembro(m.id, { password: nueva });
      setAcceso({ nombre: m.nombre, usuario: m.usuario, clave: nueva, nuevo: false });
    } catch (err) {
      setAviso({ texto: err instanceof Error ? err.message : "No se pudo cambiar la contraseña.", error: true });
    }
  }

  return (
    <AppShell currentPath="/equipo" compact badge="Administración" title="Equipo y accesos" description="Creale un usuario a cada persona del taller y elegí qué puede ver.">
      {aviso && (
        <div role="status" className={cn("fixed bottom-6 right-6 z-50 max-w-sm rounded-xl px-5 py-3 text-sm font-semibold text-white shadow-2xl", aviso.error ? "bg-red-600" : "bg-slate-900 dark:bg-slate-700")}>
          {aviso.texto}
        </div>
      )}

      <div className="grid items-start gap-4 lg:grid-cols-[400px_minmax(0,1fr)]">
        {/* Crear acceso */}
        <form onSubmit={crear} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-6 lg:sticky lg:top-24">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Sumar a alguien</h2>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">No hace falta email: le creás el usuario y se lo pasás por WhatsApp.</p>

          <label className="mt-5 block">
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Nombre</span>
            <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Juan Pérez" className={campo} />
          </label>

          <fieldset className="mt-4">
            <legend className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-300">¿Qué hace en el taller?</legend>
            <div className="space-y-1.5" role="radiogroup">
              {ROLES.map((r) => {
                const activo = rol === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    role="radio"
                    aria-checked={activo}
                    onClick={() => setRol(r.value)}
                    className={cn("flex w-full items-start gap-3 rounded-xl px-3.5 py-2.5 text-left ring-1 ring-inset transition", activo ? "bg-brand-50 ring-2 ring-brand-500 dark:bg-brand-950/30" : "ring-slate-200 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-700/40")}
                  >
                    <span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full ring-2 ring-inset", activo ? "bg-brand-600 ring-brand-600" : "ring-slate-300 dark:ring-slate-600")}>
                      {activo && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold text-slate-900 dark:text-white">{r.label}</span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">{r.resumen}</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </fieldset>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Usuario</span>
              <input
                value={usuario}
                onChange={(e) => { setUsuario(e.target.value.toLowerCase().replace(/\s/g, "")); setUsuarioTocado(true); }}
                placeholder="juan.taller"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className={cn(campo, "font-medium")}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 flex items-center justify-between text-sm font-medium text-slate-700 dark:text-slate-300">
                Contraseña
                <button type="button" onClick={() => setClave(generarClave())} className="text-xs font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-300">Otra</button>
              </span>
              <input value={clave} onChange={(e) => setClave(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} className={cn(campo, "font-medium")} />
            </label>
          </div>
          <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Con esto entra desde cualquier celular o compu. Después puede cambiarla.</p>

          <button type="submit" disabled={guardando} className="mt-5 flex h-11 w-full items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60">
            {guardando ? "Creando…" : "Crear acceso"}
          </button>
        </form>

        <div className="min-w-0 space-y-4">
          {/* Lista */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5 dark:border-slate-700">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Quiénes entran al sistema</h2>
              <span className="text-sm text-slate-500 dark:text-slate-400">{activos} {activos === 1 ? "activo" : "activos"}</span>
            </header>
            {loading ? (
              <div className="space-y-2 p-4">{[1, 2].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-700/50" />)}</div>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-700/70">
                {miembros.map((m) => (
                  <li key={m.id} className={cn("flex flex-col gap-3 px-5 py-3.5 sm:flex-row sm:items-center", !m.activo && "opacity-55")}>
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-200">{iniciales(m.nombre)}</span>
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 truncate text-sm font-semibold text-slate-900 dark:text-white">
                          {m.nombre}
                          {m.es_dueno && <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-semibold text-brand-700 dark:bg-brand-950/40 dark:text-brand-300">Dueño</span>}
                          {!m.activo && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-700">Sin acceso</span>}
                        </p>
                        <p className="truncate text-xs text-slate-500 dark:text-slate-400">Usuario: <span className="font-medium text-slate-700 dark:text-slate-300">{m.usuario}</span></p>
                      </div>
                    </div>
                    {m.es_dueno ? (
                      <span className="text-sm text-slate-500 dark:text-slate-400 sm:w-40 sm:text-right">Administrador</span>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <select
                          value={m.rol}
                          onChange={(e) => void cambiar(m, { rol: e.target.value })}
                          aria-label={`Rol de ${m.nombre}`}
                          className="h-9 rounded-lg border border-slate-200 bg-white px-2.5 text-sm text-slate-800 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                        >
                          {ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                        </select>
                        <button type="button" onClick={() => void nuevaClave(m)} className="h-9 rounded-lg px-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700">
                          Nueva contraseña
                        </button>
                        <button
                          type="button"
                          onClick={() => void cambiar(m, { activo: !m.activo })}
                          className={cn("h-9 rounded-lg px-2.5 text-sm font-semibold transition", m.activo ? "text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30" : "text-emerald-700 hover:bg-emerald-50 dark:text-emerald-400")}
                        >
                          {m.activo ? "Quitar acceso" : "Devolver acceso"}
                        </button>
                      </div>
                    )}
                  </li>
                ))}
                {miembros.length <= 1 && (
                  <li className="px-5 py-6 text-center text-sm text-slate-500 dark:text-slate-400">Todavía sos el único. Sumá a tus mecánicos o a quien atiende desde el formulario.</li>
                )}
              </ul>
            )}
          </section>

          {/* Qué puede hacer cada rol */}
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <button type="button" onClick={() => setVerPermisos((v) => !v)} aria-expanded={verPermisos} className="flex w-full items-center justify-between gap-3 px-5 py-3.5 text-left">
              <span className="text-base font-semibold text-slate-900 dark:text-white">Qué puede hacer cada uno</span>
              <span className="text-sm font-semibold text-brand-700 dark:text-brand-300">{verPermisos ? "Ocultar" : "Ver"}</span>
            </button>
            {verPermisos && (
              <div className="overflow-x-auto border-t border-slate-100 dark:border-slate-700">
                <table className="w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 dark:text-slate-400">
                      <th className="px-5 py-2.5 font-medium" />
                      {ROLES.map((r) => <th key={r.value} className="px-3 py-2.5 text-center font-medium">{r.label}</th>)}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/70">
                    {PERMISOS.map((p) => (
                      <tr key={p.tarea}>
                        <td className="px-5 py-2.5 text-slate-700 dark:text-slate-200">{p.tarea}</td>
                        {ROLES.map((r) => (
                          <td key={r.value} className="px-3 py-2.5 text-center">
                            {p.roles.includes(r.value) ? <span className="font-bold text-emerald-600" aria-label="Sí">✓</span> : <span className="text-slate-300 dark:text-slate-600" aria-label="No">—</span>}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>

      {acceso && <PasarAcceso acceso={acceso} tallerNombre={tallerNombre} onCerrar={() => setAcceso(null)} />}
    </AppShell>
  );
}

/** Muestra el usuario y la contraseña una sola vez, listos para mandar. */
function PasarAcceso({ acceso, tallerNombre, onCerrar }: { acceso: Acceso; tallerNombre: string; onCerrar: () => void }) {
  const [copiado, setCopiado] = useState(false);
  // Se abre sólo después de una acción del usuario, así que siempre corre en el navegador.
  const origen = typeof window !== "undefined" ? window.location.origin : "";
  const nombre = acceso.nombre.split(" ")[0];
  const texto = `Hola ${nombre}! ${acceso.nuevo ? `Te creé el usuario para entrar al sistema${tallerNombre ? ` de ${tallerNombre}` : ""}` : "Te cambié la contraseña del sistema"}:\n\n${origen}/login\nUsuario: ${acceso.usuario}\nContraseña: ${acceso.clave}\n\nDespués la podés cambiar.`;

  async function copiar() {
    if (await copiarAlPortapapeles(texto)) {
      setCopiado(true);
      window.setTimeout(() => setCopiado(false), 2000);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="titulo-acceso">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
        <h2 id="titulo-acceso" className="text-lg font-bold text-slate-900 dark:text-white">{acceso.nuevo ? `Listo, ${nombre} ya tiene acceso` : `Contraseña nueva para ${nombre}`}</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Pasale estos datos. La contraseña no se vuelve a mostrar.</p>
        <dl className="mt-4 space-y-2 rounded-xl bg-slate-50 p-4 text-sm dark:bg-slate-900/50">
          <div className="flex justify-between gap-3"><dt className="text-slate-500">Usuario</dt><dd className="font-semibold text-slate-900 dark:text-white">{acceso.usuario}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-slate-500">Contraseña</dt><dd className="font-semibold text-slate-900 dark:text-white">{acceso.clave}</dd></div>
        </dl>
        <a href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noopener noreferrer" className="mt-5 flex h-11 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white transition hover:bg-emerald-700">
          Mandar por WhatsApp
        </a>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button type="button" onClick={() => void copiar()} className="h-10 rounded-xl text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-700">{copiado ? "Copiado ✓" : "Copiar"}</button>
          <button type="button" onClick={onCerrar} className="h-10 rounded-xl text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-700">Listo</button>
        </div>
      </div>
    </div>
  );
}
