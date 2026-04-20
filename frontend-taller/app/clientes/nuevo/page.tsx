"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { SectionCard } from "@/components/section-card";
import { crearCliente } from "@/lib/api";

const inputBase = "w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 transition-all focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-900/50 dark:text-white dark:focus:border-brand-500 dark:focus:bg-slate-900";

export default function NuevoClientePage() {
  const router = useRouter();

  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [dni, setDni] = useState("");

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return setError("El nombre es obligatorio.");

    setIsSaving(true);
    setError("");

    try {
      const cliente = await crearCliente({
        nombre: nombre.trim(),
        apellido: apellido.trim(),
        telefono: telefono.trim(),
        email: email.trim(),
        dni: dni.trim(),
      });

      setSuccess("¡Cliente registrado correctamente!");
      setTimeout(() => router.push(`/clientes/${cliente.id}`), 800);
    } catch (e: any) {
      setError(e.message || "Error al registrar el cliente.");
      setIsSaving(false);
    }
  }

  return (
    <AppShell
      currentPath="/clientes"
      badge="Alta de Cliente"
      title="Nuevo Cliente"
      description="Registrá un nuevo cliente en el directorio del taller."
    >
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

        <SectionCard title="Datos Personales">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Nombre *</span>
              <input
                required
                autoFocus
                type="text"
                placeholder="Ej: Juan"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className={inputBase}
              />
            </div>
            <div className="space-y-1.5">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Apellido</span>
              <input
                type="text"
                placeholder="Ej: Pérez"
                value={apellido}
                onChange={(e) => setApellido(e.target.value)}
                className={inputBase}
              />
            </div>
            <div className="space-y-1.5">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Teléfono</span>
              <input
                type="text"
                placeholder="Ej: 342-155-123456"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                className={inputBase}
              />
            </div>
            <div className="space-y-1.5">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">DNI / CUIT</span>
              <input
                type="text"
                placeholder="Ej: 30-12345678-9"
                value={dni}
                onChange={(e) => setDni(e.target.value)}
                className={inputBase}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-300">Email</span>
              <input
                type="email"
                placeholder="Ej: juan@ejemplo.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputBase}
              />
            </div>
          </div>
        </SectionCard>

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Link href="/clientes" className="inline-flex justify-center rounded-xl border border-slate-200 bg-white px-6 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
            Cancelar
          </Link>
          <button type="submit" disabled={isSaving} className="inline-flex justify-center rounded-xl bg-slate-900 px-8 py-3.5 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800 disabled:opacity-50 dark:bg-brand-600 dark:hover:bg-brand-500">
            {isSaving ? "Registrando..." : "Crear Cliente"}
          </button>
        </div>
      </form>
    </AppShell>
  );
}
