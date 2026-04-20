"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { getDashboardData } from "@/lib/api";
import { formatCurrency, formatDateTime, formatNumber } from "@/lib/format";
import type { DashboardStats } from "@/lib/types";
import { cn } from "@/lib/utils";
import { HintBubble } from "@/components/hint-bubble";
import { getTrialInfo } from "@/lib/trial";

export default function Home() {
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [chartMounted, setChartMounted] = useState(false);
  const [tallerNombre, setTallerNombre] = useState("tu taller");

  useEffect(() => {
    // Leer nombre del taller desde la sesión
    const info = getTrialInfo();
    if (info.tallerNombre) setTallerNombre(info.tallerNombre);

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

  return (
    <AppShell
      currentPath="/"
      badge="Centro de Control"
      title="Estado del Taller"
      description={`Analítica operativa y financiera en tiempo real — ${tallerNombre}.`}
      actions={
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <svg className="h-4 w-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
            {new Date().toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" })}
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
        <div className="space-y-8 animate-in fade-in duration-700">

          {/* HINT — bienvenida primera vez */}
          <HintBubble
            id="hint-dashboard-v1"
            variant="inline"
            emoji="🚀"
            title="¡Bienvenido a TallerOS!"
            desc="Para empezar: primero cargá un cliente, después su vehículo, y luego creá tu primer presupuesto u orden de trabajo. ¡En 5 minutos ya tenés el taller funcionando!"
            action={{ label: "Ver guía de inicio", href: "/onboarding" }}
          />

          {/* 1. BOTONERA GIGANTE DE COLORES (ACCESOS RÁPIDOS) */}
          <div className="grid gap-4 sm:grid-cols-3">
            
            {/* ACCESO AL KANBAN */}
            <Link href="/trabajos/tablero" className="group relative overflow-hidden rounded-3xl border border-brand-200 bg-brand-50 p-6 transition-all hover:-translate-y-1 hover:shadow-lg dark:border-brand-900/50 dark:bg-brand-900/20">
              <div className="absolute right-0 top-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-brand-500/10 blur-2xl transition-all group-hover:bg-brand-500/20"></div>
              <div className="relative z-10">
                <div className="mb-4 inline-flex rounded-xl bg-brand-100 p-3 text-brand-600 dark:bg-brand-800/50 dark:text-brand-300">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
                  </svg>
                </div>
                <h3 className="font-mono text-xl font-black tracking-tight text-brand-900 dark:text-white">Tablero de Operaciones</h3>
                <p className="mt-1 text-sm font-medium text-brand-700/80 dark:text-brand-200/60">Ver autos en proceso y listos</p>
              </div>
            </Link>

            {/* ACCESO A CAJA */}
            <Link href="/caja" className="group relative overflow-hidden rounded-3xl border border-emerald-200 bg-emerald-50 p-6 transition-all hover:-translate-y-1 hover:shadow-lg dark:border-emerald-900/50 dark:bg-emerald-900/20">
              <div className="absolute right-0 top-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-emerald-500/10 blur-2xl transition-all group-hover:bg-emerald-500/20"></div>
              <div className="relative z-10">
                <div className="mb-4 inline-flex rounded-xl bg-emerald-100 p-3 text-emerald-600 dark:bg-emerald-800/50 dark:text-emerald-300">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <h3 className="font-mono text-xl font-black tracking-tight text-emerald-900 dark:text-white">Caja Diaria</h3>
                <p className="mt-1 text-sm font-medium text-emerald-700/80 dark:text-emerald-200/60">Ingresos, cobros y gastos</p>
              </div>
            </Link>

            {/* ACCESO A TURNOS */}
            <Link href="/turnos" className="group relative overflow-hidden rounded-3xl border border-purple-200 bg-purple-50 p-6 transition-all hover:-translate-y-1 hover:shadow-lg dark:border-purple-900/50 dark:bg-purple-900/20">
              <div className="absolute right-0 top-0 -mr-4 -mt-4 h-24 w-24 rounded-full bg-purple-500/10 blur-2xl transition-all group-hover:bg-purple-500/20"></div>
              <div className="relative z-10">
                <div className="mb-4 inline-flex rounded-xl bg-purple-100 p-3 text-purple-600 dark:bg-purple-800/50 dark:text-purple-300">
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <h3 className="font-mono text-xl font-black tracking-tight text-purple-900 dark:text-white">Agenda de Turnos</h3>
                <p className="mt-1 text-sm font-medium text-purple-700/80 dark:text-purple-200/60">Citas y clientes programados</p>
              </div>
            </Link>

          </div>

          {/* 2. KPIs ESTRATÉGICOS MINIMALISTAS */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard title="Total Clientes" value={loading ? "..." : formatNumber(dashboard?.total_clientes || 0)} loading={loading} />
            <MetricCard title="Autos Atendidos" value={loading ? "..." : formatNumber(dashboard?.total_vehiculos || 0)} loading={loading} />
            <MetricCard 
              title="Ingresos del Mes" 
              value={loading ? "..." : formatCurrency(dashboard?.ingresos_mes_actual || 0)} 
              loading={loading} 
              highlight="text-emerald-600 dark:text-emerald-400"
            />
            <MetricCard 
              title="Fiados (Deuda en la calle)" 
              value={loading ? "..." : formatCurrency(dashboard?.cuenta_corriente_pendiente || 0)} 
              loading={loading} 
              highlight="text-red-500 dark:text-red-400"
            />
          </div>

          {/* 3. ZONA DE GRÁFICOS Y LISTAS */}
          <div className="grid gap-8 lg:grid-cols-[1.6fr_1fr]">
            
            <div className="flex flex-col gap-8">
              {/* Gráfico de Barras de Ingresos Mensuales — UPGRADED */}
              <SectionCard
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
                <div className="space-y-4">
                  {loading ? (
                    <div className="space-y-4">
                      {[1,2,3,4,5,6].map(i => (
                        <div key={i} className="animate-pulse space-y-2">
                          <div className="flex justify-between">
                            <div className="h-4 w-20 rounded bg-slate-100 dark:bg-slate-800" />
                            <div className="h-4 w-24 rounded bg-slate-100 dark:bg-slate-800" />
                          </div>
                          <div className="h-7 w-full rounded-lg bg-slate-100 dark:bg-slate-800" />
                        </div>
                      ))}
                    </div>
                  ) : ingresosNum.length > 0 ? (
                    ingresosNum.map((item, index) => {
                      const isCurrentMonth = index === ingresosNum.length - 1;
                      const isMejorMes = index === maxIngresoIdx && item.totalNum > 0;
                      const pct = maxIngreso > 0 ? (item.totalNum / maxIngreso) * 100 : 0;
                      const barWidth = chartMounted ? `${Math.max(pct, pct > 0 ? 1.5 : 0)}%` : "0%";

                      return (
                        <div key={item.month} className="group space-y-1.5">
                          {/* Label row */}
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "text-sm font-bold",
                                isCurrentMonth ? "text-brand-600 dark:text-brand-400" : "text-slate-700 dark:text-slate-300"
                              )}>
                                {item.label}
                              </span>
                              {isCurrentMonth && (
                                <span className="rounded-full bg-brand-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-brand-700 dark:bg-brand-900/40 dark:text-brand-400">
                                  Actual
                                </span>
                              )}
                              {isMejorMes && !isCurrentMonth && (
                                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400">
                                  ⭐ Mejor
                                </span>
                              )}
                              {isMejorMes && isCurrentMonth && (
                                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">
                                  ⭐ Récord
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-[11px] font-medium text-slate-400">
                                {item.trabajos} {item.trabajos === 1 ? "OT" : "OTs"}
                              </span>
                              <span className="font-mono text-sm font-bold text-slate-900 dark:text-white">
                                {formatCurrency(item.total)}
                              </span>
                            </div>
                          </div>

                          {/* Barra */}
                          <div className="relative h-7 w-full overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800/60">
                            <div
                              className={cn(
                                "absolute left-0 top-0 h-full rounded-lg transition-[width] duration-700 ease-out",
                                isCurrentMonth
                                  ? "bg-gradient-to-r from-brand-600 to-brand-400"
                                  : isMejorMes
                                  ? "bg-gradient-to-r from-emerald-500 to-emerald-400"
                                  : item.totalNum === 0
                                  ? "bg-slate-200 dark:bg-slate-700"
                                  : "bg-gradient-to-r from-slate-500 to-slate-400 dark:from-slate-500 dark:to-slate-400"
                              )}
                              style={{ width: barWidth }}
                            />
                            {/* Porcentaje inline */}
                            {pct > 18 && (
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-white/90">
                                {pct.toFixed(0)}%
                              </span>
                            )}
                            {/* Sin facturación */}
                            {item.totalNum === 0 && (
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-400 dark:text-slate-500">
                                Sin facturación
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center py-10">
                      <svg className="mb-3 h-10 w-10 text-slate-200 dark:text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      <p className="text-sm font-medium text-slate-400">No hay datos de facturación aún.</p>
                      <p className="mt-1 text-xs text-slate-400">Los datos aparecerán a medida que cargues órdenes de trabajo.</p>
                    </div>
                  )}
                </div>
              </SectionCard>

              {/* Últimos Trabajos */}
              <SectionCard title="Órdenes de Trabajo Recientes" description="Monitoreo de actividad actual.">
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    <div className="h-32 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"></div>
                  ) : dashboard?.trabajos_recientes && dashboard.trabajos_recientes.length > 0 ? (
                    dashboard.trabajos_recientes.slice(0, 5).map((t) => (
                      <div key={t.id} className="flex items-center justify-between py-4 transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 font-mono text-xs font-bold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            #{t.id}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <p className="font-bold text-slate-900 dark:text-white">{t.patente}</p>
                              <StatusBadge status={t.estado} />
                            </div>
                            <p className="text-xs text-slate-500">{t.cliente_nombre} • {t.vehiculo}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(t.total)}</p>
                          <p className="text-[10px] text-slate-400">{formatDateTime(t.fecha_ingreso)}</p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-center text-sm text-slate-500 py-6">No hay trabajos recientes.</p>
                  )}
                </div>
                <div className="border-t border-slate-100 p-4 text-center dark:border-slate-800">
                  <Link href="/trabajos" className="text-xs font-bold uppercase tracking-widest text-brand-600 hover:text-brand-700 dark:text-brand-400">
                    Ver todo el historial →
                  </Link>
                </div>
              </SectionCard>
            </div>

            {/* 4. AGENDA Y ALERTAS (Columna Lateral) */}
            <div className="flex flex-col gap-8">
              
              {/* Alertas de Service */}
              {!loading && dashboard?.alertas_service && dashboard.alertas_service.length > 0 && (
                <SectionCard title="Alertas de Mantenimiento" description="Clientes con service próximo o vencido.">
                  <div className="space-y-3">
                    {dashboard.alertas_service.map((alerta) => (
                      <div key={alerta.vehiculo_id} className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 dark:border-amber-900/30 dark:bg-amber-900/10">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-black uppercase tracking-widest text-amber-700 dark:text-amber-400">{alerta.status}</span>
                          <span className="font-mono text-[10px] font-bold text-amber-600">{alerta.diferencia_km} km</span>
                        </div>
                        <p className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{alerta.patente} - {alerta.cliente_nombre}</p>
                        <p className="text-xs text-slate-500">Service sugerido: {formatNumber(alerta.proximo_service_km)} km</p>
                      </div>
                    ))}
                  </div>
                </SectionCard>
              )}

              {/* Agenda Inmediata */}
              <SectionCard title="Próximos Turnos" description="Agenda para las próximas 48hs.">
                <div className="space-y-4">
                  {loading ? (
                     <div className="h-24 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"></div>
                  ) : dashboard?.turnos_proximos && dashboard.turnos_proximos.length > 0 ? (
                    dashboard.turnos_proximos.map((turno) => (
                      <div key={turno.id} className="group relative rounded-xl border border-slate-200 p-4 transition-all hover:border-brand-500 dark:border-slate-800">
                        <div className="flex items-center justify-between">
                          <p className="text-xs font-bold text-brand-600 dark:text-brand-400">{formatDateTime(turno.fecha_hora)}</p>
                          <div className={`h-2 w-2 rounded-full ${turno.estado === 'CONFIRMADO' ? 'bg-emerald-500' : 'bg-slate-300'}`} />
                        </div>
                        <p className="mt-2 font-bold text-slate-900 dark:text-white">{turno.cliente_nombre}</p>
                        <p className="text-xs text-slate-500">{turno.vehiculo}</p>
                        <div className="mt-3 flex items-center gap-2">
                           <span className="text-[10px] font-bold uppercase text-slate-400">Motivo:</span>
                           <span className="text-[10px] font-semibold text-slate-600 dark:text-slate-300">{turno.motivo}</span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="py-8 text-center text-xs text-slate-400">Sin turnos programados.</p>
                  )}
                </div>
              </SectionCard>

            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function MetricCard({ title, value, loading, highlight = "text-slate-900 dark:text-white" }: { title: string, value: string | undefined, loading: boolean, highlight?: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md dark:border-slate-700 dark:bg-slate-800">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{title}</p>
      {loading ? (
        <div className="mt-2 h-8 w-24 animate-pulse rounded bg-slate-100 dark:bg-slate-700"></div>
      ) : (
        <p className={cn("mt-1 font-mono text-3xl font-black tracking-tight", highlight)}>{value}</p>
      )}
    </div>
  );
}