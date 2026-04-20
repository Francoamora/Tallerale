"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { getClientes } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { Cliente } from "@/lib/types";
import { cn } from "@/lib/utils";
import { HintBubble } from "@/components/hint-bubble";

export default function DirectorioClientes() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [loading, setLoading] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [soloConDeuda, setSoloConDeuda] = useState(false);

  useEffect(() => {
    async function cargar() {
      try {
        setLoading(true);
        const data = await getClientes(busqueda);
        setClientes(data);
      } catch (e) {
        console.error("Error cargando directorio de clientes", e);
      } finally {
        setLoading(false);
      }
    }
    
    // Implementación de Debounce: Espera 300ms a que el usuario deje de tipear
    const timer = setTimeout(cargar, 300);
    return () => clearTimeout(timer);
  }, [busqueda]);

  // Filtro cliente-side
  const clientesFiltrados = soloConDeuda
    ? clientes.filter(c => Number(c.saldo_balance) > 0)
    : clientes;

  // Helper para armar el link de WhatsApp si tiene teléfono
  const getWhatsAppLink = (telefono: string) => {
    if (!telefono) return null;
    // Limpiamos todo lo que no sea número
    const numLimpio = telefono.replace(/\D/g, '');
    return `https://wa.me/${numLimpio}`;
  };

  return (
    <AppShell
      currentPath="/clientes"
      badge="Directorio"
      title="Gestión de Clientes"
      description="Cartera de clientes, información de contacto y estado de cuentas corrientes."
      actions={
        <Link
          href="/clientes/nuevo"
          className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-6 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 dark:bg-brand-600 dark:hover:bg-brand-500"
        >
          + Nuevo Cliente
        </Link>
      }
    >
      <div className="space-y-6">

        {/* HINT — primera visita */}
        <HintBubble
          id="hint-clientes-v1"
          variant="banner"
          emoji="👤"
          title="Empezá cargando un cliente"
          desc="Tocá '+ Nuevo Cliente' arriba a la derecha. Con nombre y teléfono ya es suficiente para arrancar."
          action={{ label: "Agregar primer cliente", href: "/clientes/nuevo" }}
        />

        {/* BARRA DE BÚSQUEDA Y FILTROS */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-md">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Buscar por nombre, apellido o DNI/CUIT..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-slate-800 dark:bg-slate-900/50 dark:text-white"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
            />
          </div>
          
          <div className="flex items-center gap-3">
            {/* Filtro: Solo con deuda */}
            <button
              onClick={() => setSoloConDeuda(!soloConDeuda)}
              className={cn(
                "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-bold uppercase tracking-wider transition-all",
                soloConDeuda
                  ? "border-red-400 bg-red-500 text-white shadow-sm"
                  : "border-slate-200 bg-white text-slate-500 hover:border-red-300 hover:bg-red-50 hover:text-red-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-red-900/20 dark:hover:text-red-400"
              )}
            >
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Solo con deuda
              {soloConDeuda && (
                <span className="ml-1 rounded-full bg-white/30 px-1.5 py-0.5 text-[9px] font-black">
                  {clientesFiltrados.length}
                </span>
              )}
            </button>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
              {clientesFiltrados.length} {clientesFiltrados.length === 1 ? "cliente" : "clientes"}
            </p>
          </div>
        </div>

        {/* DIRECTORIO */}
        <SectionCard title="Base de Datos" description="Listado centralizado de todos tus clientes registrados.">

          {/* ── VISTA MOBILE (cards) ── */}
          <div className="md:hidden divide-y divide-slate-100 dark:divide-slate-800/60">
            {loading ? (
              [1,2,3].map(i => (
                <div key={i} className="animate-pulse flex items-center gap-3 py-4">
                  <div className="h-10 w-10 rounded-full bg-slate-100 dark:bg-slate-800 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 rounded bg-slate-100 dark:bg-slate-800" />
                    <div className="h-3 w-24 rounded bg-slate-100 dark:bg-slate-800" />
                  </div>
                  <div className="h-4 w-16 rounded bg-slate-100 dark:bg-slate-800" />
                </div>
              ))
            ) : clientesFiltrados.length > 0 ? (
              clientesFiltrados.map((c) => {
                const deudor = Number(c.saldo_balance) > 0;
                const waLink = getWhatsAppLink(c.telefono || "");
                return (
                  <div key={c.id} className="py-4 space-y-3">
                    {/* Fila 1: Avatar + nombre + saldo */}
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-black text-brand-700 dark:bg-brand-900/40 dark:text-brand-400">
                        {c.nombre_completo.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-slate-900 dark:text-white truncate">{c.nombre_completo}</p>
                        <p className="text-[11px] text-slate-500">
                          {c.dni ? `DNI: ${c.dni}` : ""}
                          {c.telefono ? `${c.dni ? " · " : ""}${c.telefono}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className={cn("font-mono text-sm font-black", deudor ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")}>
                          {formatCurrency(Number(c.saldo_balance))}
                        </span>
                        {deudor && (
                          <p className="text-[9px] font-bold uppercase text-red-500">Con Deuda</p>
                        )}
                      </div>
                    </div>
                    {/* Fila 2: Acciones */}
                    <div className="flex items-center gap-2">
                      {waLink && (
                        <a href={waLink} target="_blank" rel="noopener noreferrer" className="flex h-9 w-9 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-600 dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-400">
                          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                        </a>
                      )}
                      {deudor && (
                        <Link href={`/pagos/registrar?cliente=${c.id}`} className="flex h-9 items-center gap-1.5 rounded-xl border border-red-200 bg-red-50 px-3 text-[10px] font-bold uppercase text-red-600 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                          Cobrar
                        </Link>
                      )}
                      <Link href={`/clientes/${c.id}`} className="ml-auto flex h-9 items-center gap-1.5 rounded-xl border border-brand-200 bg-brand-50 px-3 text-[10px] font-bold uppercase text-brand-600 dark:border-brand-900/50 dark:bg-brand-900/20 dark:text-brand-400">
                        Ver perfil →
                      </Link>
                    </div>
                  </div>
                );
              })
            ) : (
              <p className="py-12 text-center text-sm text-slate-400">
                {soloConDeuda ? "Ningún cliente tiene deuda pendiente. ¡Todo al día! 🎉" : "No se encontraron clientes."}
              </p>
            )}
          </div>

          {/* ── VISTA DESKTOP (tabla) ── */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full border-collapse text-left min-w-[850px]">
              <thead>
                <tr className="border-b border-slate-100 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 dark:border-slate-800">
                  <th className="py-4 pl-4">Nombre / Razón Social</th>
                  <th className="py-4">Contacto</th>
                  <th className="py-4">DNI / CUIT</th>
                  <th className="py-4 text-right">Saldo en Cuenta</th>
                  <th className="py-4 pr-4 text-right">Acciones Rápidas</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800/50">
                {loading ? (
                  <SkeletonRows />
                ) : clientesFiltrados.length > 0 ? (
                  clientesFiltrados.map((c) => {
                    const deudor = Number(c.saldo_balance) > 0;
                    const waLink = getWhatsAppLink(c.telefono || "");
                    return (
                      <tr key={c.id} className="group transition-colors hover:bg-slate-50/50 dark:hover:bg-slate-900/30">
                        <td className="py-4 pl-4">
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-900 dark:text-white">{c.nombre_completo}</span>
                            <span className="text-[10px] uppercase font-bold text-slate-400">ID: #{c.id}</span>
                          </div>
                        </td>
                        <td className="py-4">
                          <div className="flex flex-col gap-1">
                            {c.telefono ? <span className="text-xs font-bold text-slate-700 dark:text-slate-300">{c.telefono}</span> : <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Sin teléfono</span>}
                            {c.email && <span className="text-xs text-slate-500">{c.email}</span>}
                          </div>
                        </td>
                        <td className="py-4"><span className="font-mono text-xs font-bold text-slate-500 dark:text-slate-400">{c.dni || "—"}</span></td>
                        <td className="py-4 text-right">
                          <div className="flex flex-col items-end">
                            <span className={cn("font-mono text-sm font-black tracking-tight", deudor ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")}>{formatCurrency(Number(c.saldo_balance))}</span>
                            {deudor && <span className="mt-0.5 rounded-sm bg-red-50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-red-600 dark:bg-red-900/30 dark:text-red-400">Con Deuda</span>}
                          </div>
                        </td>
                        <td className="py-4 pr-4 text-right">
                          <div className="flex items-center justify-end gap-1.5 opacity-80 transition-opacity group-hover:opacity-100">
                            {waLink && (
                              <a href={waLink} target="_blank" rel="noopener noreferrer" title="WhatsApp" className="flex h-8 w-8 items-center justify-center rounded-lg border border-emerald-200 bg-emerald-50/50 text-emerald-600 transition hover:border-emerald-500 hover:bg-emerald-500 hover:text-white dark:border-emerald-900/50 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-600 dark:hover:text-white">
                                <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/></svg>
                              </a>
                            )}
                            {deudor && (
                              <Link href={`/pagos/registrar?cliente=${c.id}`} title="Cobrar" className="flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50/50 text-red-600 transition hover:border-red-500 hover:bg-red-500 hover:text-white dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-600 dark:hover:text-white">
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                              </Link>
                            )}
                            <Link href={`/clientes/${c.id}`} title="Ver perfil" className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-400 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-600 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-300">
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                            </Link>
                            <Link href={`/clientes/${c.id}`} title="Editar" className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand-200 bg-brand-50/50 text-brand-600 transition hover:border-brand-500 hover:bg-brand-500 hover:text-white dark:border-brand-900/50 dark:bg-brand-900/20 dark:text-brand-400 dark:hover:bg-brand-600 dark:hover:text-white">
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={5} className="py-16 text-center text-sm text-slate-400">
                      {soloConDeuda ? "Ningún cliente tiene deuda pendiente. ¡Todo al día! 🎉" : "No se encontraron clientes que coincidan con la búsqueda."}
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

function SkeletonRows() {
  return (
    <>
      {[1, 2, 3, 4, 5].map((i) => (
        <tr key={i} className="animate-pulse">
          <td className="py-5 pl-4"><div className="h-4 w-32 rounded bg-slate-100 dark:bg-slate-800" /></td>
          <td className="py-5"><div className="h-4 w-24 rounded bg-slate-100 dark:bg-slate-800" /></td>
          <td className="py-5"><div className="h-4 w-20 rounded bg-slate-100 dark:bg-slate-800" /></td>
          <td className="py-5"><div className="ml-auto h-4 w-24 rounded bg-slate-100 dark:bg-slate-800" /></td>
          <td className="py-5 pr-4"><div className="ml-auto h-8 w-32 rounded-lg bg-slate-100 dark:bg-slate-800" /></td>
        </tr>
      ))}
    </>
  );
}   