"use client";

import { useEffect, useRef, useState, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { getClientes, getVehiculos, getVehiculosPorCliente, getPresupuestoById, crearPresupuesto, editarPresupuesto } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { Cliente, Vehiculo } from "@/lib/types";
import { cn } from "@/lib/utils";

// --- Tipos ---
type ItemDraft = { id: number; tipo: "MANO_OBRA" | "REPUESTO" | "INSUMO" | "OTRO"; descripcion: string; cantidad: string; precio_unitario: string; };
type FeedbackState = { tone: "idle" | "success" | "error"; message: string; };
type ExpressState = { clienteNombre: string; clienteTelefono: string; vehiculoPatente: string; vehiculoMarca: string; };

const INITIAL_EXPRESS: ExpressState = { clienteNombre: "", clienteTelefono: "", vehiculoPatente: "", vehiculoMarca: "" };

function createItem(id: number, tipo: ItemDraft["tipo"] = "MANO_OBRA"): ItemDraft {
  return { id, tipo, descripcion: "", cantidad: "1", precio_unitario: "0" };
}

function parseAmount(value: string) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

const inputBase = "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 transition-all focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/10 dark:border-slate-700 dark:bg-slate-900/50 dark:text-white dark:focus:border-sky-500 dark:focus:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed";

function FormularioPresupuesto() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id");
  
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  
  const [clienteId, setClienteId] = useState("");
  const [vehiculoId, setVehiculoId] = useState("");
  // Combobox buscador de clientes
  const [clienteBusqueda, setClienteBusqueda] = useState("");
  const [clienteDropdown, setClienteDropdown] = useState(false);
  const clienteComboRef = useRef<HTMLDivElement>(null);
  const [resumen, setResumen] = useState("");
  const [descuento, setDescuento] = useState("0");
  const [estado, setEstado] = useState("BORRADOR");
  
  const [items, setItems] = useState<ItemDraft[]>([createItem(1)]);
  const [nextItemId, setNextItemId] = useState(2);
  
  // Modos de UI
  const [modoCliente, setModoCliente] = useState<"DIRECTORIO" | "EXPRESS">("EXPRESS"); 
  const [expressData, setExpressData] = useState<ExpressState>(INITIAL_EXPRESS);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRedirecting, startRedirect] = useTransition();
  const [feedback, setFeedback] = useState<FeedbackState>({ tone: "idle", message: "" });

  useEffect(() => {
    let active = true;
    async function init() {
      try {
        setIsLoading(true);
        const clientesData = await getClientes();

        if (active) {
          setClientes(clientesData);
        }

        // BLOQUE BLINDADO (Si falla el ID, atrapamos el 404 acá)
        if (editId && active) {
          if (isNaN(Number(editId))) {
             setFeedback({ tone: "error", message: "El ID del presupuesto es inválido." });
             return;
          }

          try {
            const presupuesto = await getPresupuestoById(Number(editId));
            const cid = presupuesto.cliente?.id?.toString() || "";
            setModoCliente("DIRECTORIO");
            setClienteId(cid);
            setVehiculoId(presupuesto.vehiculo?.id?.toString() || "");
            setResumen(presupuesto.resumen_corto || "");
            setDescuento(presupuesto.descuento?.toString() || "0");
            setEstado(presupuesto.estado || "BORRADOR");

            // Cargar vehículos del cliente para el dropdown en modo edición
            if (cid) {
              const vDelCliente = await getVehiculosPorCliente(Number(cid));
              if (active) setVehiculos(vDelCliente);
            }
            
            if (presupuesto.items && presupuesto.items.length > 0) {
              setItems(presupuesto.items.map((i: any, idx: number) => ({
                id: idx + 1,
                tipo: i.tipo || "MANO_OBRA",
                descripcion: i.descripcion || "",
                cantidad: i.cantidad?.toString() || "1",
                precio_unitario: i.precio_unitario?.toString() || "0"
              })));
              setNextItemId(presupuesto.items.length + 1);
            }
          } catch (fetchError) {
             console.error("Presupuesto no encontrado (404):", fetchError);
             setFeedback({ tone: "error", message: "La cotización que intentás abrir no existe o fue eliminada." });
          }
        }
      } catch (error) {
        if (active) setFeedback({ tone: "error", message: "Error crítico al sincronizar con la base de datos." });
      } finally {
        if (active) setIsLoading(false);
      }
    }
    init();
    return () => { active = false; };
  }, [editId]);

  function updateExpress<K extends keyof ExpressState>(key: K, value: ExpressState[K]) { setExpressData(curr => ({ ...curr, [key]: value })); }
  function updateItem(itemId: number, key: keyof Omit<ItemDraft, "id">, value: string) { setItems(curr => curr.map(item => (item.id === itemId ? { ...item, [key]: value } : item))); }
  function addItem() { setItems(curr => [...curr, createItem(nextItemId, "REPUESTO")]); setNextItemId(curr => curr + 1); }
  function removeItem(itemId: number) { setItems(curr => curr.filter(item => item.id !== itemId)); }

  // Cerrar dropdown cliente al hacer click afuera
  useEffect(() => {
    function onFuera(e: MouseEvent) {
      if (clienteComboRef.current && !clienteComboRef.current.contains(e.target as Node)) {
        setClienteDropdown(false);
      }
    }
    document.addEventListener("mousedown", onFuera);
    return () => document.removeEventListener("mousedown", onFuera);
  }, []);

  const clienteActual = clientes.find(c => c.id === Number(clienteId)) ?? null;
  const clientesFiltradosPres = clienteBusqueda.trim().length < 1
    ? clientes.slice(0, 8)
    : clientes.filter(c => {
        const q = clienteBusqueda.toLowerCase();
        return c.nombre_completo.toLowerCase().includes(q) || (c.dni ?? "").toLowerCase().includes(q);
      }).slice(0, 10);

  const vehiculosDelCliente = vehiculos.filter(v => v.cliente_id === Number(clienteId));
  const subtotalManoObra = items.reduce((acc, item) => item.tipo === "MANO_OBRA" ? acc + parseAmount(item.cantidad) * parseAmount(item.precio_unitario) : acc, 0);
  const subtotalOtros = items.reduce((acc, item) => item.tipo !== "MANO_OBRA" ? acc + parseAmount(item.cantidad) * parseAmount(item.precio_unitario) : acc, 0);
  const total = Math.max(subtotalManoObra + subtotalOtros - parseAmount(descuento), 0);

  async function guardarPresupuesto(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (items.some(item => !item.descripcion.trim())) return setFeedback({ tone: "error", message: "Todos los ítems deben tener una descripción." });
    
    if (modoCliente === "DIRECTORIO" && !editId) {
      if (!clienteId || !vehiculoId) return setFeedback({ tone: "error", message: "Selecciona un cliente y vehículo del directorio." });
    } else if (modoCliente === "EXPRESS" && !editId) {
      if (!expressData.clienteNombre.trim() || !expressData.vehiculoPatente.trim() || !expressData.vehiculoMarca.trim()) {
        return setFeedback({ tone: "error", message: "Completá los datos obligatorios del Alta Express." });
      }
    }

    setIsSaving(true);
    setFeedback({ tone: "idle", message: "" });

    try {
      const payload = {
        cliente_id: modoCliente === "DIRECTORIO" || editId ? Number(clienteId) : undefined,
        vehiculo_id: modoCliente === "DIRECTORIO" || editId ? Number(vehiculoId) : undefined,
        cliente_express: modoCliente === "EXPRESS" && !editId ? { nombre: expressData.clienteNombre, telefono: expressData.clienteTelefono } : undefined,
        vehiculo_express: modoCliente === "EXPRESS" && !editId ? { patente: expressData.vehiculoPatente.toUpperCase(), marca: expressData.vehiculoMarca } : undefined,
        resumen_corto: resumen.trim(),
        estado: estado,
        descuento: parseAmount(descuento),
        items: items.map(item => ({
          tipo: item.tipo,
          descripcion: item.descripcion.trim(),
          cantidad: parseAmount(item.cantidad),
          precio_unitario: parseAmount(item.precio_unitario),
        })),
      };

      if (editId) {
        await editarPresupuesto(Number(editId), payload);
        setFeedback({ tone: "success", message: "¡Cotización actualizada correctamente!" });
      } else {
        await crearPresupuesto(payload);
        setFeedback({ tone: "success", message: "¡Cotización guardada exitosamente!" });
      }

      startRedirect(() => { router.push("/presupuestos"); router.refresh(); });
    } catch (error: any) {
      setFeedback({ tone: "error", message: error.message || "Error inesperado." });
      setIsSaving(false);
    }
  }

  if (isLoading) return <div className="h-[60vh] animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800"></div>;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px] xl:grid-cols-[minmax(0,1.4fr)_380px]">
      <form className="space-y-6" onSubmit={guardarPresupuesto}>
        
        {feedback.message && (
          <div className={cn("rounded-xl border p-4 text-sm font-medium",
            feedback.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300" : 
            "border-red-200 bg-red-50 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300"
          )}>
            {feedback.message}
          </div>
        )}

        {/* 1. SECCIÓN: CLIENTE Y VEHÍCULO */}
        <SectionCard title="Cliente a Cotizar">
          
          {/* Switch de Alta Express vs Directorio (Solo visible al crear) */}
          {!editId && (
            <div className="mb-6 flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800/50 w-full sm:w-fit">
              <button type="button" onClick={() => setModoCliente("EXPRESS")} className={cn("flex-1 sm:px-6 rounded-lg py-2 text-sm font-bold transition-all", modoCliente === "EXPRESS" ? "bg-white text-sky-600 shadow-sm dark:bg-slate-700 dark:text-sky-400" : "text-slate-500 hover:text-slate-700 dark:text-slate-400")}>
                ⚡ Alta Express
              </button>
              <button type="button" onClick={() => setModoCliente("DIRECTORIO")} className={cn("flex-1 sm:px-6 rounded-lg py-2 text-sm font-bold transition-all", modoCliente === "DIRECTORIO" ? "bg-white text-sky-600 shadow-sm dark:bg-slate-700 dark:text-sky-400" : "text-slate-500 hover:text-slate-700 dark:text-slate-400")}>
                Buscar en Directorio
              </button>
            </div>
          )}

          <div className="grid gap-5 md:grid-cols-2">
            {modoCliente === "DIRECTORIO" || editId ? (
              <>
                <div className="space-y-1.5">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Cliente Titular</span>
                  {editId ? (
                    /* En edición, solo mostrar el cliente (no se puede cambiar) */
                    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      {clienteActual?.nombre_completo ?? "Cargando..."}
                    </div>
                  ) : (
                    /* Combobox buscador */
                    <div ref={clienteComboRef} className="relative">
                      <div className="relative">
                        <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <input
                          type="text"
                          placeholder="Buscar cliente por nombre o DNI..."
                          value={clienteBusqueda}
                          onChange={e => { setClienteBusqueda(e.target.value); setClienteDropdown(true); setClienteId(""); setVehiculoId(""); setVehiculos([]); }}
                          onFocus={() => setClienteDropdown(true)}
                          className={inputBase + " pl-10"}
                        />
                        {clienteId && (
                          <button type="button" onClick={() => { setClienteId(""); setVehiculoId(""); setVehiculos([]); setClienteBusqueda(""); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>

                      {clienteId && clienteActual && (
                        <div className="mt-2 flex items-center gap-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 dark:border-sky-900/40 dark:bg-sky-900/10">
                          <svg className="h-4 w-4 flex-shrink-0 text-sky-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{clienteActual.nombre_completo}</p>
                            {clienteActual.dni && <p className="text-xs text-slate-500">DNI {clienteActual.dni}</p>}
                          </div>
                        </div>
                      )}

                      {clienteDropdown && !clienteId && (
                        <div className="absolute z-50 mt-1 w-full overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
                          {clientesFiltradosPres.length === 0 ? (
                            <p className="px-4 py-5 text-center text-sm text-slate-400">Sin resultados</p>
                          ) : (
                            <ul className="max-h-56 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
                              {clienteBusqueda.trim().length < 1 && (
                                <li className="px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">Últimos clientes</li>
                              )}
                              {clientesFiltradosPres.map(c => (
                                <li key={c.id}>
                                  <button
                                    type="button"
                                    onMouseDown={async () => {
                                      setClienteId(c.id.toString());
                                      setClienteBusqueda(c.nombre_completo);
                                      setClienteDropdown(false);
                                      setVehiculoId("");
                                      const vs = await getVehiculosPorCliente(c.id);
                                      setVehiculos(vs);
                                    }}
                                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800"
                                  >
                                    <div>
                                      <p className="text-sm font-bold text-slate-900 dark:text-white">{c.nombre_completo}</p>
                                      {c.dni && <p className="text-xs text-slate-400">DNI {c.dni}</p>}
                                    </div>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Vehículo a Cotizar</span>
                  <select required value={vehiculoId} onChange={(e) => setVehiculoId(e.target.value)} disabled={!clienteId} className={inputBase}>
                    <option value="">{clienteId ? "Seleccionar vehículo..." : "Primero elija un cliente"}</option>
                    {vehiculosDelCliente.map(v => <option key={v.id} value={v.id}>{v.patente} · {v.marca} {v.modelo}</option>)}
                  </select>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-4 rounded-2xl border border-sky-200 bg-sky-50/50 p-5 dark:border-sky-900/30 dark:bg-sky-900/10">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-sky-600 dark:text-sky-400">Datos Rápidos</h4>
                  <input autoFocus type="text" placeholder="Nombre y Apellido *" value={expressData.clienteNombre} onChange={e => updateExpress("clienteNombre", e.target.value)} className={inputBase} />
                  <input type="text" placeholder="Teléfono de Contacto" value={expressData.clienteTelefono} onChange={e => updateExpress("clienteTelefono", e.target.value)} className={inputBase} />
                </div>
                <div className="space-y-4 rounded-2xl border border-sky-200 bg-sky-50/50 p-5 dark:border-sky-900/30 dark:bg-sky-900/10">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-sky-600 dark:text-sky-400">Datos del Auto</h4>
                  <input type="text" placeholder="Patente (Ej: AB123CD) *" value={expressData.vehiculoPatente} onChange={e => updateExpress("vehiculoPatente", e.target.value.toUpperCase())} className={cn(inputBase, "font-mono font-bold uppercase")} />
                  <input type="text" placeholder="Vehículo (Ej: VW Gol) *" value={expressData.vehiculoMarca} onChange={e => updateExpress("vehiculoMarca", e.target.value)} className={inputBase} />
                </div>
              </>
            )}

            <div className="space-y-1.5 md:col-span-2">
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Asunto del Presupuesto (Para el cliente)</span>
              <input type="text" placeholder="Ej. Cambio de Kit de Distribución" value={resumen} onChange={(e) => setResumen(e.target.value)} className={inputBase} />
            </div>
            
            {editId && (
              <div className="space-y-1.5 md:col-span-2">
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Estado de Cotización</span>
                <select value={estado} onChange={(e) => setEstado(e.target.value)} className={inputBase}>
                  <option value="BORRADOR">Borrador</option>
                  <option value="ENVIADO">Enviado al Cliente</option>
                  <option value="APROBADO">Aprobado (Ganado)</option>
                  <option value="RECHAZADO">Rechazado (Perdido)</option>
                </select>
              </div>
            )}
          </div>
        </SectionCard>

        {/* 2. GRILLA DE COTIZACIÓN */}
        <SectionCard 
          title="Detalle de Costos" 
          action={<button type="button" onClick={addItem} className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white transition hover:bg-slate-800 shadow-sm dark:bg-sky-600 dark:hover:bg-sky-500">+ Agregar Ítem</button>}
        >
          <div className="space-y-3">
            <div className="hidden grid-cols-[minmax(120px,1.2fr)_2fr_0.8fr_1fr_1fr_40px] gap-3 px-2 text-xs font-bold uppercase tracking-widest text-slate-400 sm:grid">
              <span>Tipo</span><span>Descripción del repuesto/trabajo</span><span>Cant.</span><span>Precio U.</span><span>Subtotal</span><span></span>
            </div>
            
            {items.map((item) => {
              const subtotal = parseAmount(item.cantidad) * parseAmount(item.precio_unitario);
              return (
                <div key={item.id} className="relative flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm sm:grid sm:grid-cols-[minmax(120px,1.2fr)_2fr_0.8fr_1fr_1fr_40px] sm:items-center sm:p-2 dark:border-slate-700 dark:bg-slate-900/50">
                  <select value={item.tipo} onChange={(e) => updateItem(item.id, "tipo", e.target.value as ItemDraft["tipo"])} className={inputBase + " py-2 text-xs"}>
                    <option value="MANO_OBRA">Mano de Obra</option>
                    <option value="REPUESTO">Repuesto</option>
                    <option value="INSUMO">Insumo</option>
                  </select>
                  <input required type="text" placeholder="Detalle..." value={item.descripcion} onChange={(e) => updateItem(item.id, "descripcion", e.target.value)} className={inputBase + " py-2 text-xs"} />
                  <input required min="0.01" step="0.01" type="number" placeholder="Cant." value={item.cantidad} onChange={(e) => updateItem(item.id, "cantidad", e.target.value)} className={inputBase + " py-2 text-xs"} />
                  <input required min="0" step="0.01" type="number" placeholder="Precio U." value={item.precio_unitario} onChange={(e) => updateItem(item.id, "precio_unitario", e.target.value)} className={inputBase + " py-2 text-xs font-mono"} />
                  
                  <div className="flex items-center justify-between px-2 sm:justify-start">
                    <span className="text-xs font-bold sm:hidden text-slate-500">Subtotal:</span>
                    <span className="font-mono text-sm font-semibold text-slate-900 dark:text-sky-400">{formatCurrency(subtotal)}</span>
                  </div>

                  <div className="absolute right-2 top-2 sm:static sm:flex sm:justify-center">
                    {items.length > 1 && (
                      <button type="button" onClick={() => removeItem(item.id)} className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/30 transition">✕</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* BOTONERA */}
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4">
           <Link href="/presupuestos" className="w-full sm:w-auto inline-flex justify-center rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700">
            Cancelar
          </Link>
          <button type="submit" disabled={isSaving || isRedirecting || isLoading} className="w-full sm:w-auto inline-flex justify-center rounded-xl bg-sky-600 px-8 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-50">
            {isSaving ? "Guardando..." : editId ? "Actualizar Cotización" : "Crear Presupuesto"}
          </button>
        </div>
      </form>

      {/* COLUMNA LATERAL (RESUMEN EN VIVO) */}
      <aside className="space-y-6 lg:sticky lg:top-6 lg:self-start">
        <div className="rounded-2xl border border-sky-200 bg-sky-50/50 p-6 shadow-sm dark:border-sky-900/30 dark:bg-sky-900/10">
          <h3 className="mb-5 text-xs font-bold uppercase tracking-widest text-sky-600 dark:text-sky-400">Cotización Total</h3>
          
          <div className="space-y-4 border-b border-sky-200/50 pb-5 dark:border-sky-800/50">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-slate-600 dark:text-slate-400">Mano de Obra</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white">{formatCurrency(subtotalManoObra)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="font-medium text-slate-600 dark:text-slate-400">Repuestos/Insumos</span>
              <span className="font-mono font-semibold text-slate-900 dark:text-white">{formatCurrency(subtotalOtros)}</span>
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-medium text-sky-600 dark:text-sky-400">Descuento</span>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                <input type="number" min="0" step="0.01" value={descuento} onChange={(e) => setDescuento(e.target.value)} className="w-28 rounded-lg border border-sky-200 bg-white py-1.5 pl-7 pr-3 text-right font-mono text-sm font-bold text-slate-900 outline-none transition focus:border-sky-500 dark:border-sky-700 dark:bg-slate-900 dark:text-white" />
              </div>
            </div>
          </div>

          <div className="mt-5 flex items-end justify-between">
            <span className="text-xs font-bold uppercase tracking-widest text-sky-600 dark:text-sky-500">TOTAL</span>
            <span className="font-mono text-4xl font-black tracking-tight text-slate-900 dark:text-sky-400">{formatCurrency(total)}</span>
          </div>
        </div>
      </aside>
    </div>
  );
}

export default function Page() {
  return (
    <AppShell
      currentPath="/presupuestos"
      title="Nueva Cotización"
      description="Armá presupuestos rápidos con cálculo automático."
    >
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800"></div>}>
        <FormularioPresupuesto />
      </Suspense>
    </AppShell>
  );
}