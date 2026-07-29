"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { formatCurrency } from "@/lib/format";
import { getClientes, registrarPago } from "@/lib/api";
import type { Cliente } from "@/lib/types";
import { cn } from "@/lib/utils";

type ModoOperacion = "COBRO" | "VENTA_CUENTA";
type TipoCliente = "DIRECTORIO" | "EXPRESS";
type Feedback = { tone: "idle" | "error"; message: string };

const inputClass =
  "w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-white dark:placeholder:text-slate-500";

function SearchIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m21 21-4.35-4.35m2.1-5.4a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.4" d="m5 12 4 4L19 6" />
    </svg>
  );
}

function formatAmountInput(value: number) {
  return Number.isFinite(value) && value > 0 ? String(value) : "";
}

function RegistroPagoForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedClienteId = searchParams.get("cliente");
  const comboRef = useRef<HTMLDivElement>(null);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteSeleccionado, setClienteSeleccionado] = useState<Cliente | null>(null);
  const [modo, setModo] = useState<ModoOperacion>("COBRO");
  const [tipoCliente, setTipoCliente] = useState<TipoCliente>("DIRECTORIO");
  const [busqueda, setBusqueda] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [expressNombre, setExpressNombre] = useState("");
  const [expressTelefono, setExpressTelefono] = useState("");
  const [montoTotalVenta, setMontoTotalVenta] = useState("");
  const [montoPagado, setMontoPagado] = useState("");
  const [fechaPromesa, setFechaPromesa] = useState("");
  const [metodo, setMetodo] = useState("EFECTIVO");
  const [descripcion, setDescripcion] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>({ tone: "idle", message: "" });
  const [resultado, setResultado] = useState<{ nuevoSaldo: number; clienteId?: number; clienteNombre: string } | null>(null);

  function seleccionarCliente(cliente: Cliente) {
    setClienteSeleccionado(cliente);
    setBusqueda(cliente.nombre_completo);
    setDropdownOpen(false);
    setFeedback({ tone: "idle", message: "" });
    const saldo = Number(cliente.saldo_balance);
    setMontoPagado(modo === "COBRO" && saldo > 0 ? formatAmountInput(saldo) : "");
  }

  useEffect(() => {
    let active = true;
    async function cargarDirectorio() {
      try {
        const data = await getClientes();
        if (!active) return;
        setClientes(data);
        const target = preselectedClienteId
          ? data.find((cliente) => cliente.id === Number(preselectedClienteId))
          : undefined;
        if (target) {
          setClienteSeleccionado(target);
          setBusqueda(target.nombre_completo);
          setDropdownOpen(false);
          const saldo = Number(target.saldo_balance);
          setMontoPagado(saldo > 0 ? formatAmountInput(saldo) : "");
        }
      } catch (error) {
        if (active) setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No pudimos cargar los clientes." });
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void cargarDirectorio();
    return () => {
      active = false;
    };
  }, [preselectedClienteId]);

  useEffect(() => {
    function closeOnOutsideClick(event: MouseEvent) {
      if (comboRef.current && !comboRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", closeOnOutsideClick);
    return () => document.removeEventListener("mousedown", closeOnOutsideClick);
  }, []);

  const clientesFiltrados = (busqueda.trim()
    ? clientes.filter((cliente) => {
        const query = busqueda.toLowerCase();
        return (
          cliente.nombre_completo.toLowerCase().includes(query) ||
          (cliente.dni ?? "").toLowerCase().includes(query) ||
          (cliente.telefono ?? "").includes(query)
        );
      })
    : clientes
  ).slice(0, 8);

  const saldoPrevio = clienteSeleccionado ? Number(clienteSeleccionado.saldo_balance) : 0;
  const nuevoCargo = modo === "VENTA_CUENTA" ? Number(montoTotalVenta) || 0 : 0;
  const pagoActual = Number(montoPagado) || 0;
  const saldoFinal = saldoPrevio + nuevoCargo - pagoActual;
  const identidadValida = tipoCliente === "DIRECTORIO" ? Boolean(clienteSeleccionado) : Boolean(expressNombre.trim());
  const importesValidos =
    modo === "COBRO"
      ? pagoActual > 0 && saldoPrevio > 0 && pagoActual <= saldoPrevio
      : nuevoCargo > 0 && pagoActual >= 0 && pagoActual <= saldoPrevio + nuevoCargo;
  const puedeConfirmar = identidadValida && importesValidos && !isSaving;

  function cambiarModo(next: ModoOperacion) {
    setModo(next);
    setFeedback({ tone: "idle", message: "" });
    setMontoTotalVenta("");
    setFechaPromesa("");
    if (next === "COBRO") {
      setTipoCliente("DIRECTORIO");
      setMontoPagado(saldoPrevio > 0 ? formatAmountInput(saldoPrevio) : "");
    } else {
      setMontoPagado("");
    }
  }

  function limpiarCliente() {
    setClienteSeleccionado(null);
    setBusqueda("");
    setMontoPagado("");
    setDropdownOpen(true);
  }

  function usarImporte(percentage: number) {
    setMontoPagado(formatAmountInput(Math.round(saldoPrevio * percentage * 100) / 100));
  }

  async function procesarTransaccion(event: React.FormEvent) {
    event.preventDefault();
    setFeedback({ tone: "idle", message: "" });

    if (!identidadValida) {
      setFeedback({ tone: "error", message: tipoCliente === "DIRECTORIO" ? "Seleccioná un cliente para continuar." : "Ingresá el nombre del cliente." });
      return;
    }
    if (modo === "COBRO" && saldoPrevio <= 0) {
      setFeedback({ tone: "error", message: "Este cliente no tiene deuda pendiente para cobrar." });
      return;
    }
    if (modo === "COBRO" && pagoActual > saldoPrevio) {
      setFeedback({ tone: "error", message: "El cobro no puede superar la deuda actual." });
      return;
    }
    if (modo === "VENTA_CUENTA" && nuevoCargo <= 0) {
      setFeedback({ tone: "error", message: "Ingresá el total de la venta." });
      return;
    }
    if (pagoActual < 0 || pagoActual > saldoPrevio + nuevoCargo) {
      setFeedback({ tone: "error", message: "Revisá el pago inicial: supera el saldo total de la cuenta." });
      return;
    }

    setIsSaving(true);
    try {
      const response = await registrarPago({
        cliente_id: tipoCliente === "DIRECTORIO" ? clienteSeleccionado?.id : undefined,
        cliente_express: tipoCliente === "EXPRESS"
          ? { nombre: expressNombre.trim(), telefono: expressTelefono.trim() }
          : undefined,
        monto_total_venta: nuevoCargo,
        monto_pagado: pagoActual,
        metodo_pago: metodo,
        descripcion: descripcion.trim(),
        fecha_promesa: fechaPromesa || undefined,
      });
      setResultado({
        nuevoSaldo: Number(response.nuevo_saldo),
        clienteId: clienteSeleccionado?.id,
        clienteNombre: clienteSeleccionado?.nombre_completo ?? expressNombre.trim(),
      });
    } catch (error) {
      setFeedback({ tone: "error", message: error instanceof Error ? error.message : "No pudimos registrar el movimiento." });
    } finally {
      setIsSaving(false);
    }
  }

  if (resultado) {
    return (
      <section className="mx-auto max-w-2xl overflow-hidden rounded-3xl border border-emerald-500/25 bg-white shadow-xl shadow-emerald-950/5 dark:bg-slate-800">
        <div className="border-b border-slate-200 p-7 text-center dark:border-slate-700 sm:p-9">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500 text-white shadow-lg shadow-emerald-500/20">
            <CheckIcon />
          </div>
          <p className="mt-5 text-xs font-bold uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400">Movimiento registrado</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white">
            La cuenta de {resultado.clienteNombre} quedó actualizada
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">El movimiento ya forma parte del historial del taller.</p>
        </div>
        <div className="grid gap-3 p-6 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-100 p-4 dark:bg-slate-900">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Nuevo saldo</p>
            <p className={cn("mt-1 font-mono text-2xl font-black", resultado.nuevoSaldo > 0 ? "text-rose-500" : "text-emerald-500")}>
              {formatCurrency(Math.abs(resultado.nuevoSaldo))}
            </p>
            <p className="text-xs font-semibold text-slate-500">
              {resultado.nuevoSaldo > 0 ? "Pendiente de cobro" : resultado.nuevoSaldo < 0 ? "A favor del cliente" : "Cuenta al día"}
            </p>
          </div>
          <div className="flex flex-col gap-2">
            {resultado.clienteId && (
              <button type="button" onClick={() => router.push(`/clientes/${resultado.clienteId}`)} className="flex-1 rounded-xl bg-brand-600 px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-500">
                Ver cuenta del cliente
              </button>
            )}
            <button type="button" onClick={() => router.push("/pagos")} className="flex-1 rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700">
              Volver a Caja
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={procesarTransaccion} className="mx-auto max-w-6xl">
      <fieldset disabled={isSaving} className="space-y-4">
        <legend className="sr-only">Tipo de movimiento</legend>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => cambiarModo("COBRO")}
            className={cn(
              "group rounded-2xl border p-4 text-left transition",
              modo === "COBRO"
                ? "border-emerald-500 bg-emerald-500/10 ring-4 ring-emerald-500/10"
                : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600",
            )}
          >
            <span className="flex items-center gap-3">
              <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl text-base font-black", modo === "COBRO" ? "bg-emerald-500 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300")}>$</span>
              <span>
                <span className="block text-sm font-black text-slate-950 dark:text-white">Cobrar saldo</span>
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">Registrar un pago sobre una deuda existente.</span>
              </span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => cambiarModo("VENTA_CUENTA")}
            className={cn(
              "group rounded-2xl border p-4 text-left transition",
              modo === "VENTA_CUENTA"
                ? "border-brand-500 bg-brand-500/10 ring-4 ring-brand-500/10"
                : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-slate-600",
            )}
          >
            <span className="flex items-center gap-3">
              <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl text-lg font-black", modo === "VENTA_CUENTA" ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300")}>+</span>
              <span>
                <span className="block text-sm font-black text-slate-950 dark:text-white">Venta a cuenta</span>
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">Crear un cargo y registrar el pago inicial.</span>
              </span>
            </span>
          </button>
        </div>

        {feedback.message && (
          <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-semibold text-rose-700 dark:text-rose-300">
            <span aria-hidden="true">!</span>
            <span>{feedback.message}</span>
          </div>
        )}

        <div className="overflow-visible rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="grid xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="divide-y divide-slate-200 dark:divide-slate-700">
              <section className="p-5 sm:p-6">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-black text-white">1</span>
                    <div>
                      <h2 className="text-base font-black text-slate-950 dark:text-white">Cliente</h2>
                      <p className="text-xs text-slate-500 dark:text-slate-400">Elegí sobre qué cuenta registrar el movimiento.</p>
                    </div>
                  </div>
                  {modo === "VENTA_CUENTA" && (
                    <button
                      type="button"
                      onClick={() => {
                        setTipoCliente((current) => current === "DIRECTORIO" ? "EXPRESS" : "DIRECTORIO");
                        setClienteSeleccionado(null);
                        setBusqueda("");
                        setMontoPagado("");
                      }}
                      className="text-xs font-bold text-brand-600 hover:text-brand-500 dark:text-brand-500"
                    >
                      {tipoCliente === "DIRECTORIO" ? "Nuevo cliente rápido" : "Buscar cliente existente"}
                    </button>
                  )}
                </div>

                <div className="mt-4">
                  {tipoCliente === "DIRECTORIO" ? (
                    <div ref={comboRef} className="relative">
                      <div className="relative">
                        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"><SearchIcon /></span>
                        <input
                          type="text"
                          value={busqueda}
                          disabled={isLoading}
                          onFocus={() => setDropdownOpen(true)}
                          onChange={(event) => {
                            setBusqueda(event.target.value);
                            setClienteSeleccionado(null);
                            setMontoPagado("");
                            setDropdownOpen(true);
                          }}
                          placeholder={isLoading ? "Cargando clientes…" : "Buscar por nombre, DNI o teléfono"}
                          className={cn(inputClass, "pl-11 pr-11")}
                          aria-label="Buscar cliente"
                        />
                        {clienteSeleccionado && (
                          <button type="button" onClick={limpiarCliente} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-700 dark:hover:text-white" aria-label="Cambiar cliente">×</button>
                        )}
                      </div>

                      {dropdownOpen && !clienteSeleccionado && (
                        <div className="absolute z-50 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
                          {clientesFiltrados.length ? (
                            <ul className="max-h-64 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
                              {clientesFiltrados.map((cliente) => (
                                <li key={cliente.id}>
                                  <button type="button" onMouseDown={() => seleccionarCliente(cliente)} className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800">
                                    <span>
                                      <span className="block text-sm font-bold text-slate-900 dark:text-white">{cliente.nombre_completo}</span>
                                      <span className="block text-xs text-slate-500">{cliente.dni ? `DNI ${cliente.dni}` : "Sin DNI"}{cliente.telefono ? ` · ${cliente.telefono}` : ""}</span>
                                    </span>
                                    <span className={cn("shrink-0 text-xs font-bold", Number(cliente.saldo_balance) > 0 ? "text-rose-500" : "text-emerald-500")}>
                                      {Number(cliente.saldo_balance) > 0 ? `Debe ${formatCurrency(Number(cliente.saldo_balance))}` : "Al día"}
                                    </span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="px-4 py-7 text-center text-sm text-slate-500">No encontramos clientes con esa búsqueda.</p>
                          )}
                        </div>
                      )}

                      {clienteSeleccionado && (
                        <div className="mt-3 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-700 dark:bg-slate-900 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-600 text-sm font-black text-white">
                              {clienteSeleccionado.nombre_completo.charAt(0).toUpperCase()}
                            </span>
                            <span>
                              <span className="block text-sm font-black text-slate-950 dark:text-white">{clienteSeleccionado.nombre_completo}</span>
                              <span className="block text-xs text-slate-500">{clienteSeleccionado.telefono || clienteSeleccionado.dni || "Sin datos de contacto"}</span>
                            </span>
                          </div>
                          <div className="sm:text-right">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Saldo actual</p>
                            <p className={cn("font-mono text-lg font-black", saldoPrevio > 0 ? "text-rose-500" : saldoPrevio < 0 ? "text-sky-500" : "text-emerald-500")}>
                              {formatCurrency(Math.abs(saldoPrevio))}
                            </p>
                            <p className="text-[11px] font-semibold text-slate-500">{saldoPrevio > 0 ? "Debe" : saldoPrevio < 0 ? "A favor" : "Al día"}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label>
                        <span className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">Nombre completo</span>
                        <input value={expressNombre} onChange={(event) => setExpressNombre(event.target.value)} placeholder="Ej. Carlos Gómez" className={inputClass} />
                      </label>
                      <label>
                        <span className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">Teléfono <span className="font-normal text-slate-400">(opcional)</span></span>
                        <input value={expressTelefono} onChange={(event) => setExpressTelefono(event.target.value)} placeholder="Ej. 351 555 0123" className={inputClass} />
                      </label>
                    </div>
                  )}
                </div>
              </section>

              <section className="p-5 sm:p-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-black text-white">2</span>
                  <div>
                    <h2 className="text-base font-black text-slate-950 dark:text-white">Datos del movimiento</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{modo === "COBRO" ? "Indicá cuánto pagó y cómo lo recibiste." : "Cargá el valor de la venta y el pago recibido hoy."}</p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {modo === "VENTA_CUENTA" && (
                    <label>
                      <span className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">Total de la venta</span>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-sm font-black text-slate-400">$</span>
                        <input type="number" min="0.01" step="0.01" value={montoTotalVenta} onChange={(event) => setMontoTotalVenta(event.target.value)} placeholder="0" className={cn(inputClass, "pl-8 font-mono text-base font-black")} />
                      </div>
                    </label>
                  )}

                  <label>
                    <span className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">{modo === "COBRO" ? "Importe recibido" : "Pago inicial recibido"}</span>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 font-mono text-sm font-black text-emerald-500">$</span>
                      <input type="number" min="0" step="0.01" value={montoPagado} onChange={(event) => setMontoPagado(event.target.value)} placeholder="0" className={cn(inputClass, "border-emerald-500/40 pl-8 font-mono text-base font-black text-emerald-600 dark:text-emerald-400")} />
                    </div>
                    {modo === "COBRO" && saldoPrevio > 0 && (
                      <span className="mt-2 flex flex-wrap gap-2">
                        <button type="button" onClick={() => usarImporte(1)} className="rounded-full bg-emerald-500/10 px-3 py-1 text-[11px] font-bold text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-400">Saldo completo</button>
                        <button type="button" onClick={() => usarImporte(0.5)} className="rounded-full bg-slate-100 px-3 py-1 text-[11px] font-bold text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600">50%</button>
                      </span>
                    )}
                  </label>

                  <label>
                    <span className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">Medio de pago</span>
                    <select value={metodo} onChange={(event) => setMetodo(event.target.value)} className={inputClass}>
                      <option value="EFECTIVO">Efectivo</option>
                      <option value="TRANSFERENCIA">Transferencia</option>
                      <option value="TARJETA">Tarjeta</option>
                      <option value="CHEQUE">Cheque</option>
                    </select>
                  </label>

                  {modo === "VENTA_CUENTA" && (
                    <label>
                      <span className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">Fecha prometida <span className="font-normal text-slate-400">(opcional)</span></span>
                      <input type="date" value={fechaPromesa} onChange={(event) => setFechaPromesa(event.target.value)} className={cn(inputClass, "[color-scheme:light] dark:[color-scheme:dark]")} />
                    </label>
                  )}

                  <label className={cn(modo === "COBRO" ? "sm:col-span-2" : "")}>
                    <span className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">Concepto <span className="font-normal text-slate-400">(opcional)</span></span>
                    <input value={descripcion} onChange={(event) => setDescripcion(event.target.value)} placeholder={modo === "COBRO" ? "Ej. Abono de reparación" : "Ej. Venta de cuatro cubiertas"} className={inputClass} />
                  </label>
                </div>
              </section>
            </div>

            <aside className="border-t border-slate-200 bg-slate-50 p-5 dark:border-slate-700 dark:bg-slate-900/60 sm:p-6 xl:border-l xl:border-t-0">
              <div className="xl:sticky xl:top-6">
                <div className="flex items-center gap-3">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-black text-white">3</span>
                  <div>
                    <h2 className="text-base font-black text-slate-950 dark:text-white">Revisar y confirmar</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Así quedará la cuenta.</p>
                  </div>
                </div>

                <div className="mt-5 space-y-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-500">Saldo anterior</span>
                    <span className="font-mono font-bold text-slate-800 dark:text-slate-200">{formatCurrency(saldoPrevio)}</span>
                  </div>
                  {modo === "VENTA_CUENTA" && (
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-500">Nueva venta</span>
                      <span className="font-mono font-bold text-rose-500">+ {formatCurrency(nuevoCargo)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3 text-sm dark:border-slate-700">
                    <span className="text-slate-500">Pago recibido</span>
                    <span className="font-mono font-bold text-emerald-500">− {formatCurrency(pagoActual)}</span>
                  </div>
                  <div className="pt-1">
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500">Saldo resultante</p>
                    <p className={cn("mt-1 font-mono text-3xl font-black", saldoFinal > 0 ? "text-rose-500" : saldoFinal < 0 ? "text-sky-500" : "text-emerald-500")}>
                      {formatCurrency(Math.abs(saldoFinal))}
                    </p>
                    <p className={cn("mt-1 text-xs font-bold", saldoFinal > 0 ? "text-rose-500" : saldoFinal < 0 ? "text-sky-500" : "text-emerald-500")}>
                      {saldoFinal > 0 ? "Quedará pendiente de cobro" : saldoFinal < 0 ? "Quedará a favor del cliente" : "La cuenta quedará al día"}
                    </p>
                  </div>
                </div>

                {!clienteSeleccionado && tipoCliente === "DIRECTORIO" && (
                  <p className="mt-3 rounded-xl bg-slate-200/60 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">Seleccioná un cliente para calcular el saldo final.</p>
                )}
                {clienteSeleccionado && modo === "COBRO" && saldoPrevio <= 0 && (
                  <p className="mt-3 rounded-xl bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-700 dark:text-emerald-400">Este cliente ya está al día. Podés registrar una venta a cuenta si corresponde.</p>
                )}

                <button
                  type="submit"
                  disabled={!puedeConfirmar}
                  className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-5 py-3.5 text-sm font-black text-white shadow-lg shadow-brand-600/20 transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:text-slate-500 disabled:shadow-none dark:disabled:bg-slate-700 dark:disabled:text-slate-500"
                >
                  {isSaving ? "Registrando…" : modo === "COBRO" ? "Confirmar cobro" : "Confirmar venta"}
                  {!isSaving && <span aria-hidden="true">→</span>}
                </button>
                <button type="button" onClick={() => router.push("/pagos")} className="mt-2 w-full rounded-xl px-5 py-2.5 text-xs font-bold text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-white">
                  Cancelar y volver a Caja
                </button>
                <p className="mt-3 text-center text-[11px] leading-4 text-slate-400">Al confirmar, el movimiento se guardará en el historial del cliente y de Caja.</p>
              </div>
            </aside>
          </div>
        </div>
      </fieldset>
    </form>
  );
}

export default function PagosPage() {
  return (
    <AppShell
      currentPath="/pagos"
      badge="Caja"
      title="Registrar movimiento"
      description="Cobrá un saldo o registrá una venta a cuenta con su pago inicial."
    >
      <Suspense fallback={<div className="mx-auto h-96 max-w-6xl animate-pulse rounded-3xl bg-slate-200 dark:bg-slate-800" />}>
        <RegistroPagoForm />
      </Suspense>
    </AppShell>
  );
}
