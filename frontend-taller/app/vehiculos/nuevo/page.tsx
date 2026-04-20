"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { getClientes, getClienteById, crearVehiculo } from "@/lib/api";
import type { Cliente } from "@/lib/types";
import { cn } from "@/lib/utils";

const inputBase = "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 transition-all focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-900/50 dark:text-white dark:focus:border-brand-500 dark:focus:bg-slate-900 disabled:opacity-50 disabled:cursor-not-allowed";

function FormularioVehiculo() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const clientePreId = searchParams.get("cliente");

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [clienteId, setClienteId] = useState(clientePreId || "");
  const [clienteNombre, setClienteNombre] = useState("");
  const [patente, setPatente] = useState("");
  const [marca, setMarca] = useState("");
  const [modelo, setModelo] = useState("");
  const [anio, setAnio] = useState("");
  const [color, setColor] = useState("");
  const [kilometraje, setKilometraje] = useState("0");
  const [proximoServiceKm, setProximoServiceKm] = useState("");

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function init() {
      try {
        setIsLoading(true);
        const clientesData = await getClientes();
        setClientes(clientesData);

        if (clientePreId) {
          const c = clientesData.find(c => c.id === Number(clientePreId));
          if (c) setClienteNombre(c.nombre_completo);
        }
      } catch (e) {
        setError("Error cargando datos. Recargá la página.");
      } finally {
        setIsLoading(false);
      }
    }
    init();
  }, [clientePreId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clienteId) return setError("Seleccioná un cliente titular.");
    if (!patente.trim()) return setError("La patente es obligatoria.");
    if (!marca.trim()) return setError("La marca es obligatoria.");

    setIsSaving(true);
    setError("");

    try {
      await crearVehiculo({
        cliente_id: Number(clienteId),
        patente: patente.trim().toUpperCase(),
        marca: marca.trim(),
        modelo: modelo.trim() || "S/D",
        anio: anio ? Number(anio) : null,
        color: color.trim(),
        kilometraje_actual: Number(kilometraje) || 0,
        proximo_service_km: proximoServiceKm ? Number(proximoServiceKm) : null,
      });

      setSuccess("¡Vehículo registrado correctamente!");
      setTimeout(() => {
        router.push(clientePreId ? `/clientes/${clientePreId}` : "/vehiculos");
      }, 1000);
    } catch (e: any) {
      setError(e.message || "Error al registrar el vehículo.");
      setIsSaving(false);
    }
  }

  if (isLoading) return <div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />;

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl space-y-6">
      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800 dark:border-red-800 dark:bg-red-900/30 dark:text-red-300">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300">
          {success}
        </div>
      )}

      <SectionCard title="Titular del Vehículo">
        <div className="space-y-1.5">
          <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Cliente Propietario *</span>
          {clientePreId && clienteNombre ? (
            <div className="flex items-center gap-3 rounded-xl border border-brand-200 bg-brand-50 px-4 py-3 dark:border-brand-900/30 dark:bg-brand-900/10">
              <span className="font-bold text-brand-700 dark:text-brand-400">{clienteNombre}</span>
              <Link href={`/vehiculos/nuevo`} className="ml-auto text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline">
                Cambiar
              </Link>
            </div>
          ) : (
            <select required value={clienteId} onChange={(e) => setClienteId(e.target.value)} className={inputBase}>
              <option value="">Seleccionar cliente del directorio...</option>
              {clientes.map(c => <option key={c.id} value={c.id}>{c.nombre_completo}</option>)}
            </select>
          )}
        </div>
      </SectionCard>

      <SectionCard title="Datos del Vehículo">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Patente *</span>
            <input
              required
              type="text"
              placeholder="Ej: AB123CD"
              value={patente}
              onChange={(e) => setPatente(e.target.value.toUpperCase())}
              className={cn(inputBase, "font-mono font-bold uppercase tracking-widest")}
              maxLength={8}
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Marca *</span>
            <input required type="text" placeholder="Ej: Toyota" value={marca} onChange={(e) => setMarca(e.target.value)} className={inputBase} />
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Modelo</span>
            <input type="text" placeholder="Ej: Corolla" value={modelo} onChange={(e) => setModelo(e.target.value)} className={inputBase} />
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Año</span>
            <input type="number" placeholder="Ej: 2018" value={anio} onChange={(e) => setAnio(e.target.value)} min={1950} max={2030} className={inputBase} />
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Color</span>
            <input type="text" placeholder="Ej: Blanco" value={color} onChange={(e) => setColor(e.target.value)} className={inputBase} />
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Kilometraje y Service">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Kilometraje Actual</span>
            <input type="number" placeholder="Ej: 85000" value={kilometraje} onChange={(e) => setKilometraje(e.target.value)} min={0} className={inputBase} />
          </div>
          <div className="space-y-1.5">
            <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Próximo Service (km)</span>
            <input type="number" placeholder="Ej: 90000" value={proximoServiceKm} onChange={(e) => setProximoServiceKm(e.target.value)} min={0} className={inputBase} />
          </div>
        </div>
      </SectionCard>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Link href={clientePreId ? `/clientes/${clientePreId}` : "/vehiculos"} className="inline-flex justify-center rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          Cancelar
        </Link>
        <button type="submit" disabled={isSaving} className="inline-flex justify-center rounded-xl bg-slate-900 px-8 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500">
          {isSaving ? "Registrando..." : "Registrar Vehículo"}
        </button>
      </div>
    </form>
  );
}

export default function NuevoVehiculoPage() {
  return (
    <AppShell
      currentPath="/vehiculos"
      badge="Alta de Vehículo"
      title="Registrar Vehículo"
      description="Agregá un nuevo auto al sistema asociado a un cliente titular."
    >
      <Suspense fallback={<div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />}>
        <FormularioVehiculo />
      </Suspense>
    </AppShell>
  );
}
