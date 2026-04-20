"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { getMovimientosCaja, type MovimientoCaja } from "@/lib/api";
import { HintBubble } from "@/components/hint-bubble";
import { formatCurrency, formatDateTime } from "@/lib/format";

export default function CajaDiaria() {
  const [movimientos, setMovimientos] = useState<MovimientoCaja[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function cargarCaja() {
      try {
        setLoading(true);
        const data = await getMovimientosCaja();
        setMovimientos(data);
      } catch (err) {
        setError("No se pudo cargar el libro mayor.");
      } finally {
        setLoading(false);
      }
    }
    cargarCaja();
  }, []);

  // Cálculos matemáticos en vivo
  const totalIngresos = movimientos.filter(m => m.tipo === "INGRESO").reduce((acc, curr) => acc + curr.monto, 0);
  const totalEgresos = movimientos.filter(m => m.tipo === "EGRESO").reduce((acc, curr) => acc + curr.monto, 0);
  const balanceNeto = totalIngresos - totalEgresos;

  return (
    <AppShell
      currentPath="/caja"
      badge="Tesorería"
      title="Caja Diaria y Libro Mayor"
      description="Monitoreo en tiempo real de los flujos de efectivo del taller."
      actions={
        <div className="flex items-center gap-3">
          <Link
            href="/compras/nueva"
            className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
          >
            - Registrar Gasto
          </Link>
          <Link
            href="/pagos/registrar"
            className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-5 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
          >
            + Acreditar Cobro
          </Link>
        </div>
      }
    >
      <div className="space-y-6">

        {/* HINT — primera visita */}
        <HintBubble
          id="hint-caja-v1"
          variant="banner"
          emoji="💰"
          title="Controlá cada peso del taller"
          desc="Registrá los cobros de las órdenes de trabajo y los gastos del día. El balance se calcula solo."
          action={{ label: "Registrar cobro", href: "/pagos/registrar" }}
        />

        {/* KPI FINANCIEROS */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 dark:border-emerald-900/30 dark:bg-emerald-950/20">
            <p className="text-xs font-bold uppercase tracking-widest text-emerald-800 dark:text-emerald-400">Total Ingresos</p>
            <p className="mt-2 font-mono text-3xl font-black text-emerald-600 dark:text-emerald-500">{formatCurrency(totalIngresos)}</p>
          </div>
          
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-900/30 dark:bg-red-950/20">
            <p className="text-xs font-bold uppercase tracking-widest text-red-800 dark:text-red-400">Total Egresos</p>
            <p className="mt-2 font-mono text-3xl font-black text-red-600 dark:text-red-500">{formatCurrency(totalEgresos)}</p>
          </div>

          <div className={`rounded-2xl border p-6 shadow-sm ${balanceNeto >= 0 ? 'bg-slate-900 border-slate-800 dark:bg-brand-600' : 'bg-red-900 border-red-800'}`}>
            <p className="text-xs font-bold uppercase tracking-widest text-white/70">Balance Neto</p>
            <p className="mt-2 font-mono text-3xl font-black text-white">{formatCurrency(balanceNeto)}</p>
          </div>
        </div>

        {/* LIBRO MAYOR (TABLA) */}
        <SectionCard title="Historial de Movimientos" description="Registro cronológico de entradas y salidas de dinero.">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:border-slate-800">
                  <th className="py-4 pl-4">Fecha y Hora</th>
                  <th className="py-4">Concepto</th>
                  <th className="py-4 text-center">Método</th>
                  <th className="py-4 text-right pr-4">Monto</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {loading ? (
                  <tr><td colSpan={4} className="py-12 text-center text-slate-400 animate-pulse">Cargando libro contable...</td></tr>
                ) : movimientos.length > 0 ? (
                  movimientos.map((m) => (
                    <tr key={m.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/30">
                      <td className="py-4 pl-4 text-slate-500">{formatDateTime(m.fecha)}</td>
                      <td className="py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900 dark:text-white">{m.concepto}</span>
                          <span className="text-[10px] uppercase tracking-widest text-slate-400">{m.id}</span>
                        </div>
                      </td>
                      <td className="py-4 text-center">
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 dark:bg-slate-800">
                          {m.metodo}
                        </span>
                      </td>
                      <td className="py-4 pr-4 text-right">
                        <span className={`font-mono font-bold ${m.tipo === 'INGRESO' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                          {m.tipo === 'INGRESO' ? '+' : '-'}{formatCurrency(m.monto)}
                        </span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="py-16 text-center text-sm text-slate-400">
                      No hay movimientos registrados en la caja.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </SectionCard>

      </div>
    </AppShell>
  );
}