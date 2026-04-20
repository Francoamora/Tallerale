"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition, Suspense, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { StatusBadge } from "@/components/status-badge";
import { getClientes, getVehiculos, getTrabajoById, crearTrabajo, editarTrabajo } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { Cliente, Vehiculo, Trabajo } from "@/lib/types";
import { cn } from "@/lib/utils";

// --- Tipos ---
type TrabajoItemDraft = { id: number; tipo: "MANO_OBRA" | "REPUESTO" | "INSUMO" | "OTRO"; descripcion: string; cantidad: string; precio_unitario: string; };
type FeedbackState = { tone: "idle" | "success" | "error"; message: string; };
type FormState = { clienteId: string; vehiculoId: string; kilometraje: string; estado: string; resumen_trabajos: string; observaciones_cliente: string; observaciones_internas: string; estado_general: string; fecha_egreso_estimado: string; estado_cubiertas_trabajo: string; recomendaciones_proximo_service: string; proximo_control_km: string; descuento: string; };
type ExpressState = { clienteNombre: string; clienteTelefono: string; vehiculoPatente: string; vehiculoMarca: string; };

const INITIAL_FORM: FormState = { clienteId: "", vehiculoId: "", kilometraje: "", estado: "INGRESADO", resumen_trabajos: "", observaciones_cliente: "", observaciones_internas: "", estado_general: "BUENO", fecha_egreso_estimado: "", estado_cubiertas_trabajo: "", recomendaciones_proximo_service: "", proximo_control_km: "", descuento: "0" };
const INITIAL_EXPRESS: ExpressState = { clienteNombre: "", clienteTelefono: "", vehiculoPatente: "", vehiculoMarca: "" };

function createItem(id: number, tipo: TrabajoItemDraft["tipo"] = "MANO_OBRA"): TrabajoItemDraft {
  return { id, tipo, descripcion: "", cantidad: "1", precio_unitario: "0" };
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
  
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
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

        // SI HAY ID EN LA URL, PRECISAMOS PRECARGAR EL FORMULARIO
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
            descuento: trabajo.descuento.toString()
          });
          // Pre-llenar el campo de búsqueda del combobox
          if (trabajo.cliente?.nombre_completo) {
            setClienteBusqueda(trabajo.cliente.nombre_completo);
          }

          if (trabajo.items && trabajo.items.length > 0) {
            const itemsPrecargados: TrabajoItemDraft[] = trabajo.items.map((i: any, index: number) => ({
              id: index + 1,
              tipo: i.tipo,
              descripcion: i.descripcion,
              cantidad: i.cantidad.toString(),
              precio_unitario: i.precio_unitario.toString()
            }));
            setItems(itemsPrecargados);
            setNextItemId(trabajo.items.length + 1);
          }
        }
      } catch (error) {
        if (active) setFeedback({ tone: "error", message: "Error al cargar la base de datos o la orden solicitada." });
      } finally {
        if (active) setIsLoading(false);
      }
    }
    init();
    return () => { active = false; };
  }, [editId]);

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
  const descuento = parseAmount(form.descuento);
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
      
      startRedirect(() => { router.push("/trabajos"); router.refresh(); });
    } catch (error: any) {
      setFeedback({ tone: "error", message: error.message || "Error inesperado del servidor." });
      setIsSaving(false);
    }
  }

  const modoCliente = isExpressCliente || isExpressVehiculo ? "EXPRESS" : "DIRECTORIO";
  const checklistCompleto = (modoCliente === "EXPRESS" ? !!expressData.clienteNombre && !!expressData.vehiculoPatente : !!form.clienteId && !!form.vehiculoId) && !!form.kilometraje && items.every(i => i.descripcion.length > 2);

  if (isLoading) return <div className="h-[60vh] animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800"></div>;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px] xl:grid-cols-[minmax(0,1.4fr)_380px]">
      <form className="space-y-6" onSubmit={guardarTrabajo}>
        
        {feedback.message && (
          <div className={cn("rounded-xl border p-4 text-sm font-medium",
            feedback.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300" : 
            feedback.tone === "error" ? "border-red-200 bg-red-50 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300" : 
            "border-slate-200 bg-blue-50 text-blue-800"
          )}>
            {feedback.message}
          </div>
        )}

        {/* 1. SECCIÓN: CLIENTE Y VEHÍCULO */}
        <SectionCard title="Contexto Operativo">
          <div className="grid gap-5 md:grid-cols-2">
            
            {/* Bloque Cliente */}
            <div className={cn("rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900/40", editId ? "border-brand-200 bg-brand-50/20 dark:border-brand-900/30" : "border-slate-100 dark:border-slate-800")}>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Datos del Cliente</span>
                {!editId && (
                  <button type="button" onClick={() => setIsExpressCliente(!isExpressCliente)} className="text-xs font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400">
                    {isExpressCliente ? "← Usar Existente" : "+ Alta Express"}
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

            {/* Bloque Vehículo */}
            <div className={cn("rounded-xl border bg-white p-4 shadow-sm dark:bg-slate-900/40", editId ? "border-brand-200 bg-brand-50/20 dark:border-brand-900/30" : "border-slate-100 dark:border-slate-800")}>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Datos del Vehículo</span>
                {!editId && (
                  <button type="button" onClick={() => setIsExpressVehiculo(!isExpressVehiculo)} className="text-xs font-bold text-brand-600 hover:text-brand-700 dark:text-brand-400">
                    {isExpressVehiculo ? "← Usar Existente" : "+ Alta Express"}
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
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Kilometraje de Ingreso</span>
              <input required min={0} type="number" placeholder="Ej. 85000" value={form.kilometraje} onChange={(e) => updateForm("kilometraje", e.target.value)} className={inputBase} />
            </label>

            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Estado</span>
              <select value={form.estado} onChange={(e) => updateForm("estado", e.target.value)} className={inputBase}>
                <option value="INGRESADO">Ingresado (En espera)</option>
                <option value="EN_PROCESO">En proceso (Elevador)</option>
                <option value="FINALIZADO">Finalizado (Listo para entregar)</option>
                <option value="ENTREGADO">Entregado al Cliente</option>
              </select>
            </label>
          </div>
        </SectionCard>

        {/* 2. PRESUPUESTO DINÁMICO */}
        <SectionCard 
          title="Detalle Económico y Repuestos" 
          action={<button type="button" onClick={addItem} className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800 shadow-sm dark:bg-brand-600 dark:hover:bg-brand-500">+ Agregar Ítem</button>}
        >
          <div className="space-y-3">
            <div className="hidden grid-cols-[minmax(120px,1.2fr)_2fr_0.8fr_1fr_1fr_40px] gap-3 px-2 text-xs font-bold uppercase tracking-widest text-slate-400 sm:grid">
              <span>Tipo</span><span>Descripción del trabajo/repuesto</span><span>Cant.</span><span>Precio U.</span><span>Subtotal</span><span></span>
            </div>
            
            {items.map((item) => {
              const subtotal = parseAmount(item.cantidad) * parseAmount(item.precio_unitario);
              return (
                <div key={item.id} className="relative flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:grid sm:grid-cols-[minmax(120px,1.2fr)_2fr_0.8fr_1fr_1fr_40px] sm:items-center sm:p-2 dark:border-slate-700 dark:bg-slate-900/50">
                  <select value={item.tipo} onChange={(e) => updateItem(item.id, "tipo", e.target.value as TrabajoItemDraft["tipo"])} className={inputBase + " py-2 text-xs"}>
                    <option value="MANO_OBRA">Mano de Obra</option>
                    <option value="REPUESTO">Repuesto</option>
                    <option value="INSUMO">Insumo</option>
                  </select>
                  <input required type="text" placeholder="Detalle..." value={item.descripcion} onChange={(e) => updateItem(item.id, "descripcion", e.target.value)} className={inputBase + " py-2 text-xs"} />
                  <input required min="0.01" step="0.01" type="number" placeholder="Cant." value={item.cantidad} onChange={(e) => updateItem(item.id, "cantidad", e.target.value)} className={inputBase + " py-2 text-xs"} />
                  <input required min="0" step="0.01" type="number" placeholder="Precio U." value={item.precio_unitario} onChange={(e) => updateItem(item.id, "precio_unitario", e.target.value)} className={inputBase + " py-2 text-xs font-mono"} />
                  
                  <div className="flex items-center justify-between px-2 sm:justify-start">
                    <span className="text-xs font-bold sm:hidden text-slate-500">Subtotal:</span>
                    <span className="font-mono text-sm font-semibold text-slate-900 dark:text-brand-400">{formatCurrency(subtotal)}</span>
                  </div>

                  <div className="absolute right-2 top-2 sm:static sm:flex sm:justify-center">
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(item.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 transition">
                         ✕
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* 3. REPORTE TÉCNICO */}
        <SectionCard title="Reporte Técnico">
          <div className="grid gap-5">
            <label className="space-y-1.5">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Diagnóstico Principal (Para el Cliente)</span>
              <textarea rows={2} placeholder="Resumen visible en el comprobante final." value={form.resumen_trabajos} onChange={(e) => updateForm("resumen_trabajos", e.target.value)} className={inputBase} />
            </label>
            <div className="grid gap-5 sm:grid-cols-2">
               <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Próximo Service (Km)</span>
                <input type="number" placeholder="Ej. 95000" value={form.proximo_control_km} onChange={(e) => updateForm("proximo_control_km", e.target.value)} className={inputBase} />
              </label>
              <label className="space-y-1.5">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Anotaciones Internas (Privado)</span>
                <input type="text" placeholder="Ej. Tuerca barrida en rueda delantera." value={form.observaciones_internas} onChange={(e) => updateForm("observaciones_internas", e.target.value)} className={inputBase} />
              </label>
            </div>
          </div>
        </SectionCard>

        {/* BOTONERA */}
        <div className="flex flex-col-reverse justify-end gap-3 pt-4 sm:flex-row">
           <Link href="/trabajos" className="inline-flex justify-center rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700">
            Cancelar
          </Link>
          <button type="submit" disabled={isSaving || isRedirecting || isLoading} className="inline-flex justify-center rounded-xl bg-brand-600 px-8 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50">
            {isSaving ? "Procesando..." : editId ? "Actualizar Trabajo" : "Confirmar y Guardar Trabajo"}
          </button>
        </div>
      </form>

      {/* COLUMNA LATERAL (RESUMEN EN VIVO) */}
      <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h3 className="mb-5 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Total a Cobrar</h3>
          
          <div className="space-y-4 border-b border-slate-100 pb-5 dark:border-slate-700">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-slate-600 dark:text-slate-400">Mano de Obra</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white">{formatCurrency(subtotalManoObra)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-medium text-slate-600 dark:text-slate-400">Repuestos/Insumos</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white">{formatCurrency(subtotalOtros)}</span>
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-medium text-brand-600 dark:text-brand-400">Descuento</span>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <input type="number" min="0" step="0.01" value={form.descuento} onChange={(e) => updateForm("descuento", e.target.value)} className="w-28 rounded-lg border border-slate-200 bg-slate-50 py-1.5 pl-7 pr-3 text-right font-mono text-sm font-bold text-slate-900 outline-none transition focus:border-brand-500 focus:bg-white dark:border-slate-600 dark:bg-slate-900 dark:text-white" />
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-end justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">TOTAL</span>
            <span className="font-mono text-4xl font-black tracking-tight text-slate-900 dark:text-brand-400">{formatCurrency(total)}</span>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
           <h3 className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">Checklist Operativo</h3>
           <ul className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
              <ChecklistItem done={checklistCompleto}>Formulario Completo</ChecklistItem>
              <ChecklistItem done={modoCliente === "EXPRESS" || !!editId}>Cliente Registrado</ChecklistItem>
              <ChecklistItem done={total > 0}>Costos Valorizados</ChecklistItem>
           </ul>
        </div>
      </aside>
    </div>
  );
}

function ChecklistItem({ done, children }: { done: boolean; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <div className={cn("flex h-5 w-5 items-center justify-center rounded-full border transition-colors", done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300 bg-slate-50 text-transparent dark:border-slate-600 dark:bg-slate-800")}>
        <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={4}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
      </div>
      <span className={done ? "font-semibold text-slate-900 dark:text-slate-200" : "font-medium text-slate-500 dark:text-slate-500"}>{children}</span>
    </li>
  );
}

export default function Page() {
  return (
    <AppShell
      currentPath="/trabajos"
      title="Gestión de Orden de Trabajo"
      description="Alta inteligente y modificación de operaciones. El presupuesto se calcula automáticamente."
    >
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800"></div>}>
        <FormularioTrabajo />
      </Suspense>
    </AppShell>
  );
}