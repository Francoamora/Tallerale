"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { getDashboardData } from "@/lib/api";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import type { DashboardStats } from "@/lib/types";
import { cn } from "@/lib/utils";
import { HintBubble } from "@/components/hint-bubble";
import { getSession, getTrialInfo, type SessionData } from "@/lib/trial";

type UserRole = NonNullable<SessionData["rol"]>;

export default function Home() {
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [chartMounted, setChartMounted] = useState(false);
  const [tallerNombre, setTallerNombre] = useState("tu taller");
  const [todayLabel, setTodayLabel] = useState<string | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const alertasRailRef = useRef<HTMLDivElement>(null);
  const turnosRailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Valores dependientes del navegador: se calculan después de hidratar para
    // evitar que la zona horaria del servidor y del cliente difieran.
    const frame = requestAnimationFrame(() => {
      const info = getTrialInfo();
      setRole(getSession()?.rol ?? "ADMIN");
      if (info.tallerNombre) setTallerNombre(info.tallerNombre);
      setTodayLabel(new Intl.DateTimeFormat("es-AR", {
        weekday: "long",
        day: "numeric",
        month: "long",
      }).format(new Date()));
    });

    getDashboardData()
      .then((data) => {
        setDashboard(data);
        // Pequeño delay para que el DOM pinte primero y la transición se vea
        requestAnimationFrame(() => setTimeout(() => setChartMounted(true), 80));
      })
      .catch((error) => {
        setLoadError(error instanceof Error ? error.message : "Falla en el enlace con el motor operativo.");
      })
      .finally(() => setLoading(false));

    return () => cancelAnimationFrame(frame);
  }, []);

  // ── Derivados del gráfico ──────────────────────────────────
  const ingresos = dashboard?.ingresos_mensuales ?? [];

  // Parsear siempre a número (Django puede devolver strings "15000.00")
  const ingresosNum = ingresos.map((m) => ({ ...m, totalNum: parseFloat(String(m.total)) }));
  const maxIngreso = ingresosNum.length ? Math.max(...ingresosNum.map((m) => m.totalNum), 1) : 1;
  const maxIngresoIdx = ingresosNum.reduce((best, m, i) => (m.totalNum > ingresosNum[best].totalNum ? i : best), 0);
  const total6m = ingresosNum.reduce((acc, m) => acc + m.totalNum, 0);
  const ultimoMes = ingresosNum[ingresosNum.length - 1];
  const penultimoMes = ingresosNum[ingresosNum.length - 2];
  const tendenciaPct =
    penultimoMes && penultimoMes.totalNum > 0
      ? ((ultimoMes.totalNum - penultimoMes.totalNum) / penultimoMes.totalNum) * 100
      : null;

  const canSeeFinance = role === "ADMIN" || role === "CONTADOR";
  const isMechanic = role === "MECANICO";
  const isReception = role === "RECEPCION";
  const isAccountant = role === "CONTADOR";
  const alertasOrdenadas = [...(dashboard?.alertas_service ?? [])].sort((a, b) => {
    const estadoA = a.status === "VENCIDO" ? 0 : 1;
    const estadoB = b.status === "VENCIDO" ? 0 : 1;
    return estadoA - estadoB || a.diferencia_km - b.diferencia_km;
  });
  const turnosOrdenados = [...(dashboard?.turnos_proximos ?? [])].sort(
    (a, b) => new Date(a.fecha_hora).getTime() - new Date(b.fecha_hora).getTime(),
  );
  const moveRail = (rail: HTMLDivElement | null, direction: -1 | 1) => {
    rail?.scrollBy({ left: direction * Math.max(280, rail.clientWidth * 0.8), behavior: "smooth" });
  };
  const pageCopy = isMechanic
    ? {
        badge: "Área técnica",
        title: "Prioridades de trabajo",
        description: "Órdenes activas, vehículos y próximos mantenimientos.",
      }
    : isReception
      ? {
          badge: "Recepción",
          title: "Agenda y atención",
          description: "Turnos, clientes y seguimiento operativo del taller.",
        }
      : isAccountant
        ? {
            badge: "Administración financiera",
            title: "Control financiero",
            description: "Ingresos, saldos pendientes y evolución de facturación.",
          }
        : {
            badge: "Centro de Control",
            title: "Estado del Taller",
            description: `Analítica operativa y financiera en tiempo real — ${tallerNombre}.`,
          };

  return (
    <AppShell
      currentPath="/"
      compact
      badge={pageCopy.badge}
      title={pageCopy.title}
      description={pageCopy.description}
      actions={
        <div className="hidden h-9 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:flex">
          <svg className="h-4 w-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {todayLabel ?? "Cargando fecha…"}
          </span>
        </div>
      }
    >
      {loadError ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-900/50 dark:bg-red-950/20">
          <h3 className="text-sm font-bold uppercase tracking-widest text-red-800 dark:text-red-400">Falla Crítica de Enlace</h3>
          <p className="mt-2 text-sm text-red-700 dark:text-red-300/80">{loadError}</p>
          <button onClick={() => window.location.reload()} className="mt-4 text-xs font-bold underline text-red-800 dark:text-red-400 hover:text-red-900">Reintentar conexión</button>
        </div>
      ) : (
        <div className="space-y-4 animate-in fade-in duration-500">

          {/* HINT — bienvenida primera vez */}
          {role === "ADMIN" && !loading && dashboard?.total_clientes === 0 && dashboard?.total_vehiculos === 0 && <HintBubble
            id="hint-dashboard-v1"
            variant="inline"
            emoji="🚀"
            title="¡Bienvenido a Tallerista!"
            desc="Para empezar: primero cargá un cliente, después su vehículo, y luego creá tu primer presupuesto u orden de trabajo. ¡En 5 minutos ya tenés el taller funcionando!"
            action={{ label: "Ver guía de inicio", href: "/onboarding" }}
          />}

          {/* 1. BOTONERA GIGANTE DE COLORES (ACCESOS RÁPIDOS) */}
          <div className="grid gap-3 sm:grid-cols-3">
            
            {/* ACCESO AL KANBAN */}
            {(role === "ADMIN" || isMechanic) && <Link href="/trabajos/tablero" className="group relative overflow-hidden rounded-2xl border border-brand-200 bg-brand-50 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-brand-900/50 dark:bg-brand-900/20">
              <div className="absolute right-0 top-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-brand-500/10 blur-2xl transition-all group-hover:bg-brand-500/20"></div>
              <div className="relative z-10 flex items-center gap-3">
                <div className="inline-flex shrink-0 rounded-xl bg-brand-100 p-2.5 text-brand-600 dark:bg-brand-800/50 dark:text-brand-300">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                  </svg>
                </div>
                <div><h3 className="text-sm font-black tracking-tight text-brand-900 dark:text-white">Tablero de Operaciones</h3>
                <p className="mt-0.5 text-xs font-medium text-brand-700/80 dark:text-brand-200/60">Autos en proceso y listos</p></div>
              </div>
            </Link>}

            {/* ACCESO A CAJA */}
            {canSeeFinance && <Link href="/caja" className="group relative overflow-hidden rounded-2xl border border-emerald-200 bg-emerald-50 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-emerald-900/50 dark:bg-emerald-900/20">
              <div className="absolute right-0 top-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl transition-all group-hover:bg-emerald-500/20"></div>
              <div className="relative z-10 flex items-center gap-3">
                <div className="inline-flex shrink-0 rounded-xl bg-emerald-100 p-2.5 text-emerald-600 dark:bg-emerald-800/50 dark:text-emerald-300">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div><h3 className="text-sm font-black tracking-tight text-emerald-900 dark:text-white">Caja Diaria</h3>
                <p className="mt-0.5 text-xs font-medium text-emerald-700/80 dark:text-emerald-200/60">Ingresos, cobros y gastos</p></div>
              </div>
            </Link>}

            {/* ACCESO A TURNOS */}
            {(role === "ADMIN" || isReception) && <Link href="/turnos" className="group relative overflow-hidden rounded-2xl border border-purple-200 bg-purple-50 p-4 transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-purple-900/50 dark:bg-purple-900/20">
              <div className="absolute right-0 top-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-purple-500/10 blur-2xl transition-all group-hover:bg-purple-500/20"></div>
              <div className="relative z-10 flex items-center gap-3">
                <div className="inline-flex shrink-0 rounded-xl bg-purple-100 p-2.5 text-purple-600 dark:bg-purple-800/50 dark:text-purple-300">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div><h3 className="text-sm font-black tracking-tight text-purple-900 dark:text-white">Agenda de Turnos</h3>
                <p className="mt-0.5 text-xs font-medium text-purple-700/80 dark:text-purple-200/60">Citas programadas</p></div>
              </div>
            </Link>}

            {isMechanic && (
              <>
                <RoleActionCard href="/trabajos" tone="amber" title="Órdenes activas" description="Qué hacer y en qué vehículo" />
                <RoleActionCard href="/clientes" tone="slate" title="Clientes y vehículos" description="Personas, kilometraje e historial técnico" />
              </>
            )}

            {isReception && (
              <>
                <RoleActionCard href="/clientes" tone="amber" title="Directorio de clientes" description="Datos y vehículos de cada cliente" />
                <RoleActionCard href="/presupuestos" tone="slate" title="Presupuestos" description="Preparar y dar seguimiento" />
              </>
            )}

            {isAccountant && (
              <>
                <RoleActionCard href="/gastos" tone="amber" title="Gastos y compras" description="Egresos y comprobantes" />
                <RoleActionCard href="/caja" tone="slate" title="Movimientos" description="Revisar cobros y saldos" />
              </>
            )}

          </div>

          {/* 2. KPIs ESTRATÉGICOS MINIMALISTAS */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {canSeeFinance ? (
              <>
                <MetricCard title="Ingresos del Mes" value={loading ? "..." : formatCurrency(dashboard?.ingresos_mes_actual || 0)} loading={loading} highlight="text-emerald-600 dark:text-emerald-400" />
                <MetricCard title="Saldos pendientes" value={loading ? "..." : formatCurrency(dashboard?.cuenta_corriente_pendiente || 0)} loading={loading} highlight="text-red-500 dark:text-red-400" />
                <MetricCard title="Ticket promedio" value={loading ? "..." : formatCurrency(dashboard?.ticket_promedio || 0)} loading={loading} />
                <MetricCard title="Órdenes activas" value={loading ? "..." : formatNumber(dashboard?.trabajos_activos || 0)} loading={loading} />
              </>
            ) : (
              <>
                <MetricCard title="Órdenes activas" value={loading ? "..." : formatNumber(dashboard?.trabajos_activos || 0)} loading={loading} highlight="text-brand-600 dark:text-brand-400" />
                <MetricCard title="Vehículos registrados" value={loading ? "..." : formatNumber(dashboard?.total_vehiculos || 0)} loading={loading} />
                <MetricCard title={isMechanic ? "Controles próximos" : "Turnos próximos"} value={loading ? "..." : formatNumber(isMechanic ? dashboard?.alertas_service.length || 0 : dashboard?.turnos_proximos.length || 0)} loading={loading} />
                <MetricCard title="Actividad reciente" value={loading ? "..." : formatNumber(dashboard?.trabajos_recientes.length || 0)} loading={loading} />
              </>
            )}
          </div>

          {/* 3. ZONA DE GRÁFICOS Y LISTAS */}
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
            
            <div className="contents">
              {/* Gráfico financiero a ancho completo */}
              {canSeeFinance && <SectionCard
                compact
                className="order-3 lg:col-span-2 lg:row-start-2"
                title="Evolución de Facturación"
                description="Ingresos consolidados de los últimos 6 meses."
                action={
                  !loading && ingresosNum.length > 0 ? (
                    <div className="flex items-center divide-x divide-slate-200 rounded-xl border border-slate-200 bg-slate-50 text-center dark:divide-slate-700 dark:border-slate-700 dark:bg-slate-900/40">
                      <div className="px-4 py-2">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Acumulado 6M</p>
                        <p className="font-mono text-sm font-black text-slate-900 dark:text-white">{formatCurrency(total6m)}</p>
                      </div>
                      <div className="px-4 py-2">
                        <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Ticket Prom.</p>
                        <p className="font-mono text-sm font-black text-slate-900 dark:text-white">{formatCurrency(dashboard?.ticket_promedio ?? 0)}</p>
                      </div>
                      {tendenciaPct !== null && (
                        <div className="px-4 py-2">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Tendencia</p>
                          <p className={cn("font-mono text-sm font-black", tendenciaPct >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500 dark:text-red-400")}>
                            {tendenciaPct >= 0 ? "▲" : "▼"} {Math.abs(tendenciaPct).toFixed(0)}%
                          </p>
                        </div>
                      )}
                    </div>
                  ) : null
                }
              >
                {loading ? (
                  <div className="h-48 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-900/40" />
                ) : ingresosNum.length > 0 ? (
                  <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50/70 px-3 pb-3 pt-4 dark:border-slate-700 dark:bg-slate-900/30 sm:px-6">
                    <div className="pointer-events-none absolute inset-x-3 bottom-12 top-12 flex flex-col justify-between sm:inset-x-6">
                      {[1, 2, 3].map((line) => (
                        <div key={line} className="border-t border-dashed border-slate-200 dark:border-slate-700/70" />
                      ))}
                    </div>

                    <div className="relative flex h-52 items-end justify-between gap-2 sm:gap-5">
                      {ingresosNum.map((item, index) => {
                        const isCurrentMonth = index === ingresosNum.length - 1;
                        const isMejorMes = index === maxIngresoIdx && item.totalNum > 0;
                        const pct = maxIngreso > 0 ? (item.totalNum / maxIngreso) * 100 : 0;
                        const barHeight = chartMounted
                          ? `${Math.max(pct, item.totalNum > 0 ? 8 : 3)}%`
                          : "0%";
                        const [monthName, year] = item.label.split(" ");

                        return (
                          <div key={item.month} className="group flex h-full min-w-0 flex-1 flex-col justify-end text-center">
                            <div className="mb-2 min-h-8">
                              <p className={cn(
                                "truncate font-mono text-[10px] font-black sm:text-xs",
                                item.totalNum > 0 ? "text-slate-800 dark:text-white" : "text-slate-400",
                              )}>
                                {formatCurrency(item.total)}
                              </p>
                              <p className="mt-0.5 text-[9px] font-semibold text-slate-400">
                                {item.trabajos} {item.trabajos === 1 ? "orden" : "órdenes"}
                              </p>
                            </div>

                            <div className="flex h-28 items-end justify-center sm:h-32">
                              <div
                                title={`${item.label}: ${formatCurrency(item.total)}`}
                                className={cn(
                                  "w-full max-w-24 rounded-t-lg transition-[height,filter] duration-700 ease-out group-hover:brightness-110",
                                  isCurrentMonth
                                    ? "bg-gradient-to-t from-brand-600 to-brand-400 shadow-[0_0_24px_rgba(249,115,22,0.18)]"
                                    : isMejorMes
                                      ? "bg-gradient-to-t from-emerald-600 to-emerald-400"
                                      : item.totalNum === 0
                                        ? "bg-slate-200 dark:bg-slate-700"
                                        : "bg-gradient-to-t from-slate-500 to-slate-400",
                                )}
                                style={{ height: barHeight }}
                              />
                            </div>

                            <div className={cn(
                              "mt-2 rounded-lg px-1 py-1",
                              isCurrentMonth && "bg-brand-50 dark:bg-brand-900/20",
                            )}>
                              <p className={cn(
                                "text-xs font-black",
                                isCurrentMonth ? "text-brand-600 dark:text-brand-400" : "text-slate-700 dark:text-slate-300",
                              )}>
                                {monthName}
                              </p>
                              <p className="text-[9px] text-slate-400">{year}</p>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="mt-2 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 border-t border-slate-200 pt-3 text-[10px] font-semibold text-slate-500 dark:border-slate-700">
                      <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-brand-500" /> Mes actual</span>
                      <span className="flex items-center gap-1.5"><i className="h-2 w-2 rounded-full bg-emerald-500" /> Mejor mes</span>
                      <span>Altura proporcional a la facturación</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex h-48 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                    <p className="text-sm font-bold text-slate-500">Todavía no hay movimientos para graficar.</p>
                    <p className="mt-1 text-xs text-slate-400">El gráfico se completará automáticamente con los próximos cobros.</p>
                  </div>
                )}
              </SectionCard>}

              {/* Últimos Trabajos */}
              <SectionCard
                compact
                className="order-1 min-w-0 lg:col-start-1 lg:row-start-1"
                title={isMechanic ? "Trabajo técnico pendiente" : "Órdenes de Trabajo Recientes"}
                description={isMechanic ? "Qué hay que hacer y sobre qué vehículo." : "Monitoreo de actividad actual."}
              >
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    <div className="h-32 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"></div>
                  ) : dashboard?.trabajos_recientes && dashboard.trabajos_recientes.length > 0 ? (
                    dashboard.trabajos_recientes.slice(0, 5).map((t) => (
                      <div key={t.id} className="flex items-center justify-between py-2.5 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 font-mono text-[10px] font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            #{t.id}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-slate-900 dark:text-white">
                                {isMechanic ? (t.resumen || "Sin detalle técnico") : t.patente}
                              </p>
                              <StatusBadge status={t.estado} />
                            </div>
                            <p className="text-xs text-slate-500">
                              {isMechanic ? `${t.patente} • ${t.vehiculo}` : `${t.cliente_nombre} • ${t.vehiculo}`}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          {canSeeFinance && <p className="font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(t.total)}</p>}
                          <p className="text-[10px] text-slate-400">{formatDateTime(t.fecha_ingreso)}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-sm text-slate-500 py-6">No hay trabajos recientes.</p>
                  )}
                </div>
                <div className="border-t border-slate-100 pt-3 text-center dark:border-slate-800">
                  <Link href="/trabajos" className="text-xs font-bold uppercase tracking-widest text-brand-600 hover:text-brand-700 dark:text-brand-400">
                    Ver todo el historial →
                  </Link>
                </div>
              </SectionCard>
            </div>

            {/* 4. AGENDA Y ALERTAS (Columna Lateral) */}
            <div className="order-2 flex min-w-0 flex-col gap-4 lg:col-start-2 lg:row-start-1">
              
              {/* Alertas de Service */}
              {!loading && alertasOrdenadas.length > 0 && (
                <SectionCard
                  compact
                  title="Alertas de Mantenimiento"
                  description="De mayor a menor prioridad."
                  action={
                    <RailControls
                      count={`${alertasOrdenadas.length} avisos`}
                      onPrevious={() => moveRail(alertasRailRef.current, -1)}
                      onNext={() => moveRail(alertasRailRef.current, 1)}
                    />
                  }
                >
                  <div ref={alertasRailRef} className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {alertasOrdenadas.map((alerta) => {
                      const vencido = alerta.status === "VENCIDO";
                      const prioridad = vencido ? "Urgente" : alerta.diferencia_km <= 500 ? "Alta" : "Media";
                      return <div key={alerta.vehiculo_id} className={cn(
                        "min-w-[270px] snap-start rounded-xl border p-4",
                        vencido
                          ? "border-red-200 bg-red-50/60 dark:border-red-900/40 dark:bg-red-950/20"
                          : "border-amber-100 bg-amber-50/50 dark:border-amber-900/30 dark:bg-amber-900/10",
                      )}>
                        <div className="flex items-center justify-between">
                          <span className={cn(
                            "text-[9px] font-black uppercase tracking-widest",
                            vencido ? "text-red-600 dark:text-red-400" : "text-amber-700 dark:text-amber-400",
                          )}>{prioridad} · {alerta.status}</span>
                          <span className={cn("font-mono text-[10px] font-bold", vencido ? "text-red-500" : "text-amber-600")}>
                            {Math.abs(alerta.diferencia_km)} km
                          </span>
                        </div>
                        <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{alerta.patente} - {alerta.cliente_nombre}</p>
                        <p className="text-xs text-slate-500">Service sugerido: {formatNumber(alerta.proximo_service_km)} km</p>
                      </div>;
                    })}
                  </div>
                </SectionCard>
              )}

              {/* Agenda Inmediata */}
              {!isAccountant && <SectionCard
                compact
                title="Próximos Turnos"
                description="Primero, los más cercanos."
                action={turnosOrdenados.length > 0 ? (
                  <RailControls
                    count={`${turnosOrdenados.length} próximos`}
                    onPrevious={() => moveRail(turnosRailRef.current, -1)}
                    onNext={() => moveRail(turnosRailRef.current, 1)}
                  />
                ) : null}
              >
                <div>
                  {loading ? (
                     <div className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"></div>
                  ) : turnosOrdenados.length > 0 ? (
                    <div ref={turnosRailRef} className="-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {turnosOrdenados.map((turno, index) => (
                      <div key={turno.id} className="group relative min-w-[270px] snap-start rounded-xl border border-slate-200 p-4 transition-all hover:border-brand-500 dark:border-slate-700">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-brand-600 dark:text-brand-400">{formatDateTime(turno.fecha_hora)}</p>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[9px] font-black uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            {index === 0 ? "Siguiente" : turno.estado}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-bold text-slate-900 dark:text-white">{turno.cliente_nombre}</p>
                        <p className="text-xs text-slate-500">{turno.vehiculo}</p>
                        <p className="mt-2 truncate text-[10px] font-semibold text-slate-600 dark:text-slate-300">{turno.motivo}</p>
                      </div>
                    ))}
                    </div>
                  ) : (
                    <p className="py-5 text-center text-xs text-slate-400">Sin turnos programados.</p>
                  )}
                </div>
              </SectionCard>}

            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function MetricCard({ title, value, loading, highlight = "text-slate-900 dark:text-white" }: { title: string, value: string | undefined, loading: boolean, highlight?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{title}</p>
      {loading ? (
        <div className="mt-1 h-6 w-20 animate-pulse rounded bg-slate-100 dark:bg-slate-700"></div>
      ) : (
        <p className={cn("mt-0.5 font-mono text-xl font-black tracking-tight", highlight)}>{value}</p>
      )}
    </div>
  );
}

function RailControls({
  count,
  onPrevious,
  onNext,
}: {
  count: string;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="mr-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600 dark:bg-slate-900/50 dark:text-slate-300">
        {count}
      </span>
      <button
        type="button"
        onClick={onPrevious}
        aria-label="Ver anteriores"
        title="Ver anteriores"
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-black text-slate-500 transition hover:border-brand-400 hover:text-brand-600 active:scale-95 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
      >
        ←
      </button>
      <button
        type="button"
        onClick={onNext}
        aria-label="Ver siguientes"
        title="Ver siguientes"
        className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-sm font-black text-slate-500 transition hover:border-brand-400 hover:text-brand-600 active:scale-95 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
      >
        →
      </button>
    </div>
  );
}

function RoleActionCard({
  href,
  title,
  description,
  tone,
}: {
  href: string;
  title: string;
  description: string;
  tone: "amber" | "slate";
}) {
  const styles = tone === "amber"
    ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-white"
    : "border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white";

  return (
    <Link
      href={href}
      className={cn(
        "group relative flex items-center gap-3 overflow-hidden rounded-2xl border p-4 transition-all hover:-translate-y-0.5 hover:shadow-md",
        styles,
      )}
    >
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/70 text-base font-black shadow-sm dark:bg-slate-950/30">
        →
      </div>
      <div><h3 className="text-sm font-black tracking-tight">{title}</h3>
      <p className="mt-0.5 text-xs font-medium opacity-65">{description}</p></div>
    </Link>
  );
}
