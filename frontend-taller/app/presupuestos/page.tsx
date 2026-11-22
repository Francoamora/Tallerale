"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { Patente } from "@/components/patente";
import { actualizarEstadoPresupuesto, eliminarPresupuesto, getPresupuestos, renovarPortalPresupuesto } from "@/lib/api";
import { formatCurrency } from "@/lib/format";
import type { Presupuesto } from "@/lib/types";
import { cn } from "@/lib/utils";
import { numeroPresupuesto } from "@/lib/documentos";
import { buildWhatsAppUrl, normalizeWhatsAppPhone } from "@/lib/whatsapp";
import { copiarAlPortapapeles } from "@/lib/portapapeles";

/** Validez que se le informa al cliente (la misma del link y del PDF). */
const VALIDEZ_DIAS = 15;
const DIA = 86_400_000;

const FILTROS = [
  { value: "TODOS", label: "Todos" },
  { value: "ENVIADO", label: "Esperando respuesta" },
  { value: "BORRADOR", label: "Borradores" },
  { value: "APROBADO", label: "Aprobados" },
  { value: "RECHAZADO", label: "Rechazados" },
] as const;
type Filtro = (typeof FILTROS)[number]["value"];

const ESTADO: Record<string, { label: string; clase: string }> = {
  BORRADOR: { label: "Borrador", clase: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700" },
  ENVIADO: { label: "Esperando respuesta", clase: "bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900" },
  APROBADO: { label: "Aprobado", clase: "bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900" },
  RECHAZADO: { label: "Rechazado", clase: "bg-red-50 text-red-700 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900" },
};

/** Días que faltan para que venza (negativo si ya venció). */
function diasParaVencer(p: Presupuesto) {
  const vence = new Date(p.fecha_creacion).getTime() + VALIDEZ_DIAS * DIA;
  return Math.ceil((vence - Date.now()) / DIA);
}

const abierto = (p: Presupuesto) => p.estado === "BORRADOR" || p.estado === "ENVIADO";

const COLUMNAS = "xl:grid-cols-[84px_minmax(190px,1.1fr)_minmax(170px,1.2fr)_150px_170px_120px_230px] xl:items-center xl:gap-4";

export default function ListadoPresupuestos() {
  const [presupuestos, setPresupuestos] = useState<Presupuesto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [filtro, setFiltro] = useState<Filtro>("TODOS");
  const [idABorrar, setIdABorrar] = useState<number | null>(null);
  const [aviso, setAviso] = useState("");
  const [menuId, setMenuId] = useState<number | null>(null);
  const [origen, setOrigen] = useState("");

  useEffect(() => {
    setOrigen(window.location.origin);
  }, []);

  useEffect(() => {
    let active = true;
    // El retardo es para no consultar con cada tecla; con el buscador vacío
    // se carga de inmediato.
    const timer = setTimeout(async () => {
      try {
        setLoading(true);
        const data = await getPresupuestos(busqueda);
        if (active) setPresupuestos(data);
      } catch (caught) {
        if (active) setError(caught instanceof Error ? caught.message : "No pudimos cargar los presupuestos.");
      } finally {
        if (active) setLoading(false);
      }
    }, busqueda ? 250 : 0);
    return () => { active = false; clearTimeout(timer); };
  }, [busqueda]);

  const resumen = useMemo(() => {
    const esperando = presupuestos.filter((p) => p.estado === "ENVIADO");
    const decididos = presupuestos.filter((p) => p.estado === "APROBADO" || p.estado === "RECHAZADO");
    const aprobados = presupuestos.filter((p) => p.estado === "APROBADO");
    return {
      esperando: esperando.length,
      montoEsperando: esperando.reduce((t, p) => t + Number(p.total), 0),
      vencidos: presupuestos.filter((p) => abierto(p) && diasParaVencer(p) < 0).length,
      aprobados: aprobados.length,
      tasa: decididos.length ? Math.round((aprobados.length / decididos.length) * 100) : null,
    };
  }, [presupuestos]);

  const visibles = filtro === "TODOS" ? presupuestos : presupuestos.filter((p) => p.estado === filtro);

  function mostrarAviso(texto: string) {
    setAviso(texto);
    window.setTimeout(() => setAviso(""), 2500);
  }

  const linkDe = (p: Presupuesto) => (p.token && p.portal_activo !== false && origen ? `${origen}/p/presupuesto/${encodeURIComponent(p.token)}` : "");

  async function copiarLink(p: Presupuesto) {
    const url = linkDe(p);
    if (!url) return mostrarAviso("Este presupuesto no tiene link activo.");
    void renovarPortalPresupuesto(p.id).catch(() => {});
    if (await copiarAlPortapapeles(url)) mostrarAviso(`Link de ${numeroPresupuesto(p.id)} copiado.`);
    else window.prompt("Copiá el link:", url);
    // Compartido el link, deja de ser borrador y pasa a esperar respuesta.
    if (p.estado === "BORRADOR") {
      setPresupuestos((items) => items.map((x) => (x.id === p.id ? { ...x, estado: "ENVIADO" } : x)));
      void actualizarEstadoPresupuesto(p.id, "ENVIADO").catch(() => {
        setPresupuestos((items) => items.map((x) => (x.id === p.id ? { ...x, estado: "BORRADOR" } : x)));
      });
    }
  }

  async function confirmarBorrado() {
    if (!idABorrar) return;
    const anterior = presupuestos;
    setPresupuestos((items) => items.filter((item) => item.id !== idABorrar));
    try {
      await eliminarPresupuesto(idABorrar);
      mostrarAviso("Presupuesto enviado a la papelera.");
    } catch (caught) {
      setPresupuestos(anterior);
      setError(caught instanceof Error ? caught.message : "No pudimos eliminar el presupuesto.");
    } finally {
      setIdABorrar(null);
    }
  }

  return (
    <AppShell
      currentPath="/presupuestos"
      compact
      badge="Ventas"
      title="Presupuestos"
      description="Lo que cotizaste, quién te tiene que responder y qué ya podés empezar."
      actions={
        <Link href="/presupuestos/nuevo" className="inline-flex h-9 items-center rounded-xl bg-brand-600 px-4 text-xs font-bold text-white shadow-sm transition hover:bg-brand-700">
          + Nuevo presupuesto
        </Link>
      }
    >
      {aviso && <div role="status" className="fixed bottom-6 right-6 z-50 rounded-xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white shadow-2xl dark:bg-slate-700">{aviso}</div>}
      {error && <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{error}</div>}

      {/* Franja de números */}
      <div className="grid grid-cols-2 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800 xl:grid-cols-4">
        <Cifra label="Esperando respuesta" value={String(resumen.esperando)} helper={resumen.esperando ? `${formatCurrency(resumen.montoEsperando)} en juego` : "Nada pendiente"} onClick={() => setFiltro("ENVIADO")} />
        <Cifra label="Vencidos sin respuesta" value={String(resumen.vencidos)} helper={resumen.vencidos ? "Conviene recordarle al cliente" : "Ninguno vencido"} alerta={resumen.vencidos > 0} />
        <Cifra label="Aprobados" value={String(resumen.aprobados)} helper="Listos para pasar a orden de trabajo" onClick={() => setFiltro("APROBADO")} />
        <Cifra label="Tasa de aprobación" value={resumen.tasa === null ? "—" : `${resumen.tasa}%`} helper="De los que el cliente ya respondió" />
      </div>

      {/* Búsqueda y filtros */}
      <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full lg:max-w-sm">
          <svg className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" /></svg>
          <input
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar cliente, patente o trabajo…"
            aria-label="Buscar presupuestos"
            className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-4 focus:ring-brand-500/10 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <div className="-mx-1 flex min-w-0 gap-1 overflow-x-auto px-1 pb-1 lg:pb-0" role="toolbar" aria-label="Filtrar por estado">
          {FILTROS.map((f) => {
            const activo = filtro === f.value;
            const cantidad = f.value === "TODOS" ? presupuestos.length : presupuestos.filter((p) => p.estado === f.value).length;
            return (
              <button
                key={f.value}
                type="button"
                onClick={() => setFiltro(f.value)}
                aria-pressed={activo}
                className={cn(
                  "inline-flex h-9 shrink-0 items-center gap-2 rounded-full px-3.5 text-xs font-semibold transition",
                  activo ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-600 hover:bg-white hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800",
                )}
              >
                {f.label}
                <span className={cn("rounded-full px-1.5 text-[11px] tabular-nums", activo ? "bg-white/20 dark:bg-slate-900/10" : "bg-slate-200/70 text-slate-600 dark:bg-slate-700 dark:text-slate-300")}>{cantidad}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tabla */}
      <section className="mt-3 rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <div className={cn(COLUMNAS, "hidden rounded-t-2xl border-b border-slate-100 bg-slate-50/80 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400 xl:grid")}>
          <span>Número</span>
          <span>Cliente y vehículo</span>
          <span>Trabajo</span>
          <span>Vigencia</span>
          <span>Estado</span>
          <span className="text-right">Total</span>
          <span className="sr-only">Acciones</span>
        </div>

        {loading ? (
          <div className="space-y-2 p-4">{[1, 2, 3, 4].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-700/50" />)}</div>
        ) : visibles.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="font-semibold text-slate-700 dark:text-slate-200">{presupuestos.length ? "No hay presupuestos en esta vista." : "Todavía no cotizaste nada."}</p>
            <p className="mt-1 text-sm text-slate-500">{presupuestos.length ? "Probá con otro filtro o búsqueda." : "Armá el primero y mandáselo al cliente con un link."}</p>
            {!presupuestos.length && <Link href="/presupuestos/nuevo" className="mt-4 inline-block rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-bold text-white">Crear presupuesto</Link>}
          </div>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700/70">
            {visibles.map((p) => (
              <Fila
                key={p.id}
                p={p}
                link={linkDe(p)}
                menuAbierto={menuId === p.id}
                onMenu={(abrir) => setMenuId(abrir ? p.id : null)}
                onCopiar={() => copiarLink(p)}
                onEliminar={() => setIdABorrar(p.id)}
              />
            ))}
          </ul>
        )}
        {!loading && visibles.length > 0 && (
          <p className="border-t border-slate-100 px-5 py-2.5 text-xs text-slate-500 dark:border-slate-700 dark:text-slate-400">
            {visibles.length} {visibles.length === 1 ? "presupuesto" : "presupuestos"}
          </p>
        )}
      </section>

      {idABorrar !== null && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true">
          <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">¿Eliminar {numeroPresupuesto(idABorrar)}?</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Va a la papelera y deja de aparecer en la lista. El link del cliente deja de funcionar.</p>
            <div className="mt-6 flex gap-2">
              <button type="button" onClick={() => setIdABorrar(null)} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm font-semibold text-slate-700 dark:border-slate-700 dark:text-slate-300">Cancelar</button>
              <button type="button" onClick={confirmarBorrado} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-semibold text-white">Eliminar</button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function Cifra({ label, value, helper, alerta = false, onClick }: { label: string; value: string; helper: string; alerta?: boolean; onClick?: () => void }) {
  const cuerpo = (
    <>
      <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
      <p className={cn("mt-1 font-display text-3xl font-extrabold leading-none tabular-nums", alerta ? "text-amber-600 dark:text-amber-400" : "text-slate-900 dark:text-white")}>{value}</p>
      <p className="mt-1 truncate text-[11px] text-slate-400">{helper}</p>
    </>
  );
  const clase = "block border-slate-100 px-5 py-4 text-left [&:not(:first-child)]:border-l dark:border-slate-700 max-xl:[&:nth-child(3)]:border-l-0 max-xl:[&:nth-child(n+3)]:border-t";
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(clase, "transition hover:bg-slate-50 dark:hover:bg-slate-700/30")}>{cuerpo}</button>
  ) : (
    <div className={clase}>{cuerpo}</div>
  );
}

function Fila({
  p,
  link,
  menuAbierto,
  onMenu,
  onCopiar,
  onEliminar,
}: {
  p: Presupuesto;
  link: string;
  menuAbierto: boolean;
  onMenu: (abrir: boolean) => void;
  onCopiar: () => void;
  onEliminar: () => void;
}) {
  const router = useRouter();
  const href = `/presupuestos/${p.id}`;
  const estado = ESTADO[p.estado] ?? { label: p.estado, clase: "bg-slate-100 text-slate-700 ring-slate-200" };
  const dias = diasParaVencer(p);
  const fecha = new Date(p.fecha_creacion).toLocaleDateString("es-AR", { day: "numeric", month: "short" }).replace(".", "");
  const telefono = normalizeWhatsAppPhone(p.cliente_telefono);
  const recordatorio = telefono && link
    ? buildWhatsAppUrl(`Hola ${p.cliente_nombre.split(" ")[0]}! ¿Pudiste ver el presupuesto de tu ${p.vehiculo}? Lo podés aprobar desde acá:\n${link}`, telefono)
    : "";

  // La acción principal depende de en qué está el presupuesto.
  let principal: React.ReactNode = null;
  const claseBoton = "inline-flex h-8 items-center whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition";
  if (p.estado === "APROBADO") {
    principal = <Link href={`/trabajos/nuevo?presupuesto=${p.id}`} className={cn(claseBoton, "bg-brand-600 text-white hover:bg-brand-700")}>Pasar a orden →</Link>;
  } else if (p.estado === "ENVIADO") {
    principal = recordatorio
      ? <a href={recordatorio} target="_blank" rel="noreferrer" className={cn(claseBoton, "bg-[#25D366] text-white hover:bg-[#1ebe5d]")}>Recordar por WhatsApp</a>
      : <button type="button" onClick={onCopiar} className={cn(claseBoton, "border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100")}>Copiar link</button>;
  } else if (p.estado === "BORRADOR") {
    principal = <Link href={href} className={cn(claseBoton, "border border-slate-200 bg-white text-slate-800 hover:border-brand-500 hover:text-brand-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100")}>Revisar y enviar →</Link>;
  }

  return (
    <li onClick={() => router.push(href)} className={cn(COLUMNAS, "group relative grid cursor-pointer grid-cols-[1fr_auto] gap-x-3 gap-y-2 px-5 py-3.5 transition hover:bg-slate-50 dark:hover:bg-slate-700/30", menuAbierto && "z-20")}>
      <div className="flex items-center gap-2 xl:block">
        <Link href={href} onClick={(e) => e.stopPropagation()} className="whitespace-nowrap font-mono text-xs font-semibold text-slate-900 hover:text-brand-600 dark:text-white">{numeroPresupuesto(p.id)}</Link>
        <p className="text-[11px] text-slate-500 dark:text-slate-400 xl:mt-0.5">{fecha}</p>
      </div>

      <div className="col-span-2 min-w-0 xl:col-span-1">
        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{p.cliente_nombre}</p>
        <p className="mt-0.5 flex min-w-0 items-center gap-2">
          {p.patente && p.patente !== "N/A" && <Patente valor={p.patente} className="text-[11px]" />}
          <span className="truncate text-xs text-slate-500 dark:text-slate-400">{p.vehiculo}</span>
        </p>
      </div>

      <p className="col-span-2 truncate text-sm text-slate-600 dark:text-slate-300 xl:col-span-1" title={p.resumen_corto || undefined}>{p.resumen_corto || "Sin detalle cargado"}</p>

      <p className={cn("text-xs xl:block", abierto(p) ? "" : "hidden")}>
        {abierto(p) && (dias < 0
          ? <span className="font-semibold text-amber-700 dark:text-amber-400">Venció hace {-dias} {dias === -1 ? "día" : "días"}</span>
          : <span className="text-slate-500 dark:text-slate-400">{dias === 0 ? "Vence hoy" : `Vence en ${dias} ${dias === 1 ? "día" : "días"}`}</span>)}
      </p>

      <div className="row-start-1 col-start-2 justify-self-end xl:col-start-auto xl:row-start-auto xl:justify-self-start">
        <span className={cn("inline-flex whitespace-nowrap rounded-md px-2 py-1 text-[11px] font-semibold ring-1 ring-inset", estado.clase)}>{estado.label}</span>
      </div>

      <p className="hidden text-right font-display text-lg font-extrabold tabular-nums text-slate-900 dark:text-white xl:block">{formatCurrency(Number(p.total))}</p>

      <div className="col-span-2 flex items-center justify-end gap-1.5 xl:col-span-1" onClick={(e) => e.stopPropagation()}>
        <span className="mr-auto font-display text-base font-extrabold tabular-nums text-slate-900 dark:text-white xl:hidden">{formatCurrency(Number(p.total))}</span>
        {principal}
        <MenuMas
          abierto={menuAbierto}
          onAbrir={onMenu}
          items={[
            { texto: "Abrir", href },
            ...(link ? [{ texto: "Copiar link del cliente", onClick: onCopiar }, { texto: "Ver cómo lo ve el cliente ↗", href: link, nuevaPestana: true }] : []),
            ...(p.estado !== "RECHAZADO" && p.estado !== "APROBADO" ? [{ texto: "Pasar a orden de trabajo", href: `/trabajos/nuevo?presupuesto=${p.id}` }] : []),
            { texto: "Editar", href: `/presupuestos/nuevo?id=${p.id}` },
            { texto: "Eliminar", onClick: onEliminar, peligro: true },
          ]}
        />
      </div>
    </li>
  );
}

function MenuMas({
  abierto,
  onAbrir,
  items,
}: {
  abierto: boolean;
  onAbrir: (abrir: boolean) => void;
  items: { texto: string; href?: string; onClick?: () => void; peligro?: boolean; nuevaPestana?: boolean }[];
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!abierto) return;
    const fuera = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) onAbrir(false); };
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") onAbrir(false); };
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => { document.removeEventListener("mousedown", fuera); document.removeEventListener("keydown", tecla); };
  }, [abierto, onAbrir]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => onAbrir(!abierto)}
        aria-haspopup="menu"
        aria-expanded={abierto}
        className={cn("inline-flex h-8 items-center gap-1 rounded-lg px-2.5 text-xs font-semibold transition", abierto ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-700 dark:hover:text-white")}
      >
        Más
        <svg className={cn("h-3.5 w-3.5 transition-transform", abierto && "rotate-180")} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" /></svg>
      </button>
      {abierto && (
        <div role="menu" className="absolute right-0 top-full z-30 mt-1.5 w-56 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl dark:border-slate-700 dark:bg-slate-800">
          {items.map((item) => {
            const clase = cn("block w-full px-3.5 py-2 text-left text-sm transition", item.peligro ? "border-t border-slate-100 text-red-600 hover:bg-red-50 dark:border-slate-700 dark:text-red-400 dark:hover:bg-red-950/30" : "text-slate-700 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700/60");
            return item.href ? (
              <Link key={item.texto} href={item.href} role="menuitem" className={clase} target={item.nuevaPestana ? "_blank" : undefined} rel={item.nuevaPestana ? "noopener noreferrer" : undefined}>{item.texto}</Link>
            ) : (
              <button key={item.texto} type="button" role="menuitem" onClick={() => { onAbrir(false); item.onClick?.(); }} className={clase}>{item.texto}</button>
            );
          })}
        </div>
      )}
    </div>
  );
}
