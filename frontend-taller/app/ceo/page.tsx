"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { actualizarPlanCeo, generarEnlaceRecuperacionCeo, getCeoResumen, type CeoResumen, type CeoTaller } from "@/lib/api";
import { getSession } from "@/lib/trial";

type Filtro = "TODOS" | CeoTaller["estado_acceso"];
type AccionPlan = "ACTIVAR_30_DIAS" | "EXTENDER_30_DIAS" | "FIJAR_FECHA" | "QUITAR_PLAN";

const dateFormat = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric" });
const dateTimeFormat = new Intl.DateTimeFormat("es-AR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

function fecha(value: string | null) {
  return value ? dateFormat.format(new Date(value)) : "—";
}

function fechaHora(value: string) {
  return dateTimeFormat.format(new Date(value));
}

function estadoMeta(estado: CeoTaller["estado_acceso"]) {
  if (estado === "PLAN_ACTIVO") return { label: "Plan activo", className: "bg-emerald-100 text-emerald-700 ring-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-500/20" };
  if (estado === "PRUEBA_VIGENTE") return { label: "Prueba vigente", className: "bg-amber-100 text-amber-700 ring-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-500/20" };
  return { label: "Sin acceso", className: "bg-rose-100 text-rose-700 ring-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-500/20" };
}

function KpiCard({ label, value, hint, tone }: { label: string; value: number; hint: string; tone: "violet" | "emerald" | "amber" | "rose" | "slate" }) {
  const tones = {
    violet: "border-violet-200 bg-violet-50/70 text-violet-700 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300",
    emerald: "border-emerald-200 bg-emerald-50/70 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300",
    amber: "border-amber-200 bg-amber-50/70 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300",
    rose: "border-rose-200 bg-rose-50/70 text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300",
    slate: "border-slate-200 bg-slate-50/70 text-slate-700 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300",
  }[tone];

  return (
    <article className={`rounded-2xl border p-5 ${tones}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.16em] opacity-75">{label}</p>
      <p className="mt-2 text-3xl font-black tracking-tight">{value}</p>
      <p className="mt-1 text-xs font-medium opacity-80">{hint}</p>
    </article>
  );
}

export default function CentroCeoPage() {
  const router = useRouter();
  const [resumen, setResumen] = useState<CeoResumen | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("TODOS");
  const [actualizando, setActualizando] = useState<number | null>(null);
  const [fechas, setFechas] = useState<Record<number, string>>({});
  const [aviso, setAviso] = useState("");
  const [generandoEnlace, setGenerandoEnlace] = useState<number | null>(null);
  const [enlaceRecuperacion, setEnlaceRecuperacion] = useState<{ url: string; email: string; expiresAt: string } | null>(null);
  const [copiado, setCopiado] = useState(false);

  const cargar = useCallback(async () => {
    setError("");
    try {
      setResumen(await getCeoResumen());
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo cargar el Centro CEO.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const session = getSession();
    if (!session?.es_superusuario) {
      router.replace("/");
      return;
    }
    void cargar();
  }, [cargar, router]);

  const talleres = useMemo(() => {
    if (!resumen) return [];
    const term = busqueda.trim().toLowerCase();
    return resumen.talleres.filter((taller) => {
      const cumpleFiltro = filtro === "TODOS" || taller.estado_acceso === filtro;
      const searchable = `${taller.taller_nombre} ${taller.owner_nombre} ${taller.email} ${taller.ciudad}`.toLowerCase();
      return cumpleFiltro && (!term || searchable.includes(term));
    });
  }, [resumen, busqueda, filtro]);

  async function gestionarPlan(taller: CeoTaller, accion: AccionPlan) {
    setActualizando(taller.id);
    setAviso("");
    setError("");
    try {
      const hasta = fechas[taller.id];
      if (accion === "FIJAR_FECHA" && !hasta) {
        throw new Error("Elegí la fecha hasta la que quedará activo el plan.");
      }
      await actualizarPlanCeo(taller.id, { accion, ...(accion === "FIJAR_FECHA" ? { hasta } : {}) });
      const mensajes: Record<AccionPlan, string> = {
        ACTIVAR_30_DIAS: `Acceso activado por 30 días para ${taller.taller_nombre}.`,
        EXTENDER_30_DIAS: `Plan extendido por 30 días para ${taller.taller_nombre}.`,
        FIJAR_FECHA: `Vigencia actualizada para ${taller.taller_nombre}.`,
        QUITAR_PLAN: `Se quitó el plan pago de ${taller.taller_nombre}.`,
      };
      setAviso(mensajes[accion]);
      await cargar();
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo actualizar el plan.");
    } finally {
      setActualizando(null);
    }
  }

  async function generarEnlace(taller: CeoTaller) {
    setGenerandoEnlace(taller.id);
    setError("");
    try {
      const enlace = await generarEnlaceRecuperacionCeo(taller.id);
      setEnlaceRecuperacion({
        url: `${window.location.origin}${enlace.path}`,
        email: enlace.email,
        expiresAt: enlace.expires_at,
      });
      setCopiado(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo generar el enlace de recuperación.");
    } finally {
      setGenerandoEnlace(null);
    }
  }

  async function copiarEnlace() {
    if (!enlaceRecuperacion) return;
    try {
      await navigator.clipboard.writeText(enlaceRecuperacion.url);
      setCopiado(true);
    } catch {
      setError("No pudimos copiarlo automáticamente. Copiá el enlace desde el campo.");
    }
  }

  const filtros: Array<{ key: Filtro; label: string; count: number }> = [
    { key: "TODOS", label: "Todos", count: resumen?.total_talleres ?? 0 },
    { key: "PLAN_ACTIVO", label: "Con plan", count: resumen?.planes_activos ?? 0 },
    { key: "PRUEBA_VIGENTE", label: "En prueba", count: resumen?.pruebas_vigentes ?? 0 },
    { key: "VENCIDO", label: "Vencidos", count: resumen?.vencidos ?? 0 },
  ];

  return (
    <AppShell
      currentPath="/ceo"
      badge="Plataforma"
      title="Centro CEO"
      description="Salud comercial y accesos de todos los talleres, sincronizados con Django."
      actions={
        <button onClick={() => { setLoading(true); void cargar(); }} className="rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 transition hover:bg-violet-100 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-300">
          Actualizar datos
        </button>
      }
    >
      <div className="mx-auto max-w-7xl space-y-6">
        {enlaceRecuperacion && <div className="fixed inset-0 z-[220] flex items-center justify-center bg-slate-950/65 p-4 backdrop-blur-sm">
          <section className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl dark:bg-slate-900 sm:p-8">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-violet-600 dark:text-violet-400">Recuperación segura</p>
                <h2 className="mt-2 text-xl font-black text-slate-900 dark:text-white">Enlace listo para enviar</h2>
              </div>
              <button onClick={() => setEnlaceRecuperacion(null)} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white" aria-label="Cerrar">✕</button>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">Mandáselo por WhatsApp a <strong>{enlaceRecuperacion.email}</strong>. Se puede usar una sola vez y vence el {fechaHora(enlaceRecuperacion.expiresAt)}.</p>
            <input readOnly value={enlaceRecuperacion.url} onFocus={(event) => event.currentTarget.select()} className="mt-5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-xs text-slate-700 outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200" />
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <button onClick={() => void copiarEnlace()} className="rounded-xl bg-violet-600 px-4 py-3 text-sm font-black text-white transition hover:bg-violet-700">{copiado ? "✓ Enlace copiado" : "Copiar enlace"}</button>
              <a href={`https://wa.me/?text=${encodeURIComponent(`Hola, te envío el enlace seguro para restablecer tu contraseña de Tallerista. Vence en una hora: ${enlaceRecuperacion.url}`)}`} target="_blank" rel="noopener noreferrer" className="rounded-xl border border-emerald-200 px-4 py-3 text-center text-sm font-black text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-500/20 dark:text-emerald-300 dark:hover:bg-emerald-500/10">Enviar por WhatsApp</a>
            </div>
          </section>
        </div>}
        <section className="overflow-hidden rounded-3xl bg-slate-950 px-6 py-7 text-white shadow-xl sm:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-violet-300">Control de plataforma</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight sm:text-3xl">Todo el negocio, en una sola vista.</h2>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-300">Las acciones de activación se aplican directamente sobre el backend y quedan registradas en la auditoría del taller.</p>
            </div>
            <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 px-4 py-3 text-sm font-bold text-emerald-200">
              <span className="mr-2 inline-block h-2 w-2 rounded-full bg-emerald-400" />Conectado a Django
            </div>
          </div>
        </section>

        {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm font-semibold text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">{error}</div>}
        {aviso && <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-sm font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">{aviso}</div>}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard label="Talleres" value={resumen?.total_talleres ?? 0} hint="cuentas comerciales" tone="violet" />
          <KpiCard label="Planes activos" value={resumen?.planes_activos ?? 0} hint="acceso habilitado" tone="emerald" />
          <KpiCard label="En prueba" value={resumen?.pruebas_vigentes ?? 0} hint="período gratuito" tone="amber" />
          <KpiCard label="Por vencer" value={resumen?.por_vencer ?? 0} hint="en los próximos 3 días" tone="slate" />
          <KpiCard label="Vencidos" value={resumen?.vencidos ?? 0} hint="requieren seguimiento" tone="rose" />
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="border-b border-slate-100 p-5 dark:border-slate-800 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <h2 className="text-lg font-black text-slate-900 dark:text-white">Talleres y accesos</h2>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Activá, renová o definí una fecha exacta de vigencia.</p>
              </div>
              <label className="relative block w-full lg:w-80">
                <span className="sr-only">Buscar taller</span>
                <input value={busqueda} onChange={(event) => setBusqueda(event.target.value)} placeholder="Buscar por taller, dueño o email" className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-4 pr-4 text-sm font-medium outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </label>
            </div>
            <div className="mt-5 flex gap-2 overflow-x-auto pb-1">
              {filtros.map((item) => <button key={item.key} onClick={() => setFiltro(item.key)} className={`shrink-0 rounded-lg px-3 py-2 text-xs font-bold transition ${filtro === item.key ? "bg-violet-600 text-white shadow-sm" : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"}`}>{item.label} <span className="ml-1 opacity-70">{item.count}</span></button>)}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20"><div className="h-9 w-9 animate-spin rounded-full border-4 border-slate-200 border-t-violet-600 dark:border-slate-700" /></div>
          ) : talleres.length === 0 ? (
            <div className="px-6 py-16 text-center text-sm font-medium text-slate-500">No hay talleres que coincidan con el filtro.</div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {talleres.map((taller) => {
                const meta = estadoMeta(taller.estado_acceso);
                const trabajando = actualizando === taller.id;
                return <article key={taller.id} className="p-5 sm:p-6">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-base font-black text-slate-900 dark:text-white">{taller.taller_nombre}</h3>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide ring-1 ${meta.className}`}>{meta.label}</span>
                        {taller.es_superusuario && <span className="rounded-full bg-violet-100 px-2.5 py-1 text-[10px] font-black uppercase tracking-wide text-violet-700 ring-1 ring-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-500/20">Superusuario</span>}
                      </div>
                      <p className="mt-1 text-sm font-medium text-slate-600 dark:text-slate-300">{taller.owner_nombre} <span className="text-slate-300 dark:text-slate-600">·</span> {taller.email}</p>
                      <div className="mt-4 grid gap-x-6 gap-y-2 text-xs text-slate-500 sm:grid-cols-2 lg:grid-cols-4 dark:text-slate-400">
                        <span>Ubicación: <strong className="text-slate-700 dark:text-slate-200">{taller.ciudad || "Sin ciudad"}</strong></span>
                        <span>Clientes: <strong className="text-slate-700 dark:text-slate-200">{taller.clientes}</strong></span>
                        <span>Trabajos: <strong className="text-slate-700 dark:text-slate-200">{taller.trabajos}</strong></span>
                        <span>{taller.estado_acceso === "PLAN_ACTIVO" ? "Plan hasta" : "Prueba hasta"}: <strong className="text-slate-700 dark:text-slate-200">{fecha(taller.estado_acceso === "PLAN_ACTIVO" ? taller.plan_activo_hasta : taller.trial_hasta)}</strong></span>
                      </div>
                    </div>

                    <div className="w-full xl:max-w-[430px]">
                      <div className="flex flex-wrap gap-2">
                        <button disabled={trabajando} onClick={() => void gestionarPlan(taller, taller.estado_acceso === "PLAN_ACTIVO" ? "EXTENDER_30_DIAS" : "ACTIVAR_30_DIAS")} className="rounded-xl bg-violet-600 px-3.5 py-2.5 text-xs font-black text-white transition hover:bg-violet-700 disabled:cursor-wait disabled:opacity-60">
                          {trabajando ? "Guardando…" : taller.estado_acceso === "PLAN_ACTIVO" ? "+ 30 días" : "Activar 30 días"}
                        </button>
                        {taller.plan_activo_hasta && <button disabled={trabajando} onClick={() => void gestionarPlan(taller, "QUITAR_PLAN")} className="rounded-xl border border-rose-200 px-3.5 py-2.5 text-xs font-bold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60 dark:border-rose-500/20 dark:text-rose-300 dark:hover:bg-rose-500/10">Quitar plan</button>}
                        {!taller.es_superusuario && <button disabled={generandoEnlace === taller.id} onClick={() => void generarEnlace(taller)} className="rounded-xl border border-slate-200 px-3.5 py-2.5 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:cursor-wait disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">{generandoEnlace === taller.id ? "Generando…" : "Recuperar clave"}</button>}
                      </div>
                      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                        <input type="datetime-local" value={fechas[taller.id] ?? ""} onChange={(event) => setFechas((actual) => ({ ...actual, [taller.id]: event.target.value }))} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-medium outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-400/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" aria-label={`Fecha de plan para ${taller.taller_nombre}`} />
                        <button disabled={trabajando} onClick={() => void gestionarPlan(taller, "FIJAR_FECHA")} className="rounded-xl border border-slate-200 px-3.5 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Fijar fecha</button>
                      </div>
                      <p className="mt-2 text-[11px] leading-relaxed text-slate-400">Trial iniciado: {fechaHora(taller.trial_start)}{taller.telefono ? ` · ${taller.telefono}` : ""}</p>
                    </div>
                  </div>
                </article>;
              })}
            </div>
          )}
        </section>
      </div>
    </AppShell>
  );
}
