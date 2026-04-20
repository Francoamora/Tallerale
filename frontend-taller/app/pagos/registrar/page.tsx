"use client";

import { useEffect, useRef, useState, useTransition, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { getClientes, buildPublicApiUrl } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { Cliente } from "@/lib/types";
import { cn } from "@/lib/utils";

function RegistroPagoForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedClienteId = searchParams.get("cliente");

  // ESTADO DE DATOS
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  
  // MODOS DE UI
  const [modo, setModo] = useState<"COBRO_NORMAL" | "FIADO">("COBRO_NORMAL");
  const [tipoCliente, setTipoCliente] = useState<"DIRECTORIO" | "EXPRESS">("DIRECTORIO");

  // COMBOBOX BUSCADOR
  const [busqueda, setBusqueda] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const comboRef = useRef<HTMLDivElement>(null);

  // CAMPOS DEL FORMULARIO
  const [expressNombre, setExpressNombre] = useState("");
  const [expressTelefono, setExpressTelefono] = useState("");
  
  const [montoTotalVenta, setMontoTotalVenta] = useState(""); // Cuánto salió lo que llevó
  const [montoEntregado, setMontoEntregado] = useState("");   // Cuánto pagó ahora
  const [fechaPromesa, setFechaPromesa] = useState("");       // Cuándo promete pagar
  const [metodo, setMetodo] = useState("EFECTIVO");
  const [descripcion, setDescripcion] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRedirecting, startRedirect] = useTransition();
  const [feedback, setFeedback] = useState({ tone: "idle", message: "" });

  useEffect(() => {
    async function cargarDirectorio() {
      try {
        const data = await getClientes();
        setClientes(data);
        if (preselectedClienteId) {
          const target = data.find(c => c.id === Number(preselectedClienteId));
          if (target) {
            seleccionarCliente(target);
          }
        }
      } catch (err) {
        setFeedback({ tone: "error", message: "Error conectando." });
      } finally {
        setIsLoading(false);
      }
    }
    cargarDirectorio();
  }, [preselectedClienteId]);

  // Cerrar dropdown al hacer click afuera
  useEffect(() => {
    function onClickFuera(e: MouseEvent) {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickFuera);
    return () => document.removeEventListener("mousedown", onClickFuera);
  }, []);

  function seleccionarCliente(c: Cliente) {
    setClienteSeleccionado(c);
    setBusqueda(c.nombre_completo);
    setDropdownOpen(false);
    if (modo === "COBRO_NORMAL" && Number(c.saldo_balance) > 0) {
      setMontoEntregado(c.saldo_balance.toString());
    } else {
      setMontoEntregado("");
    }
  }

  function limpiarCliente() {
    setClienteSeleccionado(null);
    setBusqueda("");
    setMontoEntregado("");
  }

  const clientesFiltrados = busqueda.trim().length < 1
    ? clientes.slice(0, 8)
    : clientes.filter(c => {
        const q = busqueda.toLowerCase();
        return (
          c.nombre_completo.toLowerCase().includes(q) ||
          (c.dni ?? "").toLowerCase().includes(q) ||
          (c.telefono ?? "").includes(q)
        );
      }).slice(0, 10);

  async function procesarTransaccion(e: React.FormEvent) {
    e.preventDefault();
    if (tipoCliente === "DIRECTORIO" && !clienteSeleccionado) return setFeedback({ tone: "error", message: "Selecciona un cliente." });
    if (tipoCliente === "EXPRESS" && !expressNombre.trim()) return setFeedback({ tone: "error", message: "Falta el nombre." });

    const totalVentaNum = parseFloat(montoTotalVenta) || 0;
    const pagoNum = parseFloat(montoEntregado) || 0;

    if (modo === "FIADO" && totalVentaNum <= 0) return setFeedback({ tone: "error", message: "El total de la venta debe ser mayor a 0." });
    if (modo === "COBRO_NORMAL" && pagoNum <= 0) return setFeedback({ tone: "error", message: "El pago debe ser mayor a 0." });

    setIsSaving(true);
    setFeedback({ tone: "idle", message: "" });

    const payload = {
      cliente_id: tipoCliente === "DIRECTORIO" ? clienteSeleccionado?.id : undefined,
      cliente_express: tipoCliente === "EXPRESS" ? { nombre: expressNombre, telefono: expressTelefono } : undefined,
      monto_total_venta: modo === "FIADO" ? totalVentaNum : 0,
      monto_pagado: pagoNum,
      metodo_pago: metodo,
      descripcion: descripcion.trim(),
      fecha_promesa: fechaPromesa || undefined
    };

    try {
      const response = await fetch(buildPublicApiUrl("/pagos/"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) throw new Error("Error al registrar la transacción.");

      setFeedback({ tone: "success", message: "¡Transacción registrada y cuenta actualizada!" });
      startRedirect(() => { router.push("/clientes"); router.refresh(); });
    } catch (error) {
      setFeedback({ tone: "error", message: "Ocurrió un error en el servidor." });
      setIsSaving(false);
    }
  }

  // Lógica Matemática Visual
  const saldoPrevio = clienteSeleccionado ? Number(clienteSeleccionado.saldo_balance) : 0;
  const nuevoCargo = modo === "FIADO" ? (parseFloat(montoTotalVenta) || 0) : 0;
  const pagoActual = parseFloat(montoEntregado) || 0;
  const saldoFinalProyectado = saldoPrevio + nuevoCargo - pagoActual;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
      <div className="space-y-6">
        
        {/* SELECTOR DE MODO */}
        <div className="flex gap-2 rounded-xl bg-slate-200/50 p-1.5 dark:bg-slate-800/50">
          <button onClick={() => { setModo("COBRO_NORMAL"); setMontoTotalVenta(""); }} className={cn("flex-1 rounded-lg py-2.5 text-sm font-bold transition-all", modo === "COBRO_NORMAL" ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500 hover:text-slate-700")}>
            Abonar Cuenta / Deuda
          </button>
          <button onClick={() => setModo("FIADO")} className={cn("flex-1 rounded-lg py-2.5 text-sm font-bold transition-all", modo === "FIADO" ? "bg-white text-brand-600 shadow-sm dark:bg-brand-600/20 dark:text-brand-400" : "text-slate-500 hover:text-slate-700")}>
            Venta Rápida / Sacar Fiado
          </button>
        </div>

        <form onSubmit={procesarTransaccion} className="space-y-6">
          {feedback.message && (
            <div className={cn("rounded-xl border p-4 text-sm font-medium", feedback.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800")}>
              {feedback.message}
            </div>
          )}

          <SectionCard title="Detalles de la Operación">
            <div className="grid gap-5">
              
              {/* SELECTOR DE CLIENTE (CON EXPRESS) */}
              <div className="space-y-3 border-b border-slate-100 pb-5 dark:border-slate-800">
                <div className="flex justify-between items-end">
                   <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Cliente Operador</span>
                   <button type="button" onClick={() => setTipoCliente(t => t === "DIRECTORIO" ? "EXPRESS" : "DIRECTORIO")} className="text-xs font-bold text-brand-600 underline dark:text-brand-400">
                     {tipoCliente === "DIRECTORIO" ? "+ Alta Express al vuelo" : "Buscar en directorio"}
                   </button>
                </div>

                {tipoCliente === "DIRECTORIO" ? (
                  /* ── COMBOBOX CON BÚSQUEDA ── */
                  <div ref={comboRef} className="relative">
                    <div className="relative">
                      <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                      <input
                        type="text"
                        placeholder={isLoading ? "Cargando clientes..." : "Buscar por nombre, DNI o teléfono..."}
                        disabled={isLoading || isSaving}
                        value={busqueda}
                        onChange={e => { setBusqueda(e.target.value); setDropdownOpen(true); setClienteSeleccionado(null); setMontoEntregado(""); }}
                        onFocus={() => setDropdownOpen(true)}
                        className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-10 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white disabled:opacity-50"
                      />
                      {clienteSeleccionado && (
                        <button type="button" onClick={limpiarCliente} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>

                    {/* Chip del cliente seleccionado */}
                    {clienteSeleccionado && (
                      <div className={cn(
                        "mt-2 flex items-center justify-between rounded-xl border px-4 py-2.5",
                        Number(clienteSeleccionado.saldo_balance) > 0
                          ? "border-red-200 bg-red-50 dark:border-red-800/40 dark:bg-red-900/20"
                          : "border-emerald-200 bg-emerald-50 dark:border-emerald-800/40 dark:bg-emerald-900/20"
                      )}>
                        <div>
                          <p className="text-sm font-bold text-slate-900 dark:text-white">{clienteSeleccionado.nombre_completo}</p>
                          <p className="text-xs text-slate-500">
                            {clienteSeleccionado.dni && <span>DNI {clienteSeleccionado.dni} · </span>}
                            {clienteSeleccionado.telefono || "Sin teléfono"}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Deuda actual</p>
                          <p className={cn("font-mono text-sm font-black", Number(clienteSeleccionado.saldo_balance) > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400")}>
                            {formatCurrency(Number(clienteSeleccionado.saldo_balance))}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Dropdown de resultados */}
                    {dropdownOpen && !clienteSeleccionado && (
                      <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                        {clientesFiltrados.length === 0 ? (
                          <div className="px-4 py-6 text-center text-sm text-slate-400">
                            Sin resultados para &ldquo;{busqueda}&rdquo;
                          </div>
                        ) : (
                          <ul className="max-h-64 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                            {busqueda.trim().length < 1 && (
                              <li className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                Últimos clientes — escribí para filtrar
                              </li>
                            )}
                            {clientesFiltrados.map(c => (
                              <li key={c.id}>
                                <button
                                  type="button"
                                  onMouseDown={() => seleccionarCliente(c)}
                                  className="flex w-full items-center justify-between px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800"
                                >
                                  <div>
                                    <p className="text-sm font-bold text-slate-900 dark:text-white">{c.nombre_completo}</p>
                                    <p className="text-xs text-slate-400">
                                      {c.dni ? `DNI ${c.dni}` : "Sin DNI"}
                                      {c.telefono && ` · ${c.telefono}`}
                                    </p>
                                  </div>
                                  {Number(c.saldo_balance) > 0 && (
                                    <span className="ml-3 flex-shrink-0 rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700 dark:bg-red-900/30 dark:text-red-400">
                                      Debe {formatCurrency(Number(c.saldo_balance))}
                                    </span>
                                  )}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <input type="text" placeholder="Nombre completo (Ej: Carlos Gomez)" value={expressNombre} onChange={(e) => setExpressNombre(e.target.value)} className="w-full rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-brand-900/50 dark:bg-brand-900/10 dark:text-white" />
                    <input type="text" placeholder="Teléfono (Opcional)" value={expressTelefono} onChange={(e) => setExpressTelefono(e.target.value)} className="w-full rounded-lg border border-brand-200 bg-brand-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-brand-900/50 dark:bg-brand-900/10 dark:text-white" />
                  </div>
                )}
              </div>

              {/* MODO FIADO: Total de la venta */}
              {modo === "FIADO" && (
                <div className="grid gap-5 sm:grid-cols-2 bg-slate-50 p-4 rounded-xl border border-slate-100 dark:bg-slate-800/30 dark:border-slate-700">
                  <label className="space-y-1.5">
                    <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Total de la Venta ($)</span>
                    <input required type="number" step="0.01" min="0.01" placeholder="Ej: 100000" value={montoTotalVenta} onChange={(e) => setMontoTotalVenta(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white py-2.5 px-4 font-mono text-lg font-bold text-slate-900 outline-none focus:border-brand-500" />
                  </label>
                  <label className="space-y-1.5">
                    <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Fecha Promesa de Pago</span>
                    <input type="date" value={fechaPromesa} onChange={(e) => setFechaPromesa(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-white py-2.5 px-4 text-sm text-slate-900 outline-none focus:border-brand-500" />
                  </label>
                </div>
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                    {modo === "FIADO" ? "Entrega / Seña ($)" : "Monto a Abonar ($)"}
                  </span>
                  <input type="number" step="0.01" min="0" placeholder="Ej: 50000" value={montoEntregado} onChange={(e) => setMontoEntregado(e.target.value)} className="w-full rounded-lg border border-emerald-200 bg-emerald-50 py-2.5 px-4 font-mono text-lg font-bold text-emerald-900 outline-none focus:border-emerald-500 dark:border-emerald-900/50 dark:bg-emerald-900/10 dark:text-emerald-400" />
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Método de Entrega</span>
                  <select value={metodo} onChange={(e) => setMetodo(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
                    <option value="EFECTIVO">Efectivo</option>
                    <option value="TRANSFERENCIA">Transferencia Bancaria</option>
                  </select>
                </label>
              </div>

              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Notas / Concepto</span>
                <input type="text" placeholder={modo === "FIADO" ? "Compra de 4 cubiertas, entregó mitad..." : "Abono a cuenta..."} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className="w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white" />
              </label>
            </div>

            <div className="mt-8 flex justify-end gap-3">
              <button type="submit" disabled={isSaving || isRedirecting} className="inline-flex w-full justify-center rounded-xl bg-slate-900 px-8 py-3 text-sm font-bold text-white shadow-md transition hover:bg-slate-800 sm:w-auto dark:bg-brand-600 dark:hover:bg-brand-500">
                {isSaving ? "Procesando..." : "Confirmar Operación"}
              </button>
            </div>
          </SectionCard>
        </form>
      </div>

      {/* PANEL LATERAL (CALCULADORA EN VIVO) */}
      <aside className="space-y-6">
        <div className={cn("overflow-hidden rounded-2xl border shadow-sm transition-colors duration-500", 
          tipoCliente === "EXPRESS" ? "border-brand-200 bg-brand-50 dark:border-brand-900/30 dark:bg-brand-950/20" :
          saldoFinalProyectado > 0 ? "border-red-200 bg-red-50 dark:border-red-900/30 dark:bg-red-950/20" : 
          "border-emerald-200 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-950/20"
        )}>
          <div className="p-6">
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Proyección de Cuenta</h3>
            
            {tipoCliente === "DIRECTORIO" && !clienteSeleccionado ? (
               <p className="mt-6 text-sm text-slate-400">Seleccioná a alguien para ver su estado actual.</p>
            ) : (
              <div className="mt-6 space-y-4">
                
                {tipoCliente === "DIRECTORIO" && (
                  <div className="flex justify-between border-b border-slate-200/50 pb-2 dark:border-slate-700/50">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Deuda Previa:</span>
                    <span className="font-mono font-bold text-slate-900 dark:text-white">{formatCurrency(saldoPrevio)}</span>
                  </div>
                )}

                {modo === "FIADO" && (
                  <div className="flex justify-between border-b border-slate-200/50 pb-2 dark:border-slate-700/50">
                    <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Nueva Venta:</span>
                    <span className="font-mono font-bold text-red-600 dark:text-red-400">+{formatCurrency(nuevoCargo)}</span>
                  </div>
                )}

                <div className="flex justify-between border-b border-slate-200/50 pb-2 dark:border-slate-700/50">
                  <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Entrega/Pago:</span>
                  <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">-{formatCurrency(pagoActual)}</span>
                </div>

                <div className="pt-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Saldo Final si confirmás:</p>
                  <p className={cn("mt-1 font-mono text-4xl font-black", saldoFinalProyectado > 0 ? "text-red-600" : "text-emerald-600")}>
                    {formatCurrency(Math.abs(saldoFinalProyectado))}
                  </p>
                  <p className={cn("text-xs font-bold uppercase", saldoFinalProyectado > 0 ? "text-red-500" : "text-emerald-500")}>
                    {saldoFinalProyectado > 0 ? "QUEDARÁ DEBIENDO" : "QUEDARÁ AL DÍA"}
                  </p>
                </div>

              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}

export default function PagosPage() {
  return (
    <AppShell currentPath="/pagos" badge="Caja Libre" title="Gestión de Transacciones" description="Cobrá deudas, registrá ventas rápidas con seña, y creá clientes al vuelo.">
      <Suspense fallback={<div className="h-32 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800"></div>}>
        <RegistroPagoForm />
      </Suspense>
    </AppShell>
  );
}