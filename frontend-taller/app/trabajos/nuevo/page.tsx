"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { CampoDescuento, montoDescuento, type ModoDescuento } from "@/components/campo-descuento";
import { SectionCard } from "@/components/section-card";
import { getClientes, getVehiculoById, getVehiculos, getTrabajoById, getPresupuestoById, crearTrabajo, editarTrabajo } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { Cliente, Vehiculo, TrabajoItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ESTADO_TRABAJO_LABEL, numeroPresupuesto } from "@/lib/documentos";

// --- Tipos ---
type TrabajoItemDraft = { id: number; tipo: "MANO_OBRA" | "REPUESTO" | "INSUMO" | "OTRO"; descripcion: string; cantidad: string; precio_unitario: string; };
type FeedbackState = { tone: "idle" | "success" | "error"; message: string; };
type FormState = { clienteId: string; vehiculoId: string; kilometraje: string; estado: string; resumen_trabajos: string; observaciones_cliente: string; observaciones_internas: string; estado_general: string; fecha_egreso_estimado: string; estado_cubiertas_trabajo: string; recomendaciones_proximo_service: string; proximo_control_km: string; descuento: string; };
type ExpressState = { clienteNombre: string; clienteTelefono: string; vehiculoPatente: string; vehiculoMarca: string; };

const INITIAL_FORM: FormState = { clienteId: "", vehiculoId: "", kilometraje: "", estado: "INGRESADO", resumen_trabajos: "", observaciones_cliente: "", observaciones_internas: "", estado_general: "BUENO", fecha_egreso_estimado: "", estado_cubiertas_trabajo: "", recomendaciones_proximo_service: "", proximo_control_km: "", descuento: "" };
const INITIAL_EXPRESS: ExpressState = { clienteNombre: "", clienteTelefono: "", vehiculoPatente: "", vehiculoMarca: "" };

function createItem(id: number, tipo: TrabajoItemDraft["tipo"] = "MANO_OBRA"): TrabajoItemDraft {
  return { id, tipo, descripcion: "", cantidad: "1", precio_unitario: "0" };
}

function normalizeItemType(tipo: string): TrabajoItemDraft["tipo"] {
  return ["MANO_OBRA", "REPUESTO", "INSUMO", "OTRO"].includes(tipo)
    ? tipo as TrabajoItemDraft["tipo"]
    : "MANO_OBRA";
}

function parseAmount(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const inputBase = "w-full rounded-lg border border-slate-200 bg-slate-50 px-4 py-2.5 text-sm text-slate-900 transition-all focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-900/50 dark:text-white dark:focus:border-brand-500 dark:focus:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed";

// --- Formulario Interno (Aislado para Suspense) ---
function FormularioTrabajo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id"); // Detectar si estamos editando
  const presupuestoOrigenId = searchParams.get("presupuesto");
  const vehiculoPreId = searchParams.get("vehiculo");
  // Al abrir la orden desde un turno, el motivo pasa como resumen inicial.
  const motivoPre = searchParams.get("motivo");
  
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  
  // Arranca en porcentaje; una orden guardada se reabre con su monto en pesos.
  const [modoDescuento, setModoDescuento] = useState<ModoDescuento>("%");
  const [form, setForm] = useState<FormState>(() => ({ ...INITIAL_FORM, resumen_trabajos: motivoPre ?? "" }));
  const [items, setItems] = useState<TrabajoItemDraft[]>([createItem(1)]);
  const [nextItemId, setNextItemId] = useState(2);
  
  const [isExpressCliente, setIsExpressCliente] = useState(false);
  const [isExpressVehiculo, setIsExpressVehiculo] = useState(false);
  const [expressData, setExpressData] = useState<ExpressState>(INITIAL_EXPRESS);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRedirecting, startRedirect] = useTransition();
  const [feedback, setFeedback] = useState<FeedbackState>({ tone: "idle", message: "" });

  // Combobox de cliente
  const [clienteBusqueda, setClienteBusqueda] = useState("");
  const [clienteDropdown, setClienteDropdown] = useState(false);
  const clienteComboRef = useRef<HTMLDivElement>(null);

  // 1. CARGA INICIAL: Directorio + Precarga si hay ID
  useEffect(() => {
    let active = true;
    async function init() {
      try {
        setIsLoading(true);
        const [clientesData, vehiculosData] = await Promise.all([
          getClientes(),
          getVehiculos()
        ]);
        
        if (active) {
          setClientes(clientesData);
          setVehiculos(vehiculosData);
        }

        // Si hay una OT, la precargamos para editarla.
        if (editId && active) {
          const trabajo = await getTrabajoById(Number(editId));
          
          setForm({
            clienteId: trabajo.cliente.id.toString(),
            vehiculoId: trabajo.vehiculo.id.toString(),
            kilometraje: trabajo.kilometraje.toString(),
            estado: trabajo.estado,
            resumen_trabajos: trabajo.resumen_trabajos,
            observaciones_cliente: trabajo.observaciones_cliente,
            observaciones_internas: trabajo.observaciones_internas,
            estado_general: trabajo.estado_general,
            fecha_egreso_estimado: trabajo.fecha_egreso_estimado ? new Date(trabajo.fecha_egreso_estimado).toISOString().slice(0, 16) : "",
            estado_cubiertas_trabajo: trabajo.estado_cubiertas_trabajo || "",
            recomendaciones_proximo_service: trabajo.recomendaciones_proximo_service,
            proximo_control_km: trabajo.proximo_control_km ? trabajo.proximo_control_km.toString() : "",
            descuento: trabajo.descuento ? trabajo.descuento.toString() : ""
          });
          if (trabajo.descuento) setModoDescuento("$");
          // Pre-llenar el campo de búsqueda del combobox
          if (trabajo.cliente?.nombre_completo) {
            setClienteBusqueda(trabajo.cliente.nombre_completo);
          }

          if (trabajo.items && trabajo.items.length > 0) {
            const itemsPrecargados: TrabajoItemDraft[] = trabajo.items.map((i: TrabajoItem, index: number) => ({
              id: index + 1,
              tipo: normalizeItemType(i.tipo),
              descripcion: i.descripcion,
              cantidad: i.cantidad.toString(),
              precio_unitario: i.precio_unitario.toString()
            }));
            setItems(itemsPrecargados);
            setNextItemId(trabajo.items.length + 1);
          }
        } else if (presupuestoOrigenId && active) {
          const presupuestoId = Number(presupuestoOrigenId);
          if (!Number.isSafeInteger(presupuestoId) || presupuestoId <= 0) {
            setFeedback({ tone: "error", message: "El presupuesto indicado no es válido." });
            return;
          }

          const presupuesto = await getPresupuestoById(presupuestoId);
          if (!presupuesto.cliente || !presupuesto.vehiculo) {
            setFeedback({ tone: "error", message: "Este presupuesto no tiene cliente y vehículo completos para convertirlo en una orden." });
            return;
          }
          if (presupuesto.estado === "RECHAZADO") {
            setFeedback({ tone: "error", message: "No se puede crear una orden desde un presupuesto rechazado." });
            return;
          }

          const clienteId = presupuesto.cliente.id.toString();
          setForm((current) => ({
            ...current,
            clienteId,
            vehiculoId: presupuesto.vehiculo!.id.toString(),
            kilometraje: presupuesto.vehiculo!.kilometraje_actual.toString(),
            resumen_trabajos: presupuesto.resumen_corto || "",
            descuento: presupuesto.descuento ? presupuesto.descuento.toString() : "",
          }));
          if (presupuesto.descuento) setModoDescuento("$");
          setClienteBusqueda(presupuesto.cliente.nombre_completo);
          setItems(
            presupuesto.items.length
              ? presupuesto.items.map((item, index) => ({
                  id: index + 1,
                  tipo: normalizeItemType(item.tipo),
                  descripcion: item.descripcion,
                  cantidad: item.cantidad.toString(),
                  precio_unitario: item.precio_unitario.toString(),
                }))
              : [createItem(1)],
          );
          setNextItemId(Math.max(presupuesto.items.length + 1, 2));
          setFeedback({ tone: "success", message: `Orden preparada desde el presupuesto ${numeroPresupuesto(presupuesto.id)}. Revisá el kilometraje y guardá para convertirlo.` });
        } else if (vehiculoPreId && active) {
          const vehiculo = await getVehiculoById(Number(vehiculoPreId));
          setForm((current) => ({
            ...current,
            clienteId: vehiculo.cliente_id.toString(),
            vehiculoId: vehiculo.id.toString(),
            kilometraje: vehiculo.kilometraje_actual.toString(),
          }));
          setClienteBusqueda(vehiculo.cliente_nombre);
        }
      } catch {
        if (active) setFeedback({ tone: "error", message: "Error al cargar la base de datos o la orden solicitada." });
      } finally {
        if (active) setIsLoading(false);
      }
    }
    init();
    return () => { active = false; };
  }, [editId, presupuestoOrigenId, vehiculoPreId]);

  // Click-outside para el combobox de cliente
  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (clienteComboRef.current && !clienteComboRef.current.contains(e.target as Node)) {
        setClienteDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  // Limpiar vehiculo si cambia el cliente (en modo NO express)
  useEffect(() => {
    if (isExpressCliente || isExpressVehiculo || editId) return; // Si editamos, no tocamos la cascada automática
    if (!form.clienteId || !form.vehiculoId) return;
    const vehiculoVigente = vehiculos.some(v => v.id === Number(form.vehiculoId) && v.cliente_id === Number(form.clienteId));
    if (!vehiculoVigente) setForm(curr => ({ ...curr, vehiculoId: "" }));
  }, [form.clienteId, form.vehiculoId, vehiculos, isExpressCliente, isExpressVehiculo, editId]);

  function updateForm<K extends keyof FormState>(key: K, value: FormState[K]) { setForm(curr => ({ ...curr, [key]: value })); }
  function updateExpress<K extends keyof ExpressState>(key: K, value: ExpressState[K]) { setExpressData(curr => ({ ...curr, [key]: value })); }
  function updateItem(itemId: number, key: keyof Omit<TrabajoItemDraft, "id">, value: string) {
    setItems(curr => curr.map(item => (item.id === itemId ? { ...item, [key]: value } : item)));
  }
  function addItem() { setItems(curr => [...curr, createItem(nextItemId, "REPUESTO")]); setNextItemId(curr => curr + 1); }
  function removeItem(itemId: number) { setItems(curr => curr.filter(item => item.id !== itemId)); }

  const vehiculosDelCliente = vehiculos.filter(v => v.cliente_id === Number(form.clienteId));

  // Combobox helpers
  const clientesFiltradosCombo = clienteBusqueda.trim() === ""
    ? clientes.slice(0, 10)
    : clientes.filter(c =>
        `${c.nombre_completo} ${c.dni ?? ""} ${c.telefono ?? ""}`.toLowerCase().includes(clienteBusqueda.toLowerCase())
      ).slice(0, 10);

  const clienteActual = clientes.find(c => c.id === Number(form.clienteId));

  function seleccionarCliente(c: Cliente) {
    updateForm("clienteId", c.id.toString());
    updateForm("vehiculoId", "");
    setClienteBusqueda(c.nombre_completo);
    setClienteDropdown(false);
  }

  function limpiarCliente() {
    updateForm("clienteId", "");
    updateForm("vehiculoId", "");
    setClienteBusqueda("");
    setClienteDropdown(false);
  }
  const subtotalManoObra = items.reduce((acc, item) => item.tipo === "MANO_OBRA" ? acc + parseAmount(item.cantidad) * parseAmount(item.precio_unitario) : acc, 0);
  const subtotalOtros = items.reduce((acc, item) => item.tipo !== "MANO_OBRA" ? acc + parseAmount(item.cantidad) * parseAmount(item.precio_unitario) : acc, 0);
  const descuento = montoDescuento(modoDescuento, form.descuento, subtotalManoObra + subtotalOtros);
  const total = Math.max(subtotalManoObra + subtotalOtros - descuento, 0);

  // 2. LÓGICA DE GUARDADO (Crear vs Editar)
  async function guardarTrabajo(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (items.some(item => !item.descripcion.trim())) {
      return setFeedback({ tone: "error", message: "Todos los ítems deben tener una descripción." });
    }

    setIsSaving(true);
    setFeedback({ tone: "idle", message: "" });

    try {
      const payload = {
        cliente_id: modoCliente === "DIRECTORIO" ? Number(form.clienteId) : undefined,
        vehiculo_id: modoCliente === "DIRECTORIO" ? Number(form.vehiculoId) : undefined,
        cliente_express: modoCliente === "EXPRESS" ? { nombre: expressData.clienteNombre, telefono: expressData.clienteTelefono } : undefined,
        vehiculo_express: modoCliente === "EXPRESS" ? { patente: expressData.vehiculoPatente, marca: expressData.vehiculoMarca } : undefined,
        kilometraje: Number(form.kilometraje),
        estado: form.estado,
        resumen_trabajos: form.resumen_trabajos.trim(),
        observaciones_cliente: form.observaciones_cliente.trim(),
        observaciones_internas: form.observaciones_internas.trim(),
        estado_general: form.estado_general,
        fecha_egreso_estimado: form.fecha_egreso_estimado ? new Date(form.fecha_egreso_estimado).toISOString() : null,
        estado_cubiertas_trabajo: form.estado_cubiertas_trabajo.trim(),
        recomendaciones_proximo_service: form.recomendaciones_proximo_service.trim(),
        proximo_control_km: form.proximo_control_km ? Number(form.proximo_control_km) : null,
        descuento,
        presupuesto_origen_id: !editId && presupuestoOrigenId ? Number(presupuestoOrigenId) : undefined,
        items: items.map(item => ({
          tipo: item.tipo,
          descripcion: item.descripcion.trim(),
          cantidad: parseAmount(item.cantidad),
          precio_unitario: parseAmount(item.precio_unitario),
        })),
      };

      if (editId) {
        await editarTrabajo(Number(editId), payload);
        setFeedback({ tone: "success", message: "¡Orden de trabajo actualizada!" });
      } else {
        await crearTrabajo(payload);
        setFeedback({ tone: "success", message: "¡Trabajo guardado exitosamente!" });
      }
      
      startRedirect(() => router.push("/trabajos"));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error inesperado del servidor.";
      setFeedback({ tone: "error", message });
      setIsSaving(false);
    }
  }

  const modoCliente = isExpressCliente || isExpressVehiculo ? "EXPRESS" : "DIRECTORIO";
  const clienteOk = isExpressCliente ? expressData.clienteNombre.trim().length > 0 : !!form.clienteId || !!editId;
  const vehiculoOk = isExpressVehiculo ? !!expressData.vehiculoPatente.trim() && !!expressData.vehiculoMarca.trim() : !!form.vehiculoId;
  const kilometrajeOk = form.kilometraje !== "" && Number(form.kilometraje) >= 0;
  const itemsOk = items.length > 0 && items.every((i) => i.descripcion.trim().length > 2);
  const subtotal = subtotalManoObra + subtotalOtros;
  // Mismo criterio que el backend (total_con_descuento): un descuento mayor al
  // subtotal se rechaza, así que se avisa acá antes de intentar guardar.
  const descuentoExcedido = descuento > subtotal;
  const faltantes = [
    !clienteOk && "Elegí o cargá el cliente",
    !vehiculoOk && "Elegí o cargá el vehículo",
    !kilometrajeOk && "Indicá el kilometraje de ingreso",
    !itemsOk && "Describí cada ítem (al menos 3 letras)",
    descuentoExcedido && "El descuento supera el subtotal",
  ].filter(Boolean) as string[];
  const ocupado = isSaving || isRedirecting || isLoading;

  if (isLoading) return <div className="h-[60vh] animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800"></div>;

  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] xl:grid-cols-[minmax(0,1fr)_380px]">
      <form id="form-trabajo" className="min-w-0 space-y-5" onSubmit={guardarTrabajo}>

        {feedback.message && (
          <div role={feedback.tone === "error" ? "alert" : "status"} className={cn("rounded-xl border p-4 text-sm font-medium",
            feedback.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300" :
            feedback.tone === "error" ? "border-red-200 bg-red-50 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300" :
            "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-900 dark:bg-sky-950/30 dark:text-sky-300"
          )}>
            {feedback.message}
          </div>
        )}

        {/* 1. Cliente y vehículo */}
        <SectionCard compact title="Cliente y vehículo">
          <div className="grid gap-x-5 gap-y-4 md:grid-cols-2 xl:grid-cols-4">
            <div className="space-y-1.5 md:col-span-1 xl:col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Cliente</span>
                {!editId && (
                  <button type="button" onClick={() => setIsExpressCliente(!isExpressCliente)} className="text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">
                    {isExpressCliente ? "Buscar uno existente" : "+ Cliente nuevo"}
                  </button>
                )}
              </div>
            {isExpressCliente && !editId ? (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                <input autoFocus required type="text" placeholder="Nombre completo" value={expressData.clienteNombre} onChange={(e) => updateExpress("clienteNombre", e.target.value)} className={inputBase} />
                <input type="text" placeholder="Teléfono (Opcional)" value={expressData.clienteTelefono} onChange={(e) => updateExpress("clienteTelefono", e.target.value)} className={inputBase} />
              </div>
            ) : editId ? (
              /* En modo edición mostramos el cliente como texto (no editable) */
              <div className={inputBase + " flex items-center gap-2 bg-slate-100 opacity-70 cursor-not-allowed"}>
                <svg className="h-4 w-4 text-slate-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                <span className="text-sm font-medium text-slate-700">{clienteActual?.nombre_completo || "Cliente seleccionado"}</span>
              </div>
            ) : (
              /* COMBOBOX DE CLIENTE */
              <div ref={clienteComboRef} className="relative">
                {clienteActual ? (
                  /* Cliente ya seleccionado: chip */
                  <div className="flex items-center gap-2 rounded-lg border border-brand-300 bg-brand-50 px-3 py-2.5 dark:border-brand-700 dark:bg-brand-900/20">
                    <svg className="h-4 w-4 flex-shrink-0 text-brand-600 dark:text-brand-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-bold text-brand-700 dark:text-brand-300 truncate">{clienteActual.nombre_completo}</span>
                      {clienteActual.dni && <span className="text-[10px] font-medium text-brand-500">DNI: {clienteActual.dni}</span>}
                    </div>
                    <button type="button" onClick={limpiarCliente} className="ml-auto flex-shrink-0 rounded-full p-0.5 text-brand-500 hover:bg-brand-200 hover:text-brand-700 transition dark:hover:bg-brand-800" title="Cambiar cliente">
                      <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                  </div>
                ) : (
                  <input
                    type="text"
                    placeholder="Buscar cliente por nombre, DNI o teléfono..."
                    value={clienteBusqueda}
                    onChange={(e) => { setClienteBusqueda(e.target.value); setClienteDropdown(true); }}
                    onFocus={() => setClienteDropdown(true)}
                    className={inputBase}
                    autoComplete="off"
                  />
                )}
                {clienteDropdown && !clienteActual && (
                  <div className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800">
                    {clientesFiltradosCombo.length > 0 ? clientesFiltradosCombo.map(c => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); seleccionarCliente(c); }}
                        className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-brand-50 dark:hover:bg-slate-700"
                      >
                        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                          {c.nombre_completo.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-sm font-bold text-slate-900 dark:text-white truncate">{c.nombre_completo}</span>
                          <span className="text-[10px] text-slate-500">{c.dni ? `DNI: ${c.dni}` : ""}{c.telefono ? `  ·  ${c.telefono}` : ""}</span>
                        </div>
                        {Number(c.saldo_balance) > 0 && (
                          <span className="ml-auto flex-shrink-0 rounded-full bg-red-100 px-2 py-0.5 text-[9px] font-bold uppercase text-red-600 dark:bg-red-900/30 dark:text-red-400">
                            Debe
                          </span>
                        )}
                      </button>
                    )) : (
                      <div className="px-4 py-6 text-center text-sm text-slate-400">
                        No se encontró ningún cliente.
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            </div>

            <div className="space-y-1.5 md:col-span-1 xl:col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Vehículo</span>
                {!editId && (
                  <button type="button" onClick={() => setIsExpressVehiculo(!isExpressVehiculo)} className="text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400">
                    {isExpressVehiculo ? "Elegir uno del cliente" : "+ Vehículo nuevo"}
                  </button>
                )}
              </div>
            {isExpressVehiculo && !editId ? (
              <div className="space-y-3 animate-in fade-in slide-in-from-top-2">
                <input autoFocus required type="text" placeholder="Patente (Ej. AB123CD)" value={expressData.vehiculoPatente} onChange={(e) => updateExpress("vehiculoPatente", e.target.value)} className={inputBase} />
                <input required type="text" placeholder="Marca y Modelo (Ej. Ford Focus)" value={expressData.vehiculoMarca} onChange={(e) => updateExpress("vehiculoMarca", e.target.value)} className={inputBase} />
              </div>
            ) : (
              <select required value={form.vehiculoId} onChange={(e) => updateForm("vehiculoId", e.target.value)} disabled={(!form.clienteId && !isExpressCliente) || !!editId} className={inputBase}>
                <option value="">{form.clienteId ? "Seleccionar vehículo..." : "Primero elija un cliente"}</option>
                {(editId ? vehiculos : vehiculosDelCliente).map(v => <option key={v.id} value={v.id}>{v.patente} · {v.marca} {v.modelo}</option>)}
              </select>
            )}
            </div>

            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Kilometraje de ingreso</span>
              <input required min={0} type="number" inputMode="numeric" placeholder="Ej. 85000" value={form.kilometraje} onChange={(e) => updateForm("kilometraje", e.target.value)} className={inputBase} />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Estado</span>
              <select value={form.estado} onChange={(e) => updateForm("estado", e.target.value)} className={inputBase}>
                <option value="INGRESADO">{ESTADO_TRABAJO_LABEL.INGRESADO}</option>
                <option value="EN_PROCESO">{ESTADO_TRABAJO_LABEL.EN_PROCESO}</option>
                <option value="FINALIZADO">{ESTADO_TRABAJO_LABEL.FINALIZADO}</option>
                <option value="ENTREGADO">{ESTADO_TRABAJO_LABEL.ENTREGADO}</option>
              </select>
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Próximo service (km)</span>
              <input type="number" inputMode="numeric" placeholder="Ej. 95000" value={form.proximo_control_km} onChange={(e) => updateForm("proximo_control_km", e.target.value)} className={inputBase} />
            </label>
          </div>
        </SectionCard>

        {/* 2. Tareas y repuestos */}
        <SectionCard
          compact
          title="Tareas y repuestos"
          description="Cada ítem es una tarea del checklist del mecánico."
          action={<button type="button" onClick={addItem} className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700">+ Agregar ítem</button>}
        >
          <div className="mt-1">
            <div className="hidden grid-cols-[160px_minmax(0,1fr)_84px_150px_130px_36px] gap-3 border-b border-slate-100 px-1 pb-2 text-xs font-medium text-slate-500 dark:border-slate-700 dark:text-slate-400 md:grid">
              <span>Tipo</span><span>Descripción</span><span className="text-right">Cant.</span><span className="text-right">Precio unitario</span><span className="text-right">Subtotal</span><span />
            </div>

            <div className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {items.map((item, index) => {
                const subtotalItem = parseAmount(item.cantidad) * parseAmount(item.precio_unitario);
                return (
                  <div key={item.id} className="grid grid-cols-2 gap-2 py-3 md:grid-cols-[160px_minmax(0,1fr)_84px_150px_130px_36px] md:items-center md:gap-3 md:py-2">
                    <select aria-label={`Tipo del ítem ${index + 1}`} value={item.tipo} onChange={(e) => updateItem(item.id, "tipo", e.target.value as TrabajoItemDraft["tipo"])} className={inputBase + " col-span-2 px-3 py-2 md:col-span-1"}>
                      <option value="MANO_OBRA">Mano de obra</option>
                      <option value="REPUESTO">Repuesto</option>
                      <option value="INSUMO">Insumo</option>
                    </select>
                    <input aria-label={`Descripción del ítem ${index + 1}`} required type="text" placeholder="Ej. Cambio de pastillas delanteras" value={item.descripcion} onChange={(e) => updateItem(item.id, "descripcion", e.target.value)} className={inputBase + " col-span-2 py-2 md:col-span-1"} />
                    <input aria-label={`Cantidad del ítem ${index + 1}`} required min="0.01" step="0.01" type="number" inputMode="decimal" placeholder="1" value={item.cantidad} onChange={(e) => updateItem(item.id, "cantidad", e.target.value)} className={inputBase + " money-input py-2 text-right"} />
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-slate-400">$</span>
                      <input
                        aria-label={`Precio unitario del ítem ${index + 1}`}
                        required
                        min="0"
                        step="0.01"
                        type="number"
                        inputMode="decimal"
                        placeholder="0"
                        value={item.precio_unitario}
                        onFocus={(event) => event.currentTarget.select()}
                        onChange={(e) => updateItem(item.id, "precio_unitario", e.target.value)}
                        className={inputBase + " money-input py-2 pl-7 text-right tabular-nums"}
                      />
                    </div>
                    <p className="flex items-center justify-between text-sm md:justify-end">
                      <span className="text-xs text-slate-500 md:hidden">Subtotal</span>
                      <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{formatCurrency(subtotalItem)}</span>
                    </p>
                    <div className="flex justify-end">
                      {items.length > 1 && (
                        <button type="button" onClick={() => removeItem(item.id)} aria-label={`Quitar el ítem ${index + 1}`} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 transition hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30">
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <button type="button" onClick={addItem} className="mt-2 w-full rounded-lg border border-dashed border-slate-300 py-2.5 text-sm font-medium text-slate-500 transition hover:border-slate-400 hover:text-slate-700 dark:border-slate-600 dark:text-slate-400 dark:hover:text-slate-200">
              + Agregar otro ítem
            </button>
          </div>
        </SectionCard>

        {/* 3. Diagnóstico y notas */}
        <SectionCard compact title="Diagnóstico y notas">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Diagnóstico para el cliente</span>
              <textarea rows={3} placeholder="Lo que se ve en el comprobante y en el portal del cliente." value={form.resumen_trabajos} onChange={(e) => updateForm("resumen_trabajos", e.target.value)} className={inputBase} />
            </label>
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Notas internas <span className="font-normal text-slate-400">(no las ve el cliente)</span></span>
              <textarea rows={3} placeholder="Ej. Tuerca barrida en rueda delantera." value={form.observaciones_internas} onChange={(e) => updateForm("observaciones_internas", e.target.value)} className={inputBase} />
            </label>
          </div>
        </SectionCard>

        {/* Acciones al pie (en pantallas grandes también están en el resumen) */}
        <div className="flex flex-col-reverse justify-end gap-3 sm:flex-row lg:hidden">
          <Link href="/trabajos" className="inline-flex justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Cancelar
          </Link>
          <button type="submit" disabled={ocupado || descuentoExcedido} className="inline-flex justify-center rounded-xl bg-brand-600 px-8 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50">
            {isSaving ? "Guardando…" : editId ? "Guardar cambios" : "Guardar orden"}
          </button>
        </div>
      </form>

      {/* Resumen fijo: total, lo que falta y guardar */}
      <aside className="space-y-4 lg:sticky lg:top-20">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="space-y-3 p-5">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Resumen</h3>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Mano de obra</span>
              <span className="font-medium tabular-nums text-slate-900 dark:text-white">{formatCurrency(subtotalManoObra)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-600 dark:text-slate-400">Repuestos e insumos</span>
              <span className="font-medium tabular-nums text-slate-900 dark:text-white">{formatCurrency(subtotalOtros)}</span>
            </div>
            <div className="flex items-start justify-between gap-3 text-sm">
              <label htmlFor="descuento-trabajo" className="pt-2 text-slate-600 dark:text-slate-400">Descuento</label>
              <CampoDescuento id="descuento-trabajo" modo={modoDescuento} valor={form.descuento} subtotal={subtotalManoObra + subtotalOtros} onModo={setModoDescuento} onValor={(v) => updateForm("descuento", v)} invalido={descuentoExcedido} />
            </div>
            {descuentoExcedido && <p className="text-xs text-red-600 dark:text-red-400">El descuento no puede superar el subtotal ({formatCurrency(subtotal)}).</p>}
          </div>
          <div className="flex items-baseline justify-between gap-4 border-t border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-700 dark:bg-slate-900/60">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Total</span>
            <span className="text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">{formatCurrency(total)}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          {faltantes.length > 0 ? (
            <>
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Para guardar falta</h3>
              <ul className="mt-2 space-y-1.5">
                {faltantes.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" aria-hidden="true" />{f}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-400">
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
              Lista para guardar
            </p>
          )}
          <div className="mt-4 hidden gap-2 lg:flex">
            <Link href="/trabajos" className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-700">
              Cancelar
            </Link>
            <button type="submit" form="form-trabajo" disabled={ocupado || descuentoExcedido} className="flex-[2] rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-50">
              {isSaving ? "Guardando…" : editId ? "Guardar cambios" : "Guardar orden"}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

export default function Page() {
  return (
    <AppShell
      currentPath="/trabajos"
      compact
      title="Orden de trabajo"
      description="Cliente, vehículo, tareas y repuestos. El total se calcula solo."
    >
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800"></div>}>
        <FormularioTrabajo />
      </Suspense>
    </AppShell>
  );
}
