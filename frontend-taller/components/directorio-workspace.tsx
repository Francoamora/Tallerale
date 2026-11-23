"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { FichaCliente } from "@/components/ficha-cliente";
import { getClientes, getVehiculos } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { Cliente, Vehiculo } from "@/lib/types";
import { cn } from "@/lib/utils";

type Filtro = "TODOS" | "DEUDA" | "SERVICE";
type Orden = "nombre" | "deuda";
type EstadoService = "VENCIDO" | "PROXIMO" | "AL_DIA" | "SIN_DATOS";

function normalizar(valor: string) {
  return valor.toLocaleLowerCase("es-AR").normalize("NFD").replace(/\p{Diacritic}/gu, "");
}

function estadoService(vehiculo: Vehiculo): EstadoService {
  if (!vehiculo.proximo_service_km) return "SIN_DATOS";
  const faltan = vehiculo.proximo_service_km - vehiculo.kilometraje_actual;
  if (faltan < 0) return "VENCIDO";
  if (faltan <= 1500) return "PROXIMO";
  return "AL_DIA";
}

/** El peor estado de service entre los autos del cliente. */
function peorService(autos: Vehiculo[]): EstadoService {
  const estados = autos.map(estadoService);
  if (estados.includes("VENCIDO")) return "VENCIDO";
  if (estados.includes("PROXIMO")) return "PROXIMO";
  if (estados.includes("AL_DIA")) return "AL_DIA";
  return "SIN_DATOS";
}

const PUNTO_SERVICE: Record<EstadoService, { clase: string; texto: string } | null> = {
  VENCIDO: { clase: "bg-red-500", texto: "Service vencido" },
  PROXIMO: { clase: "bg-amber-500", texto: "Service próximo" },
  AL_DIA: null,
  SIN_DATOS: null,
};

/** Lee y escribe el cliente elegido en la dirección (?id=12) sin recargar. */
function leerIdDeLaUrl(): number | null {
  const id = Number(new URLSearchParams(window.location.search).get("id"));
  return Number.isFinite(id) && id > 0 ? id : null;
}
function escribirIdEnLaUrl(id: number | null) {
  const url = new URL(window.location.href);
  if (id) url.searchParams.set("id", String(id));
  else url.searchParams.delete("id");
  window.history.replaceState(null, "", url);
}

/**
 * Clientes: lista a la izquierda y ficha del elegido a la derecha. En el
 * celular se ve una cosa por vez (lista, o ficha con "← Volver").
 */
export function DirectorioWorkspace() {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("TODOS");
  const [orden, setOrden] = useState<Orden>("nombre");
  const [elegido, setElegido] = useState<number | null>(null);
  // En el celular la ficha reemplaza a la lista sólo si el usuario eligió.
  const [fichaAbiertaEnCelular, setFichaAbiertaEnCelular] = useState(false);

  useEffect(() => {
    let active = true;
    const desdeUrl = leerIdDeLaUrl();
    if (desdeUrl) {
      setElegido(desdeUrl);
      setFichaAbiertaEnCelular(true);
    }
    async function cargar() {
      try {
        setLoading(true);
        const [clientesData, vehiculosData] = await Promise.all([getClientes(), getVehiculos()]);
        if (!active) return;
        setClientes(clientesData);
        setVehiculos(vehiculosData);
      } catch (caught) {
        if (!active) return;
        setError(caught instanceof Error ? caught.message : "No pudimos cargar los clientes.");
      } finally {
        if (active) setLoading(false);
      }
    }
    cargar();
    return () => { active = false; };
  }, []);

  const vehiculosPorCliente = useMemo(() => {
    const agrupados = new Map<number, Vehiculo[]>();
    for (const vehiculo of vehiculos) {
      agrupados.set(vehiculo.cliente_id, [...(agrupados.get(vehiculo.cliente_id) ?? []), vehiculo]);
    }
    return agrupados;
  }, [vehiculos]);

  const termino = normalizar(busqueda.trim());
  const visibles = useMemo(() => {
    const lista = clientes.filter((cliente) => {
      const autos = vehiculosPorCliente.get(cliente.id) ?? [];
      if (filtro === "DEUDA" && Number(cliente.saldo_balance) <= 0) return false;
      if (filtro === "SERVICE" && !["VENCIDO", "PROXIMO"].includes(peorService(autos))) return false;
      if (!termino) return true;
      return normalizar([
        cliente.nombre_completo, cliente.telefono, cliente.email, cliente.dni ?? "",
        ...autos.flatMap((auto) => [auto.patente, auto.marca, auto.modelo, auto.color]),
      ].join(" ")).includes(termino);
    });
    return lista.sort((a, b) =>
      orden === "deuda"
        ? Number(b.saldo_balance) - Number(a.saldo_balance) || a.nombre_completo.localeCompare(b.nombre_completo)
        : a.nombre_completo.localeCompare(b.nombre_completo),
    );
  }, [clientes, vehiculosPorCliente, filtro, termino, orden]);

  // En pantallas anchas, si no hay nadie elegido, se muestra el primero.
  const activo = elegido ?? visibles[0]?.id ?? null;

  const elegir = useCallback((id: number) => {
    setElegido(id);
    setFichaAbiertaEnCelular(true);
    escribirIdEnLaUrl(id);
    // En el celular la ficha reemplaza a la lista: arrancar desde arriba.
    if (window.matchMedia("(max-width: 1023px)").matches) window.scrollTo({ top: 0 });
  }, []);

  function volverALaLista() {
    setFichaAbiertaEnCelular(false);
    escribirIdEnLaUrl(null);
  }

  const conDeuda = clientes.filter((c) => Number(c.saldo_balance) > 0);
  const deudaTotal = conDeuda.reduce((total, c) => total + Number(c.saldo_balance), 0);
  const conService = clientes.filter((c) => ["VENCIDO", "PROXIMO"].includes(peorService(vehiculosPorCliente.get(c.id) ?? []))).length;

  return (
    <AppShell
      currentPath="/clientes"
      compact
      badge="Directorio"
      title="Clientes y vehículos"
      description={loading ? "Cada cliente con sus autos, su cuenta y su historial." : `${clientes.length} clientes · ${vehiculos.length} vehículos · ${formatCurrency(deudaTotal)} por cobrar`}
      actions={
        <Link href="/clientes/nuevo" className="inline-flex h-9 items-center rounded-xl bg-brand-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700">
          + Cliente y vehículo
        </Link>
      }
    >
      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{error}</div>
      ) : (
        <div className="grid items-start gap-4 lg:grid-cols-[340px_minmax(0,1fr)]">
          {/* ── Lista ── */}
          <aside
            className={cn(
              "flex min-w-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 lg:sticky lg:top-20 lg:max-h-[calc(100dvh-6.5rem)]",
              fichaAbiertaEnCelular && "max-lg:hidden",
            )}
            aria-label="Lista de clientes"
          >
            <div className="space-y-2.5 border-b border-slate-100 p-3 dark:border-slate-700">
              <div className="relative">
                <svg className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" /></svg>
                <input
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Nombre, patente o teléfono…"
                  aria-label="Buscar clientes"
                  className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:bg-white focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </div>
              <div className="flex items-center justify-between gap-2">
                <div className="flex gap-1" role="toolbar" aria-label="Filtrar">
                  {([["TODOS", "Todos", clientes.length], ["DEUDA", "Deben", conDeuda.length], ["SERVICE", "Service", conService]] as const).map(([valor, texto, cantidad]) => (
                    <button
                      key={valor}
                      type="button"
                      onClick={() => setFiltro(valor)}
                      aria-pressed={filtro === valor}
                      className={cn(
                        "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition",
                        filtro === valor ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700",
                      )}
                    >
                      {texto}
                      <span className={cn("text-[11px] tabular-nums", filtro === valor ? "opacity-70" : "text-slate-400")}>{cantidad}</span>
                    </button>
                  ))}
                </div>
                <label className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                  <span className="sr-only">Ordenar por</span>
                  <select
                    value={orden}
                    onChange={(e) => setOrden(e.target.value as Orden)}
                    className="h-7 rounded-lg border-0 bg-transparent pr-6 text-xs font-semibold text-slate-600 outline-none focus:ring-2 focus:ring-brand-500/30 dark:text-slate-300"
                  >
                    <option value="nombre">A–Z</option>
                    <option value="deuda">Mayor deuda</option>
                  </select>
                </label>
              </div>
            </div>

            <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-700/60">
              {loading ? (
                [1, 2, 3, 4, 5].map((i) => <li key={i} className="h-16 animate-pulse bg-slate-50 dark:bg-slate-800/60" />)
              ) : visibles.length === 0 ? (
                <li className="px-4 py-10 text-center text-sm text-slate-500">
                  No hay clientes con ese criterio.
                  <Link href="/clientes/nuevo" className="mt-2 block font-semibold text-brand-600">Cargar un cliente →</Link>
                </li>
              ) : (
                visibles.map((cliente) => (
                  <FilaCliente
                    key={cliente.id}
                    cliente={cliente}
                    autos={vehiculosPorCliente.get(cliente.id) ?? []}
                    activo={cliente.id === activo}
                    porDefecto={elegido === null}
                    onElegir={() => elegir(cliente.id)}
                  />
                ))
              )}
            </ul>
            {!loading && visibles.length > 0 && (
              <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500 dark:border-slate-700 dark:text-slate-400">
                {visibles.length} de {clientes.length} clientes
              </p>
            )}
          </aside>

          {/* ── Ficha ── */}
          <section className={cn("min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800 sm:p-6", !fichaAbiertaEnCelular && "max-lg:hidden")} aria-live="polite">
            <button type="button" onClick={volverALaLista} className="mb-4 text-sm font-semibold text-brand-600 hover:text-brand-700 lg:hidden">
              ← Volver a clientes
            </button>
            {activo ? (
              <FichaCliente
                key={activo}
                clienteId={activo}
                variante="panel"
                onCambio={(actualizado) => setClientes((lista) => lista.map((c) => (c.id === actualizado.id ? actualizado : c)))}
              />
            ) : loading ? (
              <div className="flex h-[40vh] items-center justify-center">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-slate-200 border-t-brand-600" />
              </div>
            ) : (
              <div className="flex h-[40vh] flex-col items-center justify-center text-center">
                <p className="font-semibold text-slate-700 dark:text-slate-200">Todavía no hay clientes cargados.</p>
                <Link href="/clientes/nuevo" className="mt-3 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white">Cargar el primero</Link>
              </div>
            )}
          </section>
        </div>
      )}
    </AppShell>
  );
}

function FilaCliente({ cliente, autos, activo, porDefecto, onElegir }: { cliente: Cliente; autos: Vehiculo[]; activo: boolean; porDefecto: boolean; onElegir: () => void }) {
  const router = useRouter();
  // Sin elección, el primero sólo se resalta en pantallas anchas (es el que
  // se ve a la derecha); en el celular todavía no hay ficha abierta.
  const fondo = "bg-brand-100 dark:bg-brand-900/40";
  const resaltado = activo && porDefecto ? "lg:bg-brand-100 lg:dark:bg-brand-900/40" : fondo;
  const saldo = Number(cliente.saldo_balance);
  const punto = PUNTO_SERVICE[peorService(autos)];
  return (
    <li>
      {/* Un clic: la ficha a la derecha. Doble clic: la página del cliente a
          pantalla completa. Es un link de verdad, así que Cmd/Ctrl + clic o la
          ruedita la abren en otra pestaña. */}
      <a
        href={`/clientes/${cliente.id}`}
        onClick={(e) => {
          if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
          e.preventDefault();
          onElegir();
        }}
        onDoubleClick={() => router.push(`/clientes/${cliente.id}`)}
        aria-current={activo ? "true" : undefined}
        className={cn(
          "relative block w-full px-4 py-3 text-left transition",
          activo ? resaltado : "hover:bg-slate-50 dark:hover:bg-slate-700/30",
        )}
      >
        <span className="flex items-center justify-between gap-3">
          <span className="flex min-w-0 items-center gap-2">
            <span className={cn("truncate text-sm font-semibold", activo ? "text-slate-900 dark:text-white" : "text-slate-800 dark:text-slate-100")}>{cliente.nombre_completo}</span>
            {punto && <span className={cn("h-2 w-2 shrink-0 rounded-full", punto.clase)} title={punto.texto} aria-label={punto.texto} />}
          </span>
          {saldo > 0 && <span className="shrink-0 text-xs font-semibold tabular-nums text-red-600 dark:text-red-400">{formatCurrency(saldo)}</span>}
        </span>
        <span className="mt-1 flex items-center gap-1.5 overflow-hidden">
          {autos.length === 0 ? (
            <span className="text-xs text-slate-400">Sin vehículos</span>
          ) : (
            <>
              {autos.slice(0, 2).map((auto) => (
                <span key={auto.id} className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  {auto.patente}
                </span>
              ))}
              {autos.length > 2 ? (
                <span className="text-[11px] text-slate-500">+{autos.length - 2}</span>
              ) : (
                autos.length === 1 && <span className="truncate text-xs text-slate-500 dark:text-slate-400">{autos[0].marca} {autos[0].modelo}</span>
              )}
            </>
          )}
        </span>
      </a>
    </li>
  );
}
