"use client";

import { use, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { AccionesCliente, FichaCliente } from "@/components/ficha-cliente";
import type { Cliente } from "@/lib/types";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default function PerfilCliente({ params }: PageProps) {
  const resolvedParams = use(params);
  const clienteId = Number(resolvedParams.id);
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [error, setError] = useState("");

  return (
    <AppShell
      currentPath="/clientes"
      compact
      badge="Cliente"
      title={cliente?.nombre_completo ?? (error ? "Cliente no encontrado" : "Cargando cliente…")}
      description={
        cliente
          ? [cliente.telefono, cliente.email, cliente.dni && `DNI/CUIT ${cliente.dni}`].filter(Boolean).join(" · ") || "Sin datos de contacto cargados"
          : error || "Recopilando historial y facturación."
      }
      actions={cliente ? <AccionesCliente cliente={cliente} /> : <Link href="/clientes" className="text-sm font-semibold text-brand-600">← Volver a clientes</Link>}
    >
      <FichaCliente clienteId={clienteId} onCliente={setCliente} onCambio={setCliente} onError={setError} />
    </AppShell>
  );
}
