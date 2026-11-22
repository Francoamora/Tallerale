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

/** En palabras, qué cubre la plata que entra hoy. */
function explicarPago({ modo, saldoPrevio, nuevoCargo, pago }: { modo: ModoOperacion; saldoPrevio: number; nuevoCargo: number; pago: number }) {
  const deuda = Math.max(saldoPrevio, 0);
  if (modo === "COBRO") {
    if (deuda <= 0 || pago <= 0) return "";
    if (pago >= deuda) return "Cancela toda la deuda: la cuenta queda al día.";
    return `Paga ${formatCurrency(pago)} de los ${formatCurrency(deuda)} que debe. Quedan ${formatCurrency(deuda - pago)} por cobrar.`;
  }
  if (nuevoCargo <= 0) return "";
  if (pago <= 0) return `No paga nada hoy: los ${formatCurrency(nuevoCargo)} de esta venta se suman a la cuenta.`;
  if (pago < nuevoCargo) return `Paga ${formatCurrency(pago)} de esta venta. Los ${formatCurrency(nuevoCargo - pago)} restantes se suman a la cuenta.`;
  if (pago === nuevoCargo) return deuda > 0 ? `Paga esta venta completa. Lo que debía de antes (${formatCurrency(deuda)}) sigue igual.` : "Paga esta venta completa.";
  const aDeuda = Math.min(pago - nuevoCargo, deuda);
  if (aDeuda >= deuda) return `Paga esta venta y también todo lo que debía (${formatCurrency(deuda)}). La cuenta queda al día.`;
  return `Paga esta venta completa y ${formatCurrency(aDeuda)} de lo que debía. De lo anterior le quedan ${formatCurrency(deuda - aDeuda)}.`;
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
  // Lo máximo que se puede recibir: lo que debía más lo que se le vende hoy.
  const maximoPago = Math.max(saldoPrevio + nuevoCargo, 0);
  const pagoExcedido = pagoActual > maximoPago && (modo === "VENTA_CUENTA" ? nuevoCargo > 0 : true);
  const hayCliente = tipoCliente === "EXPRESS" || Boolean(clienteSeleccionado);
  const reparto = explicarPago({ modo, saldoPrevio, nuevoCargo, pago: pagoActual });

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
          <p className="mt-5 text-sm font-semibold text-emerald-600 dark:text-emerald-400">Movimiento registrado</p>
          <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950 dark:text-white">
            La cuenta de {resultado.clienteNombre} quedó actualizada
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">El movimiento ya forma parte del historial del taller.</p>
        </div>
        <div className="grid gap-3 p-6 sm:grid-cols-2">
          <div className="rounded-2xl bg-slate-100 p-4 dark:bg-slate-900">
            <p className="text-xs text-slate-500">{resultado.nuevoSaldo > 0 ? "Queda debiendo" : resultado.nuevoSaldo < 0 ? "Le queda a favor" : "Cuenta"}</p>
            <p className={cn("mt-1 font-display text-3xl font-extrabold tabular-nums", resultado.nuevoSaldo > 0 ? "text-rose-600" : "text-emerald-600")}>
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
            <button type="button" onClick={() => router.push("/caja")} className="flex-1 rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700">
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
                          <div className="flex items-center gap-4 sm:text-right">
                            <div>
                              <p className="text-xs text-slate-500">{saldoPrevio > 0 ? "Debe hoy" : saldoPrevio < 0 ? "A favor hoy" : "Hoy"}</p>
                              <p className={cn("font-display text-xl font-extrabold tabular-nums", saldoPrevio > 0 ? "text-rose-600" : saldoPrevio < 0 ? "text-sky-600" : "text-emerald-600")}>
                                {saldoPrevio === 0 ? "Al día" : formatCurrency(Math.abs(saldoPrevio))}
                              </p>
                            </div>
                            {(pagoActual > 0 || nuevoCargo > 0) && !pagoExcedido && (
                              <>
                                <span className="text-slate-300 dark:text-slate-600" aria-hidden="true">→</span>
                                <div>
                                  <p className="text-xs text-slate-500">Después de esto</p>
                                  <p className={cn("font-display text-xl font-extrabold tabular-nums", saldoFinal > 0 ? "text-rose-600" : saldoFinal < 0 ? "text-sky-600" : "text-emerald-600")}>
                                    {saldoFinal === 0 ? "Al día ✓" : formatCurrency(Math.abs(saldoFinal))}
                                  </p>
                                </div>
                              </>
                            )}
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
                      <span className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">¿Cuánto es la venta?</span>
                      <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400">$</span>
                        <input type="number" inputMode="decimal" min="0.01" step="any" value={montoTotalVenta} onChange={(event) => setMontoTotalVenta(event.target.value)} placeholder="0" className={cn(inputClass, "pl-8 text-base font-semibold tabular-nums")} />
                      </div>
                    </label>
                  )}

                  <label>
                    <span className="mb-1.5 block text-xs font-bold text-slate-600 dark:text-slate-300">{modo === "COBRO" ? "¿Cuánto paga?" : "¿Cuánto paga hoy?"}</span>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-semibold text-emerald-600">$</span>
                      <input type="number" inputMode="decimal" min="0" step="any" value={montoPagado} onChange={(event) => setMontoPagado(event.target.value)} placeholder="0" aria-invalid={pagoExcedido} className={cn(inputClass, "pl-8 text-base font-semibold tabular-nums text-emerald-700 dark:text-emerald-400", pagoExcedido ? "border-rose-400 focus:border-rose-500" : "border-emerald-500/40")} />
                    </div>
                    {hayCliente && (
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        {(modo === "COBRO"
                          ? saldoPrevio > 0
                            ? [
                                { texto: `Todo (${formatCurrency(saldoPrevio)})`, monto: saldoPrevio },
                                { texto: "La mitad", monto: Math.round(saldoPrevio / 2) },
                              ]
                            : []
                          : nuevoCargo > 0
                            ? [
                                ...(saldoPrevio > 0 ? [{ texto: `Todo lo que debe (${formatCurrency(saldoPrevio + nuevoCargo)})`, monto: saldoPrevio + nuevoCargo }] : []),
                                { texto: `Solo esta venta (${formatCurrency(nuevoCargo)})`, monto: nuevoCargo },
                                { texto: "No paga hoy", monto: 0 },
                              ]
                            : []
                        ).map((atajo) => {
                          const activo = pagoActual === atajo.monto && (atajo.monto > 0 || montoPagado !== "");
                          return (
                            <button
                              key={atajo.texto}
                              type="button"
                              onClick={() => setMontoPagado(atajo.monto > 0 ? formatAmountInput(atajo.monto) : "0")}
                              className={cn("rounded-full px-3 py-1 text-xs font-semibold transition", activo ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600")}
                            >
                              {atajo.texto}
                            </button>
                          );
                        })}
                      </span>
                    )}
                    {pagoExcedido ? (
                      <span className="mt-2 block text-xs font-medium text-rose-600 dark:text-rose-400">
                        Es más de lo que debe en total. Lo máximo que puede pagar hoy es {formatCurrency(maximoPago)}.
                      </span>
                    ) : reparto ? (
                      <span className="mt-2 block text-xs leading-relaxed text-slate-600 dark:text-slate-300">{reparto}</span>
                    ) : null}
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

                <div className="mt-5 space-y-2.5 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800">
                  <div className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-600 dark:text-slate-400">{saldoPrevio < 0 ? "Tenía a favor" : "Debía antes"}</span>
                    <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{formatCurrency(Math.abs(saldoPrevio))}</span>
                  </div>
                  {modo === "VENTA_CUENTA" && (
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Esta venta</span>
                      <span className="font-semibold tabular-nums text-rose-600">+ {formatCurrency(nuevoCargo)}</span>
                    </div>
                  )}
                  {modo === "VENTA_CUENTA" && (
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-slate-600 dark:text-slate-400">Total a pagar</span>
                      <span className="font-semibold tabular-nums text-slate-900 dark:text-slate-100">{formatCurrency(maximoPago)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-3 text-sm dark:border-slate-700">
                    <span className="text-slate-600 dark:text-slate-400">Paga hoy</span>
                    <span className="font-semibold tabular-nums text-emerald-600">− {formatCurrency(pagoActual)}</span>
                  </div>
                  <div className="pt-1">
                    <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
                      {pagoExcedido ? "Revisá el pago" : saldoFinal > 0 ? "Queda debiendo" : saldoFinal < 0 ? "Le queda a favor" : "Queda al día"}
                    </p>
                    <p className={cn("mt-0.5 font-display text-4xl font-extrabold leading-none tabular-nums", pagoExcedido ? "text-slate-400" : saldoFinal > 0 ? "text-rose-600" : saldoFinal < 0 ? "text-sky-600" : "text-emerald-600")}>
                      {saldoFinal === 0 && !pagoExcedido ? "$ 0 ✓" : formatCurrency(Math.abs(saldoFinal))}
                    </p>
                    {maximoPago > 0 && !pagoExcedido && (
                      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-rose-100 dark:bg-rose-950/40" aria-hidden="true">
                        <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${Math.min(100, (pagoActual / maximoPago) * 100)}%` }} />
                      </div>
                    )}
                    {maximoPago > 0 && !pagoExcedido && (
                      <p className="mt-1.5 text-xs text-slate-500">Paga el {Math.round(Math.min(100, (pagoActual / maximoPago) * 100))}% de lo que debe en total</p>
                    )}
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
                <button type="button" onClick={() => router.push("/caja")} className="mt-2 w-full rounded-xl px-5 py-2.5 text-xs font-bold text-slate-500 transition hover:bg-slate-200/70 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-white">
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
      currentPath="/caja"
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
