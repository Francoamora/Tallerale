"use client";

import { useEffect, useState, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { getClientes, getVehiculos, crearTurno, editarTurno, getTurnoById } from "@/lib/api";
import type { Cliente, Vehiculo } from "@/lib/types";
import { cn } from "@/lib/utils";

// Estilo base unificado para los inputs
const inputBase = "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 transition-all focus:border-purple-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-purple-500/10 dark:border-slate-700 dark:bg-slate-900/50 dark:text-white dark:focus:border-purple-500 dark:focus:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed";

// Hacemos un componente interno para poder usar useSearchParams (requiere Suspense)
function FormularioTurno() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editId = searchParams.get("id"); // Si hay ID, estamos en modo Edición

  // --- ESTADOS DE DIRECTORIO ---
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [vehiculosFiltrados, setVehiculosFiltrados] = useState<Vehiculo[]>([]);

  // --- MODOS DE UI ---
  const [modoCliente, setModoCliente] = useState<"DIRECTORIO" | "EXPRESS">("DIRECTORIO");
  
  // --- ESTADOS DEL FORMULARIO ---
  const [fechaHora, setFechaHora] = useState("");
  const [motivo, setMotivo] = useState("");
  const [notas, setNotas] = useState("");
  
  // Selección de Directorio
  const [clienteSeleccionadoId, setClienteSeleccionadoId] = useState("");
  const [vehiculoSeleccionadoId, setVehiculoSeleccionadoId] = useState("");
  
  // Alta Express
  const [expressNombre, setExpressNombre] = useState("");
  const [expressTelefono, setExpressTelefono] = useState("");
  const [expressPatente, setExpressPatente] = useState("");
  const [expressMarca, setExpressMarca] = useState("");

  // --- FEEDBACK Y CARGA ---
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isRedirecting, startRedirect] = useTransition();
  const [feedback, setFeedback] = useState({ tone: "idle", message: "" });

  // 1. CARGA INICIAL (Directorio y Modo Edición)
  useEffect(() => {
    let active = true;
    async function init() {
      try {
        const [clientesData, vehiculosData] = await Promise.all([
          getClientes(),
          getVehiculos()
        ]);
        
        if (active) {
          setClientes(clientesData);
          setVehiculos(vehiculosData);
        }

        // Si estamos editando, traemos los datos del turno y pre-cargamos
        if (editId && active) {
          const turno = await getTurnoById(Number(editId));
          
          // Formateamos la fecha para el input datetime-local (YYYY-MM-DDThh:mm)
          const dateObj = new Date(turno.fecha_hora);
          const isoString = new Date(dateObj.getTime() - (dateObj.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);
          
          setFechaHora(isoString);
          setMotivo(turno.motivo);
          setNotas(turno.notas || "");

          // Como el endpoint getTurnoById actualmente no devuelve el ID crudo del cliente/vehiculo (devuelve strings), 
          // lo buscamos en el directorio haciendo match por nombre/patente para pre-seleccionarlo.
          const clienteMatch = clientesData.find(c => turno.cliente_nombre?.includes(c.nombre));
          if (clienteMatch) {
            setClienteSeleccionadoId(clienteMatch.id.toString());
            const vehiculosDelCliente = vehiculosData.filter(v => v.cliente_id === clienteMatch.id);
            setVehiculosFiltrados(vehiculosDelCliente);
            
            const vehiculoMatch = vehiculosDelCliente.find(v => turno.vehiculo_desc?.includes(v.patente) || turno.patente === v.patente);
            if (vehiculoMatch) setVehiculoSeleccionadoId(vehiculoMatch.id.toString());
          }
        }
      } catch (err) {
        if (active) setFeedback({ tone: "error", message: "Error al cargar datos del servidor." });
      } finally {
        if (active) setIsLoading(false);
      }
    }
    init();
    return () => { active = false; };
  }, [editId]);

  // 2. LÓGICA DE CASCADA (Al elegir un cliente, mostrar solo sus autos)
  function handleClienteChange(idString: string) {
    setClienteSeleccionadoId(idString);
    setVehiculoSeleccionadoId(""); // Reseteamos el auto al cambiar de dueño
    
    if (!idString) {
      setVehiculosFiltrados([]);
      return;
    }
    
    const filtrados = vehiculos.filter(v => v.cliente_id === Number(idString));
    setVehiculosFiltrados(filtrados);
  }

  // 3. ENVÍO DEL FORMULARIO (Crear o Editar)
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFeedback({ tone: "idle", message: "" });

    // Validaciones Front-end
    if (!fechaHora) return setFeedback({ tone: "error", message: "La fecha y hora son obligatorias." });
    if (!motivo.trim()) return setFeedback({ tone: "error", message: "El motivo del turno es obligatorio." });
    
    if (modoCliente === "DIRECTORIO" && !editId) {
      if (!clienteSeleccionadoId) return setFeedback({ tone: "error", message: "Selecciona un cliente del directorio." });
      if (!vehiculoSeleccionadoId) return setFeedback({ tone: "error", message: "Selecciona el vehículo del cliente." });
    } else if (modoCliente === "EXPRESS" && !editId) {
      if (!expressNombre.trim() || !expressPatente.trim() || !expressMarca.trim()) {
        return setFeedback({ tone: "error", message: "Completá Nombre, Patente y Vehículo en el Alta Express." });
      }
    }

    setIsSaving(true);

    // Construimos el Payload (Lo que espera la API)
    const isoDate = new Date(fechaHora).toISOString();
    const payload = {
      fecha_hora: isoDate,
      motivo: motivo.trim(),
      notas: notas.trim(),
      
      // Dependiendo del modo, mandamos IDs o los datos Express (solo si no estamos editando)
      cliente_id: (modoCliente === "DIRECTORIO" || editId) ? Number(clienteSeleccionadoId) : undefined,
      vehiculo_id: (modoCliente === "DIRECTORIO" || editId) ? Number(vehiculoSeleccionadoId) : undefined,
      cliente_express: (modoCliente === "EXPRESS" && !editId) ? { nombre: expressNombre.trim(), telefono: expressTelefono.trim() } : undefined,
      vehiculo_express: (modoCliente === "EXPRESS" && !editId) ? { patente: expressPatente.trim().toUpperCase(), marca: expressMarca.trim() } : undefined,
    };

    try {
      if (editId) {
        await editarTurno(Number(editId), payload);
        setFeedback({ tone: "success", message: "¡Turno actualizado correctamente!" });
      } else {
        await crearTurno(payload);
        setFeedback({ tone: "success", message: "¡Turno agendado con éxito!" });
      }
      
      // Redirección fluida a la agenda
      startRedirect(() => { 
        router.push("/turnos"); 
        router.refresh(); 
      });

    } catch (error: any) {
      setFeedback({ tone: "error", message: error.message || "Ocurrió un error en el servidor." });
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return <div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800"></div>;
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {feedback.message && (
        <div className={cn("rounded-xl border p-4 text-sm font-medium", feedback.tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-800 dark:text-emerald-300" : "border-red-200 bg-red-50 text-red-800 dark:bg-red-900/30 dark:border-red-800 dark:text-red-300")}>
          {feedback.message}
        </div>
      )}

      {/* BLOQUE 1: DATOS DEL CLIENTE Y VEHÍCULO */}
      <SectionCard title="Vehículo y Titular" description="¿A quién le vamos a reservar el espacio?">
        
        {/* Switch Directorio vs Express (Oculto en modo edición por seguridad) */}
        {!editId && (
          <div className="mb-6 flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800/50 w-full sm:w-fit">
            <button type="button" onClick={() => setModoCliente("DIRECTORIO")} className={cn("flex-1 sm:px-6 rounded-lg py-2 text-sm font-bold transition-all", modoCliente === "DIRECTORIO" ? "bg-white text-purple-600 shadow-sm dark:bg-slate-700 dark:text-purple-400" : "text-slate-500 hover:text-slate-700 dark:text-slate-400")}>
              Buscar en Directorio
            </button>
            <button type="button" onClick={() => setModoCliente("EXPRESS")} className={cn("flex-1 sm:px-6 rounded-lg py-2 text-sm font-bold transition-all", modoCliente === "EXPRESS" ? "bg-white text-purple-600 shadow-sm dark:bg-slate-700 dark:text-purple-400" : "text-slate-500 hover:text-slate-700 dark:text-slate-400")}>
              ⚡ Alta Express
            </button>
          </div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {modoCliente === "DIRECTORIO" || editId ? (
            <>
              <label className="space-y-1.5">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Cliente Titular</span>
                <select value={clienteSeleccionadoId} onChange={(e) => handleClienteChange(e.target.value)} disabled={!!editId} className={inputBase}>
                  <option value="">Seleccione un cliente...</option>
                  {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre_completo}</option>)}
                </select>
              </label>

              <label className="space-y-1.5">
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Vehículo a Ingresar</span>
                <select disabled={!clienteSeleccionadoId || !!editId} value={vehiculoSeleccionadoId} onChange={(e) => setVehiculoSeleccionadoId(e.target.value)} className={inputBase}>
                  <option value="">{clienteSeleccionadoId ? "Seleccione un vehículo..." : "Primero elija un cliente"}</option>
                  {vehiculosFiltrados.map(v => <option key={v.id} value={v.id}>{v.patente} - {v.marca} {v.modelo}</option>)}
                </select>
              </label>
            </>
          ) : (
            <>
              {/* CAMPOS ALTA EXPRESS OPTIMIZADOS */}
              <div className="space-y-4 rounded-2xl border border-purple-200 bg-purple-50/50 p-5 dark:border-purple-900/30 dark:bg-purple-900/10">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400">Datos Personales</h4>
                <div className="space-y-3">
                  <input type="text" placeholder="Nombre y Apellido *" value={expressNombre} onChange={e => setExpressNombre(e.target.value)} className={inputBase} />
                  <input type="text" placeholder="Teléfono de Contacto (Opcional)" value={expressTelefono} onChange={e => setExpressTelefono(e.target.value)} className={inputBase} />
                </div>
              </div>
              
              <div className="space-y-4 rounded-2xl border border-purple-200 bg-purple-50/50 p-5 dark:border-purple-900/30 dark:bg-purple-900/10">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-purple-600 dark:text-purple-400">Datos del Auto</h4>
                <div className="space-y-3">
                  <input type="text" placeholder="Patente (Ej: AB123CD) *" value={expressPatente} onChange={e => setExpressPatente(e.target.value.toUpperCase())} className={cn(inputBase, "font-mono font-bold uppercase")} />
                  <input type="text" placeholder="Vehículo (Ej: VW Gol Trend) *" value={expressMarca} onChange={e => setExpressMarca(e.target.value)} className={inputBase} />
                </div>
              </div>
            </>
          )}
        </div>
      </SectionCard>

      {/* BLOQUE 2: DETALLES DEL TURNO */}
      <SectionCard title="Agenda y Motivo" description="Fecha, hora y razón del ingreso.">
        <div className="grid gap-6 md:grid-cols-2">
          
          <label className="space-y-1.5 md:col-span-2">
            <span className="text-sm font-bold text-purple-700 dark:text-purple-400">Fecha y Hora de Recepción</span>
            <input type="datetime-local" required value={fechaHora} onChange={(e) => setFechaHora(e.target.value)} className={cn(inputBase, "border-purple-200 bg-purple-50 text-lg font-black text-purple-900 dark:border-purple-900/50 dark:bg-purple-900/20 dark:text-purple-300")} />
          </label>

          <label className="space-y-1.5 md:col-span-2">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Motivo Principal (Breve)</span>
            <input type="text" required placeholder="Ej: Cambio de aceite y filtros / Ruidito en tren delantero..." value={motivo} onChange={(e) => setMotivo(e.target.value)} className={inputBase} />
          </label>

          <label className="space-y-1.5 md:col-span-2">
            <span className="text-sm font-medium text-slate-600 dark:text-slate-400">Notas Privadas / Observaciones extras</span>
            <textarea placeholder="Ej: El cliente dice que lo necesita para el viernes sin falta..." value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} className={cn(inputBase, "resize-none")} />
          </label>

        </div>
      </SectionCard>

      {/* BOTONERA FINAL */}
      <div className="flex flex-col-reverse sm:flex-row items-center justify-end gap-4 border-t border-slate-200 pt-6 dark:border-slate-800">
        <Link href="/turnos" className="w-full sm:w-auto text-center rounded-xl px-6 py-3.5 text-sm font-bold text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-white transition">
          Cancelar
        </Link>
        <button type="submit" disabled={isSaving || isRedirecting} className="w-full sm:w-auto inline-flex min-w-[160px] items-center justify-center rounded-xl bg-purple-600 px-8 py-3.5 text-sm font-bold text-white shadow-md transition-all hover:bg-purple-700 hover:shadow-lg disabled:opacity-50">
          {isSaving ? "Guardando..." : isRedirecting ? "Redirigiendo..." : editId ? "Actualizar Turno" : "Confirmar Turno"}
        </button>
      </div>

    </form>
  );
}

export default function NuevoTurnoPage() {
  return (
    <AppShell
      currentPath="/turnos"
      badge="Formulario de Agenda"
      title="Gestión de Cita"
      description="Completá los datos para reservar un espacio en el taller."
    >
      <div className="mx-auto max-w-3xl">
        <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800"></div>}>
          <FormularioTurno />
        </Suspense>
      </div>
    </AppShell>
  );
}