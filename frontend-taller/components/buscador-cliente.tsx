"use client";

import { useEffect, useRef, useState } from "react";
import type { Cliente } from "@/lib/types";
import { cn } from "@/lib/utils";

const input =
  "h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white";

/**
 * Buscador de clientes para los formularios: por nombre, teléfono o DNI, con
 * teclado (flechas + Enter). Elegido, queda como tarjeta con "Cambiar".
 */
export function BuscadorCliente({
  clientes,
  clienteId,
  onElegir,
  bloqueado = false,
  autoFocus = false,
  onNoEncontrado,
}: {
  clientes: Cliente[];
  clienteId: string;
  onElegir: (cliente: Cliente | null) => void;
  bloqueado?: boolean;
  autoFocus?: boolean;
  /** Si se pasa, ofrece cargar como cliente nuevo lo que se buscó. */
  onNoEncontrado?: (texto: string) => void;
}) {
  const [busqueda, setBusqueda] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [resaltado, setResaltado] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function fuera(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false);
    }
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, []);

  const elegido = clientes.find((c) => String(c.id) === clienteId) ?? null;
  const q = busqueda.trim().toLowerCase();
  const sugeridos = q
    ? clientes.filter((c) => c.nombre_completo.toLowerCase().includes(q) || (c.telefono ?? "").replace(/\D/g, "").includes(q.replace(/\D/g, "") || "~") || (c.dni ?? "").toLowerCase().includes(q)).slice(0, 8)
    : clientes.slice(0, 8);

  function elegir(c: Cliente) {
    onElegir(c);
    setBusqueda("");
    setAbierto(false);
  }

  function tecla(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") { e.preventDefault(); setAbierto(true); setResaltado((r) => Math.min(r + 1, Math.max(sugeridos.length - 1, 0))); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setResaltado((r) => Math.max(r - 1, 0)); }
    else if (e.key === "Enter" && abierto && sugeridos.length) { e.preventDefault(); elegir(sugeridos[resaltado] ?? sugeridos[0]); }
    else if (e.key === "Escape") setAbierto(false);
  }

  if (elegido) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-4 py-3 dark:bg-slate-900/50">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700 dark:bg-brand-950/50 dark:text-brand-300">{elegido.nombre_completo.charAt(0)}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-slate-900 dark:text-white">{elegido.nombre_completo}</p>
          <p className="truncate text-xs text-slate-500 dark:text-slate-400">{elegido.telefono || "Sin teléfono cargado"}</p>
        </div>
        {!bloqueado && (
          <button
            type="button"
            onClick={() => { onElegir(null); setAbierto(true); window.setTimeout(() => inputRef.current?.focus(), 0); }}
            className="shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-semibold text-brand-700 transition hover:bg-brand-50 dark:text-brand-300 dark:hover:bg-brand-950/30"
          >
            Cambiar
          </button>
        )}
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" /></svg>
      <input
        ref={inputRef}
        autoFocus={autoFocus}
        value={busqueda}
        onChange={(e) => { setBusqueda(e.target.value); setAbierto(true); setResaltado(0); }}
        // No se abre al recibir el foco (el cursor arranca acá y taparía el
        // formulario): sólo al escribir, hacer clic o bajar con la flecha.
        onClick={() => setAbierto(true)}
        onKeyDown={tecla}
        placeholder="Escribí el nombre o el teléfono…"
        role="combobox"
        aria-expanded={abierto}
        aria-controls="lista-buscador-cliente"
        aria-label="Buscar cliente"
        autoComplete="off"
        className={input}
      />
      {abierto && (
        <div id="lista-buscador-cliente" role="listbox" className="absolute inset-x-0 top-full z-40 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
          {sugeridos.length === 0 ? (
            <div className="px-4 py-5 text-center">
              <p className="text-sm text-slate-500">No encontramos a &quot;{busqueda}&quot;.</p>
              {onNoEncontrado && (
                <button type="button" onClick={() => { onNoEncontrado(busqueda); setAbierto(false); }} className="mt-2 text-sm font-semibold text-brand-700 hover:text-brand-800 dark:text-brand-300">
                  Cargarlo como cliente nuevo →
                </button>
              )}
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
                    onMouseDown={(e) => { e.preventDefault(); elegir(c); }}
                    className={cn("flex w-full items-center gap-3 px-4 py-2.5 text-left transition", i === resaltado && "bg-slate-50 dark:bg-slate-800")}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">{c.nombre_completo.charAt(0)}</span>
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
  );
}

/** Tarjetas para elegir el auto del cliente (con uno solo, ya queda elegido). */
export function ElegirVehiculo({
  vehiculos,
  vehiculoId,
  onElegir,
  bloqueado = false,
}: {
  vehiculos: { id: number; patente: string; marca: string; modelo: string; anio: number | null }[];
  vehiculoId: string;
  onElegir: (id: string) => void;
  bloqueado?: boolean;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {vehiculos.map((v) => {
        const elegido = String(v.id) === vehiculoId;
        return (
          <button
            key={v.id}
            type="button"
            disabled={bloqueado}
            onClick={() => onElegir(String(v.id))}
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
  );
}
