"use client";

import { InstalarApp } from "@/components/instalar-app";
import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { StatusBadge } from "@/components/status-badge";
import { HintBubble } from "@/components/hint-bubble";
import { getAvisos, getDashboardData, type Aviso } from "@/lib/api";
import { formatCurrency, formatDate } from "@/lib/format";
import type { DashboardStats, IngresoMensual, TurnoProximo } from "@/lib/types";
import { getSession, type SessionData } from "@/lib/trial";
import { ESTADO_TRABAJO_LABEL, numeroOrden, type EstadoTrabajo } from "@/lib/documentos";
import { buildWhatsAppUrl } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

type UserRole = NonNullable<SessionData["rol"]>;

/**
 * Etapas del taller, en el orden del flujo. Los colores son los mismos de las
 * etiquetas de estado en toda la app (StatusBadge), validados con el script de
 * dataviz: claro 500 sobre blanco, oscuro 600 sobre slate-800. La separación
 * para daltonismo entre ámbar y verde queda en la banda 6–8 en modo oscuro, así
 * que cada segmento va siempre acompañado de su nombre y su cantidad.
 */
const ETAPAS: { estado: EstadoTrabajo; ayuda: string; color: string }[] = [
  { estado: "INGRESADO", ayuda: "Esperan diagnóstico", color: "bg-sky-500 dark:bg-sky-600" },
  { estado: "EN_PROCESO", ayuda: "En reparación", color: "bg-amber-500 dark:bg-amber-600" },
  { estado: "FINALIZADO", ayuda: "Avisale al cliente", color: "bg-emerald-500 dark:bg-emerald-600" },
];

/** "2026-10-01" -> "Octubre" */
function nombreDelMes(mesIso: string): string {
  const [anio, mes] = mesIso.split("-").map(Number);
  const nombre = new Intl.DateTimeFormat("es-AR", { month: "long" }).format(new Date(anio, mes - 1, 1));
  return nombre.charAt(0).toUpperCase() + nombre.slice(1);
}

/**
 * El inicio es un abanico: cada pliegue es un tema del día con su número, y
 * al tocarlo se abre su detalle al lado. Cada persona abre sólo lo que
 * necesita; el último pliegue elegido queda guardado en este navegador.
 */
type PliegueId = "todo" | "taller" | "turnos" | "avisos" | "cobros" | "clientes";

export default function Home() {
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [avisos, setAvisos] = useState<Aviso[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [todayLabel, setTodayLabel] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [elegido, setElegido] = useState<PliegueId | null>(null);
  const [ventana, setVentana] = useState<Exclude<PliegueId, "todo" | "taller"> | null>(null);
  const cerrarVentana = useCallback(() => setVentana(null), []);

  useEffect(() => {
    // Valores dependientes del navegador: se calculan después de hidratar.
    const frame = requestAnimationFrame(() => {
      setRole(getSession()?.rol ?? "ADMIN");
      const hoy = new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long" }).format(new Date());
      setTodayLabel(hoy.charAt(0).toUpperCase() + hoy.slice(1));
      try {
        const guardado = localStorage.getItem("inicio-pliegue");
        if (guardado) setElegido(guardado as PliegueId);
      } catch { /* sin almacenamiento */ }
    });

    getDashboardData()
      .then(setDashboard)
      .catch((error) => setLoadError(error instanceof Error ? error.message : "No pudimos cargar el panel."))
      .finally(() => setLoading(false));
    getAvisos().then(setAvisos).catch(() => { /* los avisos no bloquean el panel */ });

    return () => cancelAnimationFrame(frame);
  }, []);

  const isMechanic = role === "MECANICO";
  const isReception = role === "RECEPCION";
  const isAccountant = role === "CONTADOR";
  const canSeeFinance = role === "ADMIN" || isAccountant;
  const canSeeOperations = !isAccountant;
  const canCreateOrders = role === "ADMIN" || isReception;

  const conteoPorEstado = new Map((dashboard?.trabajos_por_estado ?? []).map((fila) => [fila.estado, fila.cantidad]));
  const etapas = ETAPAS.map((etapa) => ({ ...etapa, cantidad: conteoPorEstado.get(etapa.estado) ?? 0 }));
  const autosEnElTaller = etapas.reduce((total, etapa) => total + etapa.cantidad, 0);
  const ingresos = (dashboard?.ingresos_mensuales ?? []).map((mes) => ({ ...mes, total: Number(mes.total) }));
  const mesAnterior = ingresos.length >= 2 ? ingresos[ingresos.length - 2] : null;
  const turnos = [...(dashboard?.turnos_proximos ?? [])].sort((a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime());
  const hoyIso = new Date().toDateString();
  const turnosDeHoy = turnos.filter((t) => new Date(t.fecha_hora).toDateString() === hoyIso).length;
  const clientesSinActividad = dashboard?.clientes_sin_actividad ?? [];
  const clientesParaRecuperar = dashboard?.clientes_sin_actividad_total ?? clientesSinActividad.length;
  const tallerVacio = !loading && dashboard?.total_clientes === 0 && dashboard?.total_vehiculos === 0;

  const pliegues: Pliegue[] = [
    { id: "todo", nombre: "Todo", valor: "", detalle: "vista completa" },
    canSeeOperations && { id: "taller", nombre: "Taller", valor: String(autosEnElTaller), detalle: autosEnElTaller === 1 ? "auto" : "autos" },
    canSeeOperations && { id: "turnos", nombre: "Turnos", valor: String(turnosDeHoy), detalle: "hoy" },
    canSeeOperations && !isMechanic && { id: "avisos", nombre: "Avisos", valor: String(avisos.length), detalle: "para enviar" },
    canSeeFinance && { id: "cobros", nombre: "Cobros", valor: formatCompacto(dashboard?.cuenta_corriente_pendiente ?? 0), detalle: "por cobrar" },
    !isMechanic && { id: "clientes", nombre: "Clientes", valor: String(clientesParaRecuperar), detalle: "sin volver" },
  ].filter(Boolean) as Pliegue[];
  const activo = pliegues.find((p) => p.id === elegido) ?? pliegues[0];

  const ahora = new Date();
  const centroDelDia = {
    dia: todayLabel ? String(ahora.getDate()) : "",
    semana: todayLabel ? new Intl.DateTimeFormat("es-AR", { weekday: "short" }).format(ahora).replace(".", "") : "hoy",
  };

  function elegir(id: PliegueId) {
    setElegido(id);
    try { localStorage.setItem("inicio-pliegue", id); } catch { /* sin almacenamiento */ }
  }

  const linkDetalle: Record<PliegueId, { href: string; texto: string } | null> = {
    todo: null,
    taller: { href: "/trabajos/tablero", texto: "Abrir tablero" },
    turnos: isMechanic ? null : { href: "/turnos", texto: "Ver agenda" },
    avisos: null,
    cobros: { href: "/caja", texto: "Ir a caja" },
    clientes: { href: "/clientes", texto: "Ver directorio" },
  };
  const tituloDetalle: Record<PliegueId, string> = {
    todo: "Todo el taller de un vistazo",
    taller: "Autos en el taller",
    turnos: "Próximos turnos",
    avisos: "Para avisar por WhatsApp",
    cobros: "Cobros y saldos",
    clientes: "Clientes para recuperar",
  };

  /** Bloque con título y atajo, para la vista "Todo". */
  function bloque(id: Exclude<PliegueId, "todo">) {
    const link = linkDetalle[id];
    return (
      <section key={id} className="min-w-0 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
        <header className="mb-3 flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{tituloDetalle[id]}</h3>
          {link && <Link href={link.href} className="shrink-0 text-xs font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400">{link.texto} →</Link>}
        </header>
        {detalle(id)}
      </section>
    );
  }
  const visibles = new Set(pliegues.map((p) => p.id));

  function detalle(id: PliegueId): ReactNode {
    switch (id) {
      case "todo":
        // Turnos, avisos y clientes van como tarjetas con un adelanto: la
        // lista completa se abre en una ventana, así la vista no se estira
        // cuando hay muchos.
        return (
          <div className="space-y-4">
            {visibles.has("taller") && bloque("taller")}
            <div className="grid gap-3 md:grid-cols-3">
              {visibles.has("turnos") && (
                <TarjetaVentana
                  titulo="Próximos turnos"
                  valor={turnos.length}
                  unidad={turnos.length === 1 ? "turno" : "turnos"}
                  loading={loading}
                  vacio="No hay turnos programados."
                  adelanto={turnos.slice(0, 2).map((t) => ({ clave: String(t.id), principal: t.cliente_nombre, secundario: `${new Date(t.fecha_hora).toLocaleDateString("es-AR", { weekday: "short", day: "numeric" })} · ${new Date(t.fecha_hora).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}` }))}
                  onAbrir={() => setVentana("turnos")}
                />
              )}
              {visibles.has("avisos") && (
                <TarjetaVentana
                  titulo="Para avisar por WhatsApp"
                  valor={avisos.length}
                  unidad={avisos.length === 1 ? "aviso" : "avisos"}
                  loading={loading}
                  vacio="No hay avisos pendientes."
                  adelanto={avisos.slice(0, 2).map((a, i) => ({ clave: `${a.href}-${i}`, principal: a.titulo, secundario: a.detalle }))}
                  onAbrir={() => setVentana("avisos")}
                />
              )}
              {visibles.has("clientes") && (
                <TarjetaVentana
                  titulo="Clientes para recuperar"
                  valor={clientesParaRecuperar}
                  unidad="sin volver"
                  loading={loading}
                  vacio="Todos volvieron en los últimos 6 meses."
                  adelanto={clientesSinActividad.slice(0, 2).map((c) => ({ clave: String(c.id), principal: c.nombre, secundario: c.ultimo_trabajo ? `Última visita ${formatDate(c.ultimo_trabajo)}` : "Sin visitas" }))}
                  onAbrir={() => setVentana("clientes")}
                />
              )}
            </div>
          </div>
        );
      case "taller":
        return (
          <div className="space-y-5">
            <EtapasDelTaller loading={loading} total={autosEnElTaller} etapas={etapas} canCreateOrders={canCreateOrders} />
            <div>
              <h3 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">{isMechanic ? "Trabajo técnico reciente" : "Órdenes recientes"}</h3>
              <OrdenesRecientes loading={loading} dashboard={dashboard} isMechanic={isMechanic} canSeeFinance={canSeeFinance} />
            </div>
          </div>
        );
      case "turnos":
        return <ProximosTurnos loading={loading} turnos={turnos.slice(0, 8)} />;
      case "avisos":
        if (!loading && !avisos.length) return <p className="py-6 text-center text-sm text-slate-500">No hay avisos pendientes.</p>;
        return (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {avisos.map((aviso, index) => <Recordatorio key={`${aviso.tipo}-${aviso.href}-${index}`} aviso={aviso} />)}
          </ul>
        );
      case "cobros":
        return (
          <div className="space-y-5">
            <div className="grid gap-3 sm:grid-cols-3">
              <Cifra loading={loading} label="Cobrado este mes" value={formatCurrency(dashboard?.ingresos_mes_actual ?? 0)} detail={mesAnterior ? `${nombreDelMes(mesAnterior.month)} cerró en ${formatCurrency(mesAnterior.total)}` : undefined} />
              <Cifra loading={loading} label="Por cobrar" value={formatCurrency(dashboard?.cuenta_corriente_pendiente ?? 0)} detail="Saldos en cuenta corriente" />
              <Cifra loading={loading} label="Ticket promedio" value={formatCurrency(dashboard?.ticket_promedio ?? 0)} detail="Órdenes terminadas" />
            </div>
            <div>
              <h3 className="mb-1 text-sm font-semibold text-slate-700 dark:text-slate-200">Cobros de los últimos 6 meses</h3>
              <IngresosChart loading={loading} meses={ingresos} />
            </div>
          </div>
        );
      case "clientes":
        if (!loading && !clientesSinActividad.length) return <p className="py-6 text-center text-sm text-slate-500">Todos tus clientes volvieron en los últimos 6 meses.</p>;
        return (
          <>
            <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">{clientesParaRecuperar} sin visitas al taller en 6 meses. Un mensaje a tiempo los trae de vuelta.</p>
            <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {clientesSinActividad.map((cliente) => (
                <li key={cliente.id}>
                  <Link href={`/clientes/${cliente.id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-2.5 transition hover:bg-slate-50 dark:hover:bg-slate-700/40">
                    <span className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{cliente.nombre}</span>
                    <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">{cliente.ultimo_trabajo ? `Última visita ${formatDate(cliente.ultimo_trabajo)}` : "Sin visitas"}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </>
        );
    }
  }

  const pageCopy = isMechanic
    ? { badge: "Área técnica", title: "Prioridades de trabajo", description: "Qué hay en el taller y qué sigue." }
    : isReception
      ? { badge: "Recepción", title: "Agenda y atención", description: "Turnos, autos en el taller y avisos a clientes." }
      : isAccountant
        ? { badge: "Administración", title: "Control financiero", description: "Cobros, saldos pendientes y clientes." }
        : { badge: "Panel principal", title: "Estado del taller", description: "Elegí qué querés ver del día." };

  return (
    <AppShell
      currentPath="/"
      compact
      badge={pageCopy.badge}
      title={pageCopy.title}
      description={pageCopy.description}
      leading={todayLabel && (
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{todayLabel}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{autosEnElTaller} {autosEnElTaller === 1 ? "auto" : "autos"} en el taller</p>
        </div>
      )}
      actions={
        <>
          {(canCreateOrders || canSeeFinance) && (
            <GrupoAtajos
              atajos={[
                canCreateOrders && { href: "/turnos/nuevo", texto: "Turno" },
                canCreateOrders && { href: "/clientes/nuevo", texto: "Cliente" },
                canSeeFinance && { href: "/caja", texto: "Cobro" },
              ]}
            />
          )}
          {canCreateOrders && (
            <Link href="/trabajos/nuevo" className="inline-flex h-9 items-center rounded-xl bg-brand-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700">
              + Nueva orden
            </Link>
          )}
        </>
      }
    >
      <InstalarApp />
      {loadError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-900/50 dark:bg-red-950/20">
          <h3 className="text-sm font-bold text-red-800 dark:text-red-300">No pudimos cargar el panel</h3>
          <p className="mt-1 text-sm text-red-700 dark:text-red-300/80">{loadError}</p>
          <button onClick={() => window.location.reload()} className="mt-4 text-xs font-bold text-red-800 underline hover:text-red-900 dark:text-red-300">Reintentar</button>
        </div>
      ) : (
        <div className="space-y-4">
          {role === "ADMIN" && tallerVacio && (
            <HintBubble
              id="hint-dashboard-v1"
              variant="inline"
              title="¡Bienvenido a Tallerista!"
              desc="Para empezar: cargá un cliente, después su vehículo, y luego creá tu primer presupuesto u orden de trabajo."
              action={{ label: "Ver guía de inicio", href: "/onboarding" }}
            />
          )}

          {role && activo && (
            <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
              <div className="space-y-4">
                <section className="rounded-2xl border border-slate-200 bg-white px-4 pb-1 pt-4 shadow-sm dark:border-slate-700 dark:bg-slate-800 lg:px-0 lg:py-3">
                  <Abanico pliegues={pliegues} activo={activo.id} onElegir={elegir} loading={loading} centro={centroDelDia} />
                </section>
                {canSeeFinance && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
                    <header className="mb-2 flex items-center justify-between gap-2">
                      <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Cobros y saldos</h2>
                      <div className="flex items-center gap-3 text-xs font-bold">
                        <button type="button" onClick={() => setVentana("cobros")} aria-haspopup="dialog" className="text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">Gráfico</button>
                        <Link href="/caja" className="text-brand-600 hover:text-brand-700 dark:text-brand-400">Caja →</Link>
                      </div>
                    </header>
                    <dl className="divide-y divide-slate-100 dark:divide-slate-700/60">
                      {[
                        ["Cobrado este mes", dashboard?.ingresos_mes_actual ?? 0, mesAnterior ? `${nombreDelMes(mesAnterior.month)} cerró en ${formatCurrency(mesAnterior.total)}` : ""],
                        ["Por cobrar", dashboard?.cuenta_corriente_pendiente ?? 0, "Cuenta corriente"],
                        ["Ticket promedio", dashboard?.ticket_promedio ?? 0, "Órdenes terminadas"],
                      ].map(([etiqueta, monto, ayuda]) => (
                        <div key={String(etiqueta)} className="flex items-end justify-between gap-3 py-2">
                          <div className="min-w-0">
                            <dt className="text-xs font-medium text-slate-600 dark:text-slate-300">{etiqueta}</dt>
                            {ayuda && <dd className="truncate text-[11px] text-slate-400">{ayuda}</dd>}
                          </div>
                          <dd className="shrink-0 font-display text-2xl font-extrabold leading-none tabular-nums text-slate-900 dark:text-white">
                            {loading ? "·" : formatCurrency(Number(monto))}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  </section>
                )}
              </div>

              <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800" aria-live="polite">
                <header className="mb-4 flex items-center justify-between gap-3">
                  <h2 className="text-lg font-semibold tracking-tight text-slate-900 dark:text-white">{tituloDetalle[activo.id]}</h2>
                  {linkDetalle[activo.id] && (
                    <Link href={linkDetalle[activo.id]!.href} className="shrink-0 text-xs font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400">
                      {linkDetalle[activo.id]!.texto} →
                    </Link>
                  )}
                </header>
                <div key={activo.id} className="motion-safe:animate-[aparecer_180ms_ease-out]">{detalle(activo.id)}</div>
              </section>
            </div>
          )}

          {ventana && (
            <Ventana titulo={tituloDetalle[ventana]} link={linkDetalle[ventana]} onCerrar={cerrarVentana}>
              {detalle(ventana)}
            </Ventana>
          )}
        </div>
      )}
    </AppShell>
  );
}

// ─── Abanico ────────────────────────────────────────────────────────────────

type Pliegue = { id: PliegueId; nombre: string; valor: string; detalle: string };

/**
 * Un color por tema. En reposo el pliegue es blanco y sólo el nombre lleva
 * su color (así el abanico no compite con el contenido); el elegido se pinta
 * entero (600, con texto blanco).
 */
const TONO: Record<PliegueId, { reposo: string; activo: string; texto: string }> = {
  todo: {
    reposo: "fill-white stroke-slate-200 group-hover:fill-slate-50 dark:fill-slate-800 dark:stroke-slate-700 dark:group-hover:fill-slate-700/60",
    activo: "fill-brand-600 stroke-brand-600",
    texto: "fill-brand-700 dark:fill-brand-300",
  },
  taller: {
    reposo: "fill-white stroke-slate-200 group-hover:fill-slate-50 dark:fill-slate-800 dark:stroke-slate-700 dark:group-hover:fill-slate-700/60",
    activo: "fill-sky-600 stroke-sky-600",
    texto: "fill-sky-700 dark:fill-sky-300",
  },
  turnos: {
    reposo: "fill-white stroke-slate-200 group-hover:fill-slate-50 dark:fill-slate-800 dark:stroke-slate-700 dark:group-hover:fill-slate-700/60",
    activo: "fill-violet-600 stroke-violet-600",
    texto: "fill-violet-700 dark:fill-violet-300",
  },
  avisos: {
    reposo: "fill-white stroke-slate-200 group-hover:fill-slate-50 dark:fill-slate-800 dark:stroke-slate-700 dark:group-hover:fill-slate-700/60",
    activo: "fill-emerald-600 stroke-emerald-600",
    texto: "fill-emerald-700 dark:fill-emerald-300",
  },
  cobros: {
    reposo: "fill-white stroke-slate-200 group-hover:fill-slate-50 dark:fill-slate-800 dark:stroke-slate-700 dark:group-hover:fill-slate-700/60",
    activo: "fill-amber-600 stroke-amber-600",
    texto: "fill-amber-700 dark:fill-amber-300",
  },
  clientes: {
    reposo: "fill-white stroke-slate-200 group-hover:fill-slate-50 dark:fill-slate-800 dark:stroke-slate-700 dark:group-hover:fill-slate-700/60",
    activo: "fill-rose-600 stroke-rose-600",
    texto: "fill-rose-700 dark:fill-rose-300",
  },
};

/** "$ 180.500" -> "$180k": entra en el pliegue sin achicar la letra. */
function formatCompacto(monto: number): string {
  if (monto >= 1_000_000) return `$${(monto / 1_000_000).toLocaleString("es-AR", { maximumFractionDigits: 1 })}M`;
  if (monto >= 10_000) return `$${Math.round(monto / 1000)}k`;
  return formatCurrency(monto);
}

/**
 * Abanico partido en pliegues; cada pliegue es un botón (con teclado: flechas
 * para moverse, Enter/Espacio para abrir). En pantallas anchas se dibuja
 * achatado y a lo ancho; en el celular, como semicírculo. El elegido se pinta
 * con el color de marca y se separa apenas del centro.
 */
function Abanico(props: {
  pliegues: Pliegue[];
  activo: PliegueId;
  onElegir: (id: PliegueId) => void;
  loading: boolean;
  centro: { dia: string; semana: string };
}) {
  return (
    <>
      {/* En pantallas anchas va acostado en la columna izquierda: el lado
          plano contra el borde y los pliegues abriéndose hacia el detalle. */}
      <div className="hidden lg:block">
        <AbanicoSvg {...props} acostado ancho={300} alto={556} Rx={278} Ry={262} rx={88} ry={92} letra={1.05} />
      </div>
      <div className="mx-auto max-w-md lg:hidden">
        <AbanicoSvg {...props} ancho={400} alto={212} Rx={190} Ry={190} rx={66} ry={66} letra={1} />
      </div>
    </>
  );
}

function AbanicoSvg({
  pliegues,
  activo,
  onElegir,
  loading,
  centro,
  ancho,
  alto,
  Rx,
  Ry,
  rx,
  ry,
  letra,
  acostado = false,
}: {
  pliegues: Pliegue[];
  activo: PliegueId;
  onElegir: (id: PliegueId) => void;
  loading: boolean;
  centro: { dia: string; semana: string };
  ancho: number;
  alto: number;
  Rx: number;
  Ry: number;
  rx: number;
  ry: number;
  letra: number;
  acostado?: boolean;
}) {
  // Acostado: centro contra el borde izquierdo y el abanico abre hacia la
  // derecha (de -90° a 90°). Parado: centro abajo, abre hacia arriba.
  const cx = acostado ? 8 : ancho / 2, cy = acostado ? alto / 2 : alto - 10, sep = 0.012;
  const inicio = acostado ? -Math.PI / 2 : Math.PI;
  const n = pliegues.length;
  const punto = (ang: number, ex: number, ey: number) => [cx + ex * Math.cos(ang), cy + ey * Math.sin(ang)];
  const chico = n > 5 && letra === 1;
  const f = (px: number) => `${Math.round(px * letra * (chico ? 0.88 : 1))}px`;

  function mover(e: KeyboardEvent<SVGGElement>, i: number) {
    const paso = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (paso) {
      e.preventDefault();
      const sig = pliegues[(i + paso + n) % n];
      onElegir(sig.id);
      (e.currentTarget.parentElement?.querySelector(`[data-pliegue="${sig.id}"]`) as SVGGElement | null)?.focus();
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onElegir(pliegues[i].id);
    }
  }

  return (
    <svg viewBox={`0 0 ${ancho} ${alto}`} className="w-full select-none" role="tablist" aria-label="Qué querés ver">
      {pliegues.map((p, i) => {
        const a0 = inicio + (i * Math.PI) / n + sep;
        const a1 = inicio + ((i + 1) * Math.PI) / n - sep;
        const medio = (a0 + a1) / 2;
        const esActivo = p.id === activo;
        const salto = chico ? 5 : 8;
        const dx = esActivo ? salto * letra * Math.cos(medio) : 0;
        const dy = esActivo ? salto * letra * Math.sin(medio) : 0;
        const [x0, y0] = punto(a0, Rx, Ry), [x1, y1] = punto(a1, Rx, Ry), [x2, y2] = punto(a1, rx, ry), [x3, y3] = punto(a0, rx, ry);
        // En el celular los 6 pliegues son angostos: el texto va más hacia afuera,
        // donde el pliegue es más ancho, y el detalle chico se omite (está en el
        // aria-label) para que las palabras no se pisen con las del vecino.
        const [tx, ty] = punto(medio, (Rx + rx) / 2 + (chico ? 14 : 4), (Ry + ry) / 2 + (chico ? 14 : 4));
        const sinValor = !p.valor;
        return (
          <g
            key={p.id}
            data-pliegue={p.id}
            role="tab"
            aria-selected={esActivo}
            aria-label={sinValor ? `${p.nombre}: ${p.detalle}` : `${p.nombre}: ${p.valor} ${p.detalle}`}
            tabIndex={esActivo ? 0 : -1}
            onClick={() => onElegir(p.id)}
            onKeyDown={(e) => mover(e, i)}
            transform={`translate(${dx} ${dy})`}
            className="group cursor-pointer outline-none transition-transform duration-200"
          >
            <path
              d={`M${x0} ${y0} A${Rx} ${Ry} 0 0 1 ${x1} ${y1} L${x2} ${y2} A${rx} ${ry} 0 0 0 ${x3} ${y3}Z`}
              strokeWidth={1.5}
              strokeLinejoin="round"
              className={cn(
                "transition-colors duration-200",
                esActivo ? TONO[p.id].activo : cn(TONO[p.id].reposo, "group-focus-visible:stroke-slate-900 dark:group-focus-visible:stroke-white"),
              )}
            />
            {sinValor ? (
              <>
                <text x={tx} y={ty + 2} textAnchor="middle" style={{ fontSize: f(32), fontStretch: "72%", letterSpacing: "0" }} className={cn("font-extrabold uppercase", esActivo ? "fill-white" : TONO[p.id].texto)}>{p.nombre}</text>
                <text x={tx} y={ty + 18 * letra} textAnchor="middle" style={{ fontSize: f(10.5) }} className={cn("font-medium", esActivo ? "fill-white/85" : "fill-slate-500 dark:fill-slate-400")}>{p.detalle}</text>
              </>
            ) : (
              <>
                <text x={tx} y={ty - (chico ? 16 : 20) * letra} textAnchor="middle" style={{ fontSize: f(12), fontStretch: "80%", letterSpacing: chico ? "0.02em" : "0.08em" }} className={cn("font-bold uppercase", esActivo ? "fill-white/90" : TONO[p.id].texto)}>{p.nombre}</text>
                <text x={tx} y={ty + (chico ? 14 : 12) * letra} textAnchor="middle" style={{ fontSize: f(chico ? 32 : 34), fontStretch: "72%", letterSpacing: "-0.01em" }} className={cn("font-extrabold tabular-nums", esActivo ? "fill-white" : "fill-slate-900 dark:fill-white")}>{loading ? "·" : p.valor}</text>
                {(!chico || esActivo) && <text x={tx} y={ty + 28 * letra} textAnchor="middle" style={{ fontSize: f(10.5) }} className={cn("font-medium", esActivo ? "fill-white/85" : "fill-slate-500 dark:fill-slate-400")}>{p.detalle}</text>}
              </>
            )}
          </g>
        );
      })}
      <ellipse cx={cx} cy={cy} rx={rx - 10} ry={ry - 10} className="fill-white stroke-slate-200 dark:fill-slate-800 dark:stroke-slate-700" strokeWidth={1.5} />
      {(() => {
        // Centro visual de la media elipse (no el de la elipse entera).
        const x = acostado ? cx + (rx - 10) * 0.46 : cx;
        const y = acostado ? cy : cy - (ry - 10) * 0.42;
        return (
          <>
            <text x={x} y={y + 9 * letra} textAnchor="middle" style={{ fontSize: f(40), fontStretch: "72%" }} className="fill-slate-900 font-extrabold tabular-nums dark:fill-white">{centro.dia}</text>
            <text x={x} y={y + 24 * letra} textAnchor="middle" style={{ fontSize: f(10.5), letterSpacing: "0.08em" }} className="fill-brand-600 font-bold uppercase dark:fill-brand-400">{centro.semana}</text>
          </>
        );
      })()}
    </svg>
  );
}

/**
 * Atajos secundarios del encabezado unidos en un solo grupo (en vez de tres
 * botones sueltos), con un "+" que dice que crean algo nuevo.
 */
function GrupoAtajos({ atajos }: { atajos: (false | { href: string; texto: string })[] }) {
  const visibles = atajos.filter(Boolean) as { href: string; texto: string }[];
  if (!visibles.length) return null;
  return (
    <div className="mr-1 hidden h-9 items-stretch overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:inline-flex" role="group" aria-label="Crear">
      {visibles.map((a, i) => (
        <Link
          key={a.href}
          href={a.href}
          className={cn(
            "inline-flex items-center gap-1.5 px-3.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900 dark:text-slate-200 dark:hover:bg-slate-700",
            i > 0 && "border-l border-slate-200 dark:border-slate-700",
          )}
        >
          <svg className="h-3.5 w-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5v14M5 12h14" /></svg>
          {a.texto}
        </Link>
      ))}
    </div>
  );
}

/** Tarjeta-botón: número, dos líneas de adelanto y la lista entera en una ventana. */
function TarjetaVentana({
  titulo,
  valor,
  unidad,
  loading,
  vacio,
  adelanto,
  onAbrir,
}: {
  titulo: string;
  valor: number;
  unidad: string;
  loading: boolean;
  vacio: string;
  adelanto: { clave: string; principal: string; secundario: string }[];
  onAbrir: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onAbrir}
      aria-haspopup="dialog"
      className="group flex min-h-40 flex-col rounded-xl border border-slate-200 p-4 text-left transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-700/30"
    >
      <span className="text-sm font-semibold text-slate-900 dark:text-white">{titulo}</span>
      <span className="mt-1 flex items-baseline gap-1.5">
        <span className="font-display text-4xl font-extrabold leading-none tabular-nums text-slate-900 dark:text-white">{loading ? "·" : valor}</span>
        <span className="text-xs text-slate-500 dark:text-slate-400">{unidad}</span>
      </span>
      <span className="mt-3 block flex-1 space-y-1.5">
        {!loading && adelanto.length === 0 && <span className="block text-xs text-slate-500 dark:text-slate-400">{vacio}</span>}
        {adelanto.map((item) => (
          <span key={item.clave} className="block min-w-0">
            <span className="block truncate text-xs font-semibold text-slate-700 dark:text-slate-200">{item.principal}</span>
            <span className="block truncate text-[11px] text-slate-500 dark:text-slate-400">{item.secundario}</span>
          </span>
        ))}
      </span>
      {valor > 0 && (
        <span className="mt-3 text-xs font-bold text-brand-600 group-hover:text-brand-700 dark:text-brand-400">
          {valor > adelanto.length ? `Ver los ${valor}` : "Abrir"} →
        </span>
      )}
    </button>
  );
}

/** Ventana emergente: se cierra con Escape, con la X o tocando afuera. */
function Ventana({
  titulo,
  link,
  onCerrar,
  children,
}: {
  titulo: string;
  link: { href: string; texto: string } | null;
  onCerrar: () => void;
  children: ReactNode;
}) {
  const cerrarRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    cerrarRef.current?.focus();
    const alTeclear = (e: globalThis.KeyboardEvent) => { if (e.key === "Escape") onCerrar(); };
    document.addEventListener("keydown", alTeclear);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", alTeclear);
      document.body.style.overflow = overflow;
    };
  }, [onCerrar]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-label={titulo}>
      <button type="button" aria-label="Cerrar" tabIndex={-1} className="absolute inset-0 bg-slate-950/50 backdrop-blur-[2px]" onClick={onCerrar} />
      <div className="relative flex max-h-[85dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl motion-safe:animate-[aparecer_160ms_ease-out] dark:bg-slate-800 sm:rounded-2xl">
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">{titulo}</h2>
          <div className="flex items-center gap-3">
            {link && <Link href={link.href} className="text-xs font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400">{link.texto} →</Link>}
            <button ref={cerrarRef} type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:hover:bg-slate-700 dark:hover:text-white">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        </header>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  );
}

/** Cifra de plata dentro del detalle (sin tarjeta propia). */
function Cifra({ loading, label, value, detail }: { loading: boolean; label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      {loading ? <div className="mt-1.5 h-7 w-28 animate-pulse rounded bg-slate-100 dark:bg-slate-700" /> : <p className="mt-1 font-display text-4xl font-extrabold leading-none tracking-tight tabular-nums text-slate-900 dark:text-white">{value}</p>}
      {detail && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{detail}</p>}
    </div>
  );
}

// ─── 1. En el taller ahora ──────────────────────────────────────────────────

function EtapasDelTaller({
  loading,
  total,
  etapas,
  canCreateOrders,
}: {
  loading: boolean;
  total: number;
  etapas: { estado: EstadoTrabajo; ayuda: string; color: string; cantidad: number }[];
  canCreateOrders: boolean;
}) {
  return (
    <div>
      <div className="grid gap-5 xl:grid-cols-[auto_minmax(0,1fr)] xl:items-center xl:gap-8">
        <div>
          {loading ? (
            <div className="mt-2 h-14 w-24 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-700" />
          ) : (
            <p className="mt-1 font-display text-7xl font-extrabold leading-none text-slate-900 dark:text-white">{total}</p>
          )}
        </div>

        <div className="min-w-0">
          {!loading && total === 0 ? (
            <div className="flex flex-col items-start gap-3 rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-600 dark:border-slate-600 dark:text-slate-300 sm:flex-row sm:items-center sm:justify-between">
              <span>No hay autos en el taller en este momento.</span>
              {canCreateOrders && (
                <Link href="/trabajos/nuevo" className="text-xs font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400">Registrar un ingreso →</Link>
              )}
            </div>
          ) : (
            <ul className="grid gap-2 sm:grid-cols-3">
              {etapas.map((etapa) => (
                <li key={etapa.estado}>
                  <Link
                    href={`/trabajos?estado=${etapa.estado}`}
                    className="flex items-start gap-3 rounded-xl border border-slate-200 p-3 transition hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:hover:border-slate-600 dark:hover:bg-slate-700/40"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="text-sm font-semibold leading-tight text-slate-800 dark:text-slate-100">{ESTADO_TRABAJO_LABEL[etapa.estado]}</span>
                        {loading ? (
                          <span className="h-5 w-6 animate-pulse rounded bg-slate-100 dark:bg-slate-700" />
                        ) : (
                          <span className="font-display text-3xl font-extrabold leading-none text-slate-900 dark:text-white">{etapa.cantidad}</span>
                        )}
                      </span>
                      <span className="block text-xs text-slate-500 dark:text-slate-400">{etapa.ayuda}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── 2. Indicadores de plata ────────────────────────────────────────────────

// ─── Gráfico de cobros ──────────────────────────────────────────────────────

/**
 * Una sola serie a lo largo del tiempo: columnas finas (≤24px, punta
 * redondeada y base recta), el mes en curso en el color de marca y el resto en
 * gris (énfasis, no categorías). Sólo se rotula el mes en curso; el resto se
 * lee pasando el mouse o con el teclado, y está completo en la tabla oculta
 * para lectores de pantalla.
 */
function IngresosChart({ loading, meses }: { loading: boolean; meses: IngresoMensual[] }) {
  const [activo, setActivo] = useState<number | null>(null);

  if (loading) return <div className="h-56 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-700/50" />;
  if (!meses.length || meses.every((m) => m.total === 0)) {
    return (
      <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 text-center dark:border-slate-600">
        <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Todavía no hay cobros para graficar.</p>
        <p className="mt-1 text-xs text-slate-500">Se completa solo a medida que registres cobros en caja.</p>
      </div>
    );
  }

  const maximo = Math.max(...meses.map((m) => m.total), 1);
  const ultimo = meses.length - 1;
  const etiquetaCobros = (n: number) => `${n} ${n === 1 ? "cobro" : "cobros"}`;

  return (
    <div>
      <div className="relative">
        {/* Grilla: línea base y media, sólidas y finas */}
        <div className="pointer-events-none absolute inset-x-0 top-8 bottom-6 flex flex-col justify-between" aria-hidden="true">
          <div className="border-t border-slate-100 dark:border-slate-700/60" />
          <div className="border-t border-slate-200 dark:border-slate-700" />
        </div>

        <div className="relative grid h-56 grid-cols-6 gap-2" onMouseLeave={() => setActivo(null)}>
          {meses.map((mes, index) => {
            const esActual = index === ultimo;
            const alto = (mes.total / maximo) * 100;
            const mostrarValor = esActual || activo === index;
            return (
              <button
                key={mes.month}
                type="button"
                onMouseEnter={() => setActivo(index)}
                onFocus={() => setActivo(index)}
                onBlur={() => setActivo(null)}
                aria-label={`${mes.label}: ${formatCurrency(mes.total)}, ${etiquetaCobros(mes.trabajos)}`}
                className="group flex h-full flex-col items-center justify-end rounded-lg pb-6 pt-8 outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
              >
                <div className="relative flex w-full flex-1 items-end justify-center">
                  {mostrarValor && (
                    <div
                      className="pointer-events-none absolute z-10 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-2 py-1 text-center shadow-sm dark:border-slate-600 dark:bg-slate-900"
                      style={{ bottom: `calc(${alto}% + 6px)` }}
                    >
                      <span className="block text-xs font-semibold text-slate-900 dark:text-white">{formatCurrency(mes.total)}</span>
                      {activo === index && <span className="block text-[10px] text-slate-500 dark:text-slate-400">{etiquetaCobros(mes.trabajos)}</span>}
                    </div>
                  )}
                  {mes.total > 0 && (
                    <div
                      className={cn(
                        "w-full max-w-6 rounded-t motion-safe:transition-[height,filter] motion-safe:duration-500",
                        esActual ? "bg-brand-500" : "bg-slate-300 dark:bg-slate-600",
                        activo === index && "brightness-110",
                      )}
                      style={{ height: `${Math.max(alto, 2)}%` }}
                    />
                  )}
                </div>
                <span className={cn("absolute bottom-0 text-xs", esActual ? "font-bold text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400")}>
                  {mes.label.split(" ")[0]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <table className="sr-only">
        <caption>Cobros de los últimos 6 meses</caption>
        <thead><tr><th scope="col">Mes</th><th scope="col">Total cobrado</th><th scope="col">Cobros</th></tr></thead>
        <tbody>
          {meses.map((mes) => (
            <tr key={mes.month}><th scope="row">{mes.label}</th><td>{formatCurrency(mes.total)}</td><td>{mes.trabajos}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Listas ─────────────────────────────────────────────────────────────────

function OrdenesRecientes({
  loading,
  dashboard,
  isMechanic,
  canSeeFinance,
}: {
  loading: boolean;
  dashboard: DashboardStats | null;
  isMechanic: boolean;
  canSeeFinance: boolean;
}) {
  if (loading) return <div className="h-48 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-700/50" />;
  const ordenes = dashboard?.trabajos_recientes ?? [];
  if (!ordenes.length) return <p className="py-6 text-center text-sm text-slate-500">Todavía no hay órdenes.</p>;

  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
      {ordenes.slice(0, 5).map((t) => (
        <li key={t.id}>
          <Link href={`/trabajos/${t.id}`} className="-mx-2 flex items-center justify-between gap-3 rounded-lg px-2 py-3 transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/40">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-semibold text-slate-900 dark:text-white">{isMechanic ? (t.resumen || "Sin detalle técnico") : t.patente}</p>
                <StatusBadge status={t.estado} />
              </div>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">
                {isMechanic ? `${t.patente} · ${t.vehiculo}` : `${t.cliente_nombre} · ${t.vehiculo}`}
              </p>
            </div>
            <div className="shrink-0 text-right">
              {canSeeFinance && <p className="font-semibold tabular-nums text-slate-900 dark:text-white">{formatCurrency(t.total)}</p>}
              <p className="text-xs text-slate-500 dark:text-slate-400">{numeroOrden(t.id)} · {formatDate(t.fecha_ingreso)}</p>
            </div>
          </Link>
        </li>
      ))}
    </ul>
  );
}

function diaRelativo(fecha: Date): string {
  const hoy = new Date();
  const inicio = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((inicio(fecha) - inicio(hoy)) / 86_400_000);
  if (dias === 0) return "Hoy";
  if (dias === 1) return "Mañana";
  return new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", month: "short" }).format(fecha);
}

function ProximosTurnos({ loading, turnos }: { loading: boolean; turnos: TurnoProximo[] }) {
  if (loading) return <div className="h-32 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-700/50" />;
  if (!turnos.length) return <p className="py-4 text-center text-sm text-slate-500">No hay turnos programados.</p>;

  return (
    <ul className="divide-y divide-slate-100 dark:divide-slate-700/60">
      {turnos.map((turno) => {
        const fecha = new Date(turno.fecha_hora);
        return (
          <li key={turno.id} className="flex gap-3 py-2.5">
            <div className="w-16 shrink-0">
              <p className="text-xs font-bold capitalize text-slate-900 dark:text-white">{diaRelativo(fecha)}</p>
              <p className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                {fecha.toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">{turno.cliente_nombre}</p>
              <p className="truncate text-xs text-slate-500 dark:text-slate-400">{turno.vehiculo} · {turno.motivo}</p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Recordatorio({ aviso }: { aviso: Aviso }) {
  // buildWhatsAppUrl normaliza el número (agrega el 549): el panel armaba
  // wa.me/3425551020, que WhatsApp toma como número internacional inválido.
  const waHref = buildWhatsAppUrl(aviso.mensaje, aviso.telefono);
  return (
    <li className="flex items-center justify-between gap-3 py-2.5">
      <Link href={aviso.href} className="min-w-0 flex-1 rounded-md hover:underline">
        <p className="flex flex-wrap items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
          {aviso.prioridad === "ALTA" && (
            <span className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700 dark:bg-red-950/40 dark:text-red-300">Urgente</span>
          )}
          <span className="leading-tight">{aviso.titulo}</span>
        </p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{aviso.detalle}</p>
      </Link>
      {waHref ? (
        <a
          href={waHref}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-lg bg-[#25D366] px-3 py-1.5 text-xs font-bold text-white transition hover:bg-[#1ebe5d]"
        >
          WhatsApp
        </a>
      ) : (
        <span className="shrink-0 text-[11px] text-slate-400" title="Cargá un celular válido en la ficha del cliente">Sin celular</span>
      )}
    </li>
  );
}
