"use client";

import { Suspense, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CampoDescuento, montoDescuento, type ModoDescuento } from "@/components/campo-descuento";
import { crearPresupuesto, editarPresupuesto, getClientes, getPresupuestoById, getVehiculoById, getVehiculosPorCliente } from "@/lib/api";
import { numeroPresupuesto } from "@/lib/documentos";
import { formatCurrency } from "@/lib/format";
import type { Cliente, PresupuestoItem, Vehiculo } from "@/lib/types";
import { cn } from "@/lib/utils";

// ─── Tipos y ayudas ──────────────────────────────────────────

type TipoItem = "MANO_OBRA" | "REPUESTO" | "INSUMO" | "OTRO";
type ItemDraft = { id: number; tipo: TipoItem; descripcion: string; cantidad: string; precio_unitario: string };
type ExpressState = { clienteNombre: string; clienteTelefono: string; vehiculoPatente: string; vehiculoMarca: string };

const INITIAL_EXPRESS: ExpressState = { clienteNombre: "", clienteTelefono: "", vehiculoPatente: "", vehiculoMarca: "" };
const VALIDEZ_DIAS = 15;

const TIPOS: { value: TipoItem; label: string; agregar: string }[] = [
  { value: "MANO_OBRA", label: "Mano de obra", agregar: "Mano de obra" },
  { value: "REPUESTO", label: "Repuesto", agregar: "Repuesto" },
  { value: "INSUMO", label: "Insumo", agregar: "Insumo" },
  { value: "OTRO", label: "Otro", agregar: "Otro" },
];

const ESTADOS = [
  { value: "BORRADOR", label: "Borrador" },
  { value: "ENVIADO", label: "Esperando respuesta" },
  { value: "APROBADO", label: "Aprobado" },
  { value: "RECHAZADO", label: "Rechazado" },
];

function createItem(id: number, tipo: TipoItem = "MANO_OBRA"): ItemDraft {
  return { id, tipo, descripcion: "", cantidad: "1", precio_unitario: "" };
}

function normalizeItemType(tipo: string): TipoItem {
  return ["MANO_OBRA", "REPUESTO", "INSUMO", "OTRO"].includes(tipo) ? (tipo as TipoItem) : "MANO_OBRA";
}

function parseAmount(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Una fila sin descripción ni precio es una fila vacía: no se guarda. */
const filaVacia = (item: ItemDraft) => !item.descripcion.trim() && parseAmount(item.precio_unitario) === 0;

const input =
  "h-10 w-full rounded-xl border border-slate-200 bg-white px-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-white";
/** Sin las flechitas del navegador en los campos de números. */
const sinFlechas = "[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
const etiqueta = "mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300";
const tarjeta = "rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800";

// ─── Formulario ──────────────────────────────────────────────

function FormularioPresupuesto() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  const vehiculoPreId = searchParams.get("vehiculo");

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [cargandoVehiculos, setCargandoVehiculos] = useState(false);
  const [clienteId, setClienteId] = useState("");
  const [vehiculoId, setVehiculoId] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [resaltado, setResaltado] = useState(0);
  const comboRef = useRef<HTMLDivElement>(null);

  const [resumen, setResumen] = useState("");
  const [descuento, setDescuento] = useState("");
  // Arranca en porcentaje; un presupuesto guardado se reabre con su monto en pesos.
  const [modoDescuento, setModoDescuento] = useState<ModoDescuento>("%");
  const [estado, setEstado] = useState("BORRADOR");
  const [items, setItems] = useState<ItemDraft[]>([createItem(1)]);
  const [nextItemId, setNextItemId] = useState(2);
  const [enfocarId, setEnfocarId] = useState<number | null>(null);

  const [modoCliente, setModoCliente] = useState<"DIRECTORIO" | "EXPRESS">("DIRECTORIO");
  const [express, setExpress] = useState<ExpressState>(INITIAL_EXPRESS);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRedirecting, startRedirect] = useTransition();
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        setIsLoading(true);
        const clientesData = await getClientes();
        if (active) setClientes(clientesData);

        if (vehiculoPreId && active) {
          const vehiculo = await getVehiculoById(Number(vehiculoPreId));
          const delTitular = await getVehiculosPorCliente(vehiculo.cliente_id);
          if (!active) return;
          setClienteId(String(vehiculo.cliente_id));
          setVehiculoId(String(vehiculo.id));
          setBusqueda(vehiculo.cliente_nombre);
          setVehiculos(delTitular);
        }

        if (editId && active) {
          if (Number.isNaN(Number(editId))) return setError("El número de presupuesto no es válido.");
          try {
            const p = await getPresupuestoById(Number(editId));
            const cid = p.cliente?.id ? String(p.cliente.id) : "";
            setClienteId(cid);
            setVehiculoId(p.vehiculo?.id ? String(p.vehiculo.id) : "");
            setResumen(p.resumen_corto || "");
            setDescuento(p.descuento ? String(p.descuento) : "");
            if (p.descuento) setModoDescuento("$");
            setEstado(p.estado || "BORRADOR");
            if (cid) {
              const delCliente = await getVehiculosPorCliente(Number(cid));
              if (active) setVehiculos(delCliente);
            }
            if (p.items?.length) {
              setItems(p.items.map((i: PresupuestoItem, idx: number) => ({
                id: idx + 1,
                tipo: normalizeItemType(i.tipo),
                descripcion: i.descripcion || "",
                cantidad: i.cantidad?.toString() || "1",
                precio_unitario: i.precio_unitario?.toString() || "",
              })));
              setNextItemId(p.items.length + 1);
            }
          } catch {
            setError("El presupuesto que intentás abrir no existe o fue eliminado.");
          }
        }
      } catch {
        if (active) setError("No pudimos cargar los clientes. Probá recargar la página.");
      } finally {
        if (active) setIsLoading(false);
      }
    }
    init();
    return () => { active = false; };
  }, [editId, vehiculoPreId]);

  // Cerrar la lista de clientes al hacer click afuera.
  useEffect(() => {
    function fuera(e: MouseEvent) {
      if (comboRef.current && !comboRef.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  // Al agregar una fila, el cursor va directo a su descripción.
  useEffect(() => {
    if (enfocarId === null) return;
    document.getElementById(`item-desc-${enfocarId}`)?.focus();
  }, [enfocarId]);

  const clienteActual = clientes.find((c) => c.id === Number(clienteId)) ?? null;
  const q = busqueda.trim().toLowerCase();
  const sugeridos = q
    ? clientes.filter((c) => c.nombre_completo.toLowerCase().includes(q) || (c.telefono ?? "").includes(q) || (c.dni ?? "").toLowerCase().includes(q)).slice(0, 8)
    : clientes.slice(0, 8);
  const vehiculosDelCliente = vehiculos.filter((v) => v.cliente_id === Number(clienteId));

  const manoObra = items.reduce((t, i) => (i.tipo === "MANO_OBRA" ? t + parseAmount(i.cantidad) * parseAmount(i.precio_unitario) : t), 0);
  const materiales = items.reduce((t, i) => (i.tipo !== "MANO_OBRA" ? t + parseAmount(i.cantidad) * parseAmount(i.precio_unitario) : t), 0);
  const subtotal = manoObra + materiales;
  const montoDesc = montoDescuento(modoDescuento, descuento, subtotal);
  const total = Math.max(subtotal - montoDesc, 0);

  async function elegirCliente(c: Cliente) {
    setClienteId(String(c.id));
    setBusqueda(c.nombre_completo);
    setAbierto(false);
    setVehiculoId("");
    setVehiculos([]);
    setCargandoVehiculos(true);
    try {
      const vs = await getVehiculosPorCliente(c.id);
      setVehiculos(vs);
      // Si tiene un solo auto, ya queda elegido.
      if (vs.length === 1) setVehiculoId(String(vs[0].id));
    } finally {
      setCargandoVehiculos(false);
    }
  }

  function limpiarCliente() {
    setClienteId("");
    setVehiculoId("");
    setVehiculos([]);
    setBusqueda("");
    setAbierto(true);
    window.setTimeout(() => document.getElementById("buscar-cliente")?.focus(), 0);
  }

  function teclaBusqueda(e: React.KeyboardEvent<HTMLInputElement>) {
    if (!sugeridos.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setAbierto(true); setResaltado((r) => Math.min(r + 1, sugeridos.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setResaltado((r) => Math.max(r - 1, 0)); }
    else if (e.key === "Enter" && abierto) { e.preventDefault(); void elegirCliente(sugeridos[resaltado] ?? sugeridos[0]); }
    else if (e.key === "Escape") setAbierto(false);
  }

  function updateItem(itemId: number, key: keyof Omit<ItemDraft, "id">, value: string) {
    setItems((curr) => curr.map((item) => (item.id === itemId ? { ...item, [key]: value } : item)));
  }

  function agregarItem(tipo: TipoItem) {
    const nuevoId = nextItemId;
    setItems((curr) => [...curr, createItem(nuevoId, tipo)]);
    setNextItemId(nuevoId + 1);
    setEnfocarId(nuevoId);
  }

  function quitarItem(itemId: number) {
    setItems((curr) => (curr.length > 1 ? curr.filter((item) => item.id !== itemId) : [createItem(nextItemId)]));
    if (items.length === 1) setNextItemId((n) => n + 1);
  }

  async function guardar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const cargados = items.filter((i) => !filaVacia(i));

    if (!editId && modoCliente === "DIRECTORIO" && !clienteId) return setError("Elegí para qué cliente es el presupuesto.");
    if (!editId && modoCliente === "DIRECTORIO" && !vehiculoId) return setError("Elegí el vehículo del cliente.");
    if (!editId && modoCliente === "EXPRESS" && (!express.clienteNombre.trim() || !express.vehiculoPatente.trim() || !express.vehiculoMarca.trim())) {
      return setError("Completá nombre del cliente, patente y vehículo.");
    }
    if (!cargados.length) return setError("Agregá al menos un trabajo o repuesto.");
    if (cargados.some((i) => !i.descripcion.trim())) return setError("Hay una fila con precio pero sin descripción.");

    setIsSaving(true);
    try {
      const desdeDirectorio = modoCliente === "DIRECTORIO" || Boolean(editId);
      const payload = {
        cliente_id: desdeDirectorio ? Number(clienteId) : undefined,
        vehiculo_id: desdeDirectorio ? Number(vehiculoId) : undefined,
        cliente_express: !desdeDirectorio ? { nombre: express.clienteNombre.trim(), telefono: express.clienteTelefono.trim() } : undefined,
        vehiculo_express: !desdeDirectorio ? { patente: express.vehiculoPatente.trim().toUpperCase(), marca: express.vehiculoMarca.trim() } : undefined,
        resumen_corto: resumen.trim(),
        estado,
        descuento: montoDesc,
        items: cargados.map((i) => ({
          tipo: i.tipo,
          descripcion: i.descripcion.trim(),
          cantidad: parseAmount(i.cantidad) || 1,
          precio_unitario: parseAmount(i.precio_unitario),
        })),
      };
      const guardado = editId ? await editarPresupuesto(Number(editId), payload) : await crearPresupuesto(payload);
      // Al terminar se abre el presupuesto, listo para mandárselo al cliente.
      startRedirect(() => router.push(guardado?.id ? `/presupuestos/${guardado.id}` : "/presupuestos"));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No pudimos guardar el presupuesto.");
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="h-96 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
      </div>
    );
  }

  const guardando = isSaving || isRedirecting;
  const textoGuardar = guardando ? "Guardando…" : editId ? "Guardar cambios" : "Crear presupuesto";

  return (
    <form onSubmit={guardar} className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0 space-y-4">
        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        )}

        {/* 1. Cliente y vehículo */}
        <section className={tarjeta}>
          <header className="flex flex-col gap-3 px-5 pt-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">¿Para quién es?</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">{editId ? "El cliente de un presupuesto no se puede cambiar." : "Buscalo en tus clientes o cargá uno nuevo."}</p>
            </div>
            {!editId && (
              <div className="flex shrink-0 rounded-xl bg-slate-100 p-1 dark:bg-slate-900" role="tablist">
                {([["DIRECTORIO", "Ya es cliente"], ["EXPRESS", "Cliente nuevo"]] as const).map(([valor, texto]) => (
                  <button
                    key={valor}
                    type="button"
                    role="tab"
                    aria-selected={modoCliente === valor}
                    onClick={() => setModoCliente(valor)}
                    className={cn("h-8 rounded-lg px-3.5 text-sm font-semibold transition", modoCliente === valor ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400")}
                  >
                    {texto}
                  </button>
                ))}
              </div>
            )}
          </header>

          <div className="px-5 pb-5 pt-4 sm:px-6">
            {modoCliente === "DIRECTORIO" || editId ? (
              <div className="space-y-4">
                {clienteActual ? (
                  <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-900/50">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">
                      {clienteActual.nombre_completo.charAt(0)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-slate-900 dark:text-white">{clienteActual.nombre_completo}</p>
                      <p className="truncate text-xs text-slate-500 dark:text-slate-400">{clienteActual.telefono || "Sin teléfono cargado"}</p>
                    </div>
                    {!editId && (
                      <button type="button" onClick={limpiarCliente} className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/30">
                        Cambiar
                      </button>
                    )}
                  </div>
                ) : (
                  <div ref={comboRef} className="relative">
                    <label htmlFor="buscar-cliente" className={etiqueta}>Cliente</label>
                    <div className="relative">
                      <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" /></svg>
                      <input
                        id="buscar-cliente"
                        type="text"
                        autoComplete="off"
                        placeholder="Escribí el nombre o el teléfono…"
                        value={busqueda}
                        onChange={(e) => { setBusqueda(e.target.value); setAbierto(true); setResaltado(0); }}
                        onFocus={() => setAbierto(true)}
                        onKeyDown={teclaBusqueda}
                        role="combobox"
                        aria-expanded={abierto}
                        aria-controls="lista-clientes"
                        className={cn(input, "pl-10")}
                      />
                    </div>
                    {abierto && (
                      <div id="lista-clientes" role="listbox" className="absolute inset-x-0 top-full z-40 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                        {sugeridos.length === 0 ? (
                          <div className="px-4 py-5 text-center">
                            <p className="text-sm text-slate-500">No encontramos a &quot;{busqueda}&quot;.</p>
                            <button
                              type="button"
                              onClick={() => { setModoCliente("EXPRESS"); setExpress((e) => ({ ...e, clienteNombre: busqueda })); setAbierto(false); }}
                              className="mt-2 text-sm font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-300"
                            >
                              Cargarlo como cliente nuevo →
                            </button>
                          </div>
                        ) : (
                          <ul className="max-h-72 overflow-y-auto py-1">
                            {!q && <li className="px-4 pb-1 pt-2 text-xs text-slate-400">Tus clientes</li>}
                            {sugeridos.map((c, i) => (
                              <li key={c.id}>
                                <button
                                  type="button"
                                  role="option"
                                  aria-selected={i === resaltado}
                                  onMouseEnter={() => setResaltado(i)}
                                  onMouseDown={(e) => { e.preventDefault(); void elegirCliente(c); }}
                                  className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left transition", i === resaltado ? "bg-slate-50 dark:bg-slate-800" : "")}
                                >
                                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                                    {c.nombre_completo.charAt(0)}
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{c.nombre_completo}</span>
                                    {c.telefono && <span className="block truncate text-xs text-slate-500">{c.telefono}</span>}
                                  </span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {clienteActual && (
                  <div>
                    <p className={etiqueta}>Vehículo</p>
                    {cargandoVehiculos ? (
                      <div className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-700/50" />
                    ) : vehiculosDelCliente.length === 0 ? (
                      <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                        Este cliente no tiene vehículos cargados. Agregalo desde su ficha o cargalo como cliente nuevo.
                      </p>
                    ) : (
                      <div className="grid gap-2 sm:grid-cols-2">
                        {vehiculosDelCliente.map((v) => {
                          const elegido = String(v.id) === vehiculoId;
                          return (
                            <button
                              key={v.id}
                              type="button"
                              disabled={Boolean(editId)}
                              onClick={() => setVehiculoId(String(v.id))}
                              aria-pressed={elegido}
                              className={cn(
                                "flex items-center gap-3 rounded-xl px-4 py-3 text-left ring-1 ring-inset transition disabled:cursor-default",
                                elegido ? "bg-brand-50 ring-2 ring-brand-500 dark:bg-brand-950/30" : "ring-slate-200 hover:bg-slate-50 dark:ring-slate-700 dark:hover:bg-slate-700/30",
                              )}
                            >
                              <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded-full ring-2 ring-inset", elegido ? "bg-brand-600 ring-brand-600" : "ring-slate-300 dark:ring-slate-600")}>
                                {elegido && <span className="h-2 w-2 rounded-full bg-white" />}
                              </span>
                              <span className="min-w-0">
                                <span className="block truncate text-sm font-semibold text-slate-900 dark:text-white">{v.marca} {v.modelo}{v.anio ? ` ${v.anio}` : ""}</span>
                                <span className="block truncate text-xs uppercase tracking-wide text-slate-500">{v.patente}</span>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="ex-nombre" className={etiqueta}>Nombre y apellido</label>
                  <input id="ex-nombre" autoFocus type="text" placeholder="Ej: Juan Pérez" value={express.clienteNombre} onChange={(e) => setExpress((x) => ({ ...x, clienteNombre: e.target.value }))} className={input} />
                </div>
                <div>
                  <label htmlFor="ex-tel" className={etiqueta}>Celular <span className="font-normal text-slate-400">(para mandarle el presupuesto)</span></label>
                  <input id="ex-tel" type="tel" placeholder="Ej: 342 555 1234" value={express.clienteTelefono} onChange={(e) => setExpress((x) => ({ ...x, clienteTelefono: e.target.value }))} className={input} />
                </div>
                <div>
                  <label htmlFor="ex-patente" className={etiqueta}>Patente</label>
                  <input id="ex-patente" type="text" placeholder="Ej: AB123CD" value={express.vehiculoPatente} onChange={(e) => setExpress((x) => ({ ...x, vehiculoPatente: e.target.value.toUpperCase() }))} className={cn(input, "uppercase tracking-wide")} />
                </div>
                <div>
                  <label htmlFor="ex-auto" className={etiqueta}>Vehículo</label>
                  <input id="ex-auto" type="text" placeholder="Ej: VW Gol 2015" value={express.vehiculoMarca} onChange={(e) => setExpress((x) => ({ ...x, vehiculoMarca: e.target.value }))} className={input} />
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 2. Qué se cotiza */}
        <section className={tarjeta}>
          <header className="px-5 pt-5 sm:px-6">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">¿Qué hay que hacerle?</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400">El título lo ve el cliente arriba de todo. Abajo, cada trabajo y repuesto con su precio.</p>
          </header>
          <div className="px-5 pt-4 sm:px-6">
            <label htmlFor="resumen" className={etiqueta}>Título del presupuesto</label>
            <input id="resumen" type="text" placeholder="Ej: Cambio de kit de distribución" value={resumen} onChange={(e) => setResumen(e.target.value)} className={input} />
          </div>

          <div className="mt-5 border-t border-slate-100 dark:border-slate-700">
            <div className="hidden grid-cols-[140px_minmax(0,1fr)_72px_130px_110px_36px] gap-2 px-6 pb-1 pt-3 text-xs font-medium text-slate-500 dark:text-slate-400 md:grid">
              <span>Tipo</span>
              <span>Descripción</span>
              <span>Cant.</span>
              <span>Precio unit.</span>
              <span className="text-right">Subtotal</span>
              <span />
            </div>
            <ul className="divide-y divide-slate-100 dark:divide-slate-700/70 md:divide-y-0">
              {items.map((item) => {
                const sub = parseAmount(item.cantidad) * parseAmount(item.precio_unitario);
                return (
                  <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_36px] gap-2 px-5 py-3 sm:px-6 md:grid-cols-[140px_minmax(0,1fr)_72px_130px_110px_36px] md:items-center md:py-1.5">
                    <select
                      aria-label="Tipo"
                      value={item.tipo}
                      onChange={(e) => updateItem(item.id, "tipo", e.target.value)}
                      className={cn(input, "col-span-1 h-9 px-2.5 text-sm md:col-auto")}
                    >
                      {TIPOS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <button type="button" onClick={() => quitarItem(item.id)} aria-label="Quitar fila" title="Quitar fila" className="row-start-1 col-start-2 flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 md:col-start-6">
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" /></svg>
                    </button>
                    <input
                      id={`item-desc-${item.id}`}
                      aria-label="Descripción"
                      type="text"
                      placeholder={item.tipo === "MANO_OBRA" ? "Ej: Cambio de pastillas de freno" : "Ej: Juego de pastillas delanteras"}
                      value={item.descripcion}
                      onChange={(e) => updateItem(item.id, "descripcion", e.target.value)}
                      className={cn(input, "col-span-2 h-9 md:col-span-1 md:col-start-2 md:row-start-1")}
                    />
                    <div className="col-span-2 grid grid-cols-[72px_minmax(0,1fr)_auto] items-center gap-2 md:contents">
                      <input
                        aria-label="Cantidad"
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="any"
                        value={item.cantidad}
                        onChange={(e) => updateItem(item.id, "cantidad", e.target.value)}
                        className={cn(input, "h-9 px-2.5 text-center tabular-nums md:col-start-3 md:row-start-1", sinFlechas)}
                      />
                      <div className="relative md:col-start-4 md:row-start-1">
                        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                        <input
                          aria-label="Precio unitario"
                          type="number"
                          inputMode="decimal"
                          min="0"
                          step="any"
                          placeholder="0"
                          value={item.precio_unitario}
                          onChange={(e) => updateItem(item.id, "precio_unitario", e.target.value)}
                          className={cn(input, "h-9 pl-7 text-right tabular-nums", sinFlechas)}
                        />
                      </div>
                      <span className="text-right text-sm font-semibold tabular-nums text-slate-900 dark:text-white md:col-start-5 md:row-start-1">{formatCurrency(sub)}</span>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 px-5 py-3 dark:border-slate-700 sm:px-6">
              <span className="mr-1 text-sm text-slate-500 dark:text-slate-400">Agregar:</span>
              {TIPOS.slice(0, 3).map((t) => (
                <button
                  key={t.value}
                  type="button"
                  onClick={() => agregarItem(t.value)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg px-3 text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-700"
                >
                  <span className="text-brand-600">+</span> {t.agregar}
                </button>
              ))}
            </div>
          </div>
        </section>
      </div>

      {/* Resumen y guardar */}
      <aside className="space-y-4 lg:sticky lg:top-24">
        <section className={cn(tarjeta, "p-5")}>
          <h2 className="text-base font-semibold text-slate-900 dark:text-white">Resumen</h2>
          <dl className="mt-4 space-y-2.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt className="text-slate-600 dark:text-slate-400">Mano de obra</dt>
              <dd className="tabular-nums text-slate-900 dark:text-white">{formatCurrency(manoObra)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-slate-600 dark:text-slate-400">Repuestos e insumos</dt>
              <dd className="tabular-nums text-slate-900 dark:text-white">{formatCurrency(materiales)}</dd>
            </div>
            <div className="flex items-start justify-between gap-4">
              <dt className="pt-2"><label htmlFor="descuento" className="text-slate-600 dark:text-slate-400">Descuento</label></dt>
              <dd>
                <CampoDescuento id="descuento" modo={modoDescuento} valor={descuento} subtotal={subtotal} onModo={setModoDescuento} onValor={setDescuento} invalido={montoDesc > subtotal && subtotal > 0} />
              </dd>
            </div>
          </dl>
          <div className="mt-4 flex items-end justify-between gap-4 border-t border-slate-100 pt-4 dark:border-slate-700">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Total</span>
            <span className="font-display text-4xl font-extrabold leading-none tabular-nums text-slate-900 dark:text-white">{formatCurrency(total)}</span>
          </div>
          {montoDesc > subtotal && subtotal > 0 && <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">El descuento es mayor que el subtotal.</p>}
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">El cliente lo ve válido por {VALIDEZ_DIAS} días y lo puede aprobar desde el link.</p>

          {editId && (
            <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-700">
              <label htmlFor="estado" className={etiqueta}>Estado</label>
              <select id="estado" value={estado} onChange={(e) => setEstado(e.target.value)} className={input}>
                {ESTADOS.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
              </select>
            </div>
          )}

          <div className="mt-5 grid gap-2">
            <button type="submit" disabled={guardando} className="inline-flex h-11 items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60">
              {textoGuardar}
            </button>
            <Link href={editId ? `/presupuestos/${editId}` : "/presupuestos"} className="inline-flex h-10 items-center justify-center rounded-xl text-sm font-semibold text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700">
              Cancelar
            </Link>
          </div>
        </section>
      </aside>
    </form>
  );
}

function Titulo() {
  const editId = useSearchParams().get("id");
  return (
    <AppShell
      currentPath="/presupuestos"
      compact
      title={editId ? `Editar ${numeroPresupuesto(editId)}` : "Nuevo presupuesto"}
      description={editId ? "Cambiá lo que haga falta y guardá." : "Elegí el cliente, cargá trabajos y repuestos, y guardalo para mandárselo."}
    >
      <FormularioPresupuesto />
    </AppShell>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />}>
      <Titulo />
    </Suspense>
  );
}
