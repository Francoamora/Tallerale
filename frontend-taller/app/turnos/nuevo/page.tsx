"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { BuscadorCliente, ElegirVehiculo } from "@/components/buscador-cliente";
import { Campo, campoClase, Tarjeta } from "@/components/formulario";
import { crearTurno, editarTurno, getClientes, getTurnoById, getTurnos, getVehiculos } from "@/lib/api";
import type { Cliente, Turno, Vehiculo } from "@/lib/types";
import { cn } from "@/lib/utils";
import { buildWhatsAppUrl } from "@/lib/whatsapp";

const MOTIVOS = ["Service", "Cambio de aceite y filtros", "Frenos", "Alineación y balanceo", "Diagnóstico", "Revisión general"];
const HORARIOS = Array.from({ length: 21 }, (_, i) => `${String(8 + Math.floor(i / 2)).padStart(2, "0")}:${i % 2 ? "30" : "00"}`);

function fechaLocal(fecha: Date) {
  return new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

function nombreDia(clave: string, largo = false) {
  const [y, m, d] = clave.split("-").map(Number);
  const fecha = new Date(y, m - 1, d);
  const hoy = new Date();
  const diff = Math.round((fecha.getTime() - new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate()).getTime()) / 86_400_000);
  if (!largo && diff === 0) return "Hoy";
  if (!largo && diff === 1) return "Mañana";
  const texto = fecha.toLocaleDateString("es-AR", largo ? { weekday: "long", day: "numeric", month: "long" } : { weekday: "short", day: "numeric" }).replace(",", "").replace(".", "");
  const conPrefijo = largo && diff === 0 ? `Hoy, ${texto}` : largo && diff === 1 ? `Mañana, ${texto}` : texto;
  return conPrefijo.charAt(0).toUpperCase() + conPrefijo.slice(1);
}

function FormularioTurno() {
  const params = useSearchParams();
  const editId = params.get("id");
  const clientePreId = params.get("cliente");
  const vehiculoPreId = params.get("vehiculo");
  const fechaPre = params.get("fecha");

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vehiculos, setVehiculos] = useState<Vehiculo[]>([]);
  const [turnos, setTurnos] = useState<Turno[]>([]);

  const [modo, setModo] = useState<"DIRECTORIO" | "EXPRESS">("DIRECTORIO");
  const [clienteId, setClienteId] = useState("");
  const [vehiculoId, setVehiculoId] = useState("");
  const [express, setExpress] = useState({ nombre: "", telefono: "", patente: "", marca: "" });

  const hoy = fechaLocal(new Date());
  const [dia, setDia] = useState(fechaPre && /^\d{4}-\d{2}-\d{2}$/.test(fechaPre) ? fechaPre : hoy);
  const [hora, setHora] = useState(fechaPre ? "09:00" : "");
  const [motivo, setMotivo] = useState("");
  const [notas, setNotas] = useState("");

  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [guardado, setGuardado] = useState<Turno | null>(null);

  useEffect(() => {
    let activo = true;
    (async () => {
      try {
        const [cs, vs, ts] = await Promise.all([getClientes(), getVehiculos(), getTurnos()]);
        if (!activo) return;
        setClientes(cs);
        setVehiculos(vs);
        setTurnos(ts);
        if (editId) {
          const t = await getTurnoById(Number(editId));
          if (!activo) return;
          const f = new Date(t.fecha_hora);
          setDia(fechaLocal(f));
          setHora(`${String(f.getHours()).padStart(2, "0")}:${String(f.getMinutes()).padStart(2, "0")}`);
          setMotivo(t.motivo);
          setNotas(t.notas || "");
          if (t.cliente_id) setClienteId(String(t.cliente_id));
          if (t.vehiculo_id) setVehiculoId(String(t.vehiculo_id));
        } else if (vehiculoPreId) {
          const auto = vs.find((x) => x.id === Number(vehiculoPreId));
          if (auto) {
            setClienteId(String(auto.cliente_id));
            setVehiculoId(String(auto.id));
          }
        } else if (clientePreId && cs.some((c) => c.id === Number(clientePreId))) {
          setClienteId(clientePreId);
          const autos = vs.filter((x) => x.cliente_id === Number(clientePreId));
          if (autos.length === 1) setVehiculoId(String(autos[0].id));
        }
      } catch {
        if (activo) setError("No pudimos cargar los datos. Recargá la página.");
      } finally {
        if (activo) setCargando(false);
      }
    })();
    return () => { activo = false; };
  }, [clientePreId, editId, vehiculoPreId]);

  const autosDelCliente = useMemo(() => vehiculos.filter((x) => String(x.cliente_id) === clienteId), [vehiculos, clienteId]);
  const cliente = clientes.find((c) => String(c.id) === clienteId);
  const auto = vehiculos.find((x) => String(x.id) === vehiculoId);

  // Turnos ya agendados ese día, para no superponer.
  const ocupados = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const t of turnos) {
      if (t.estado === "CANCELADO" || String(t.id) === editId) continue;
      const f = new Date(t.fecha_hora);
      if (fechaLocal(f) !== dia) continue;
      mapa.set(`${String(f.getHours()).padStart(2, "0")}:${String(f.getMinutes()).padStart(2, "0")}`, t.cliente_nombre.split(" ")[0]);
    }
    return mapa;
  }, [turnos, dia, editId]);

  const dias = useMemo(() => Array.from({ length: 14 }, (_, i) => {
    const f = new Date();
    f.setDate(f.getDate() + i);
    return fechaLocal(f);
  }), []);

  function elegirCliente(c: Cliente | null) {
    setClienteId(c ? String(c.id) : "");
    const autos = c ? vehiculos.filter((x) => x.cliente_id === c.id) : [];
    setVehiculoId(autos.length === 1 ? String(autos[0].id) : "");
  }

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const esDirectorio = modo === "DIRECTORIO" || Boolean(editId);
    if (esDirectorio && !clienteId) return setError("Elegí el cliente.");
    if (esDirectorio && !vehiculoId) return setError("Elegí el auto.");
    if (!esDirectorio && (!express.nombre.trim() || !express.patente.trim() || !express.marca.trim())) return setError("Completá nombre, patente y vehículo.");
    if (!hora) return setError("Elegí el horario.");
    if (!motivo.trim()) return setError("¿Qué trae? Escribí el motivo.");

    const fechaHora = new Date(`${dia}T${hora}`);
    if (!editId && fechaHora.getTime() < Date.now() - 60_000) return setError("Ese horario ya pasó.");
    setGuardando(true);
    const payload = {
      fecha_hora: fechaHora.toISOString(),
      motivo: motivo.trim(),
      notas: notas.trim(),
      cliente_id: esDirectorio ? Number(clienteId) : undefined,
      vehiculo_id: esDirectorio ? Number(vehiculoId) : undefined,
      cliente_express: esDirectorio ? undefined : { nombre: express.nombre.trim(), telefono: express.telefono.trim() },
      vehiculo_express: esDirectorio ? undefined : { patente: express.patente.trim().toUpperCase(), marca: express.marca.trim() },
    };
    try {
      const t = editId ? await editarTurno(Number(editId), payload) : await crearTurno(payload);
      setGuardado(t);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No pudimos guardar el turno.");
    } finally {
      setGuardando(false);
    }
  }

  if (cargando) {
    return (
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="h-[28rem] animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
        <div className="h-64 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
      </div>
    );
  }

  const nombreCliente = modo === "EXPRESS" && !editId ? express.nombre.trim() : cliente?.nombre_completo ?? "";
  const telefonoCliente = modo === "EXPRESS" && !editId ? express.telefono : cliente?.telefono;
  const descAuto = modo === "EXPRESS" && !editId ? [express.marca, express.patente].filter(Boolean).join(" · ") : auto ? `${auto.marca} ${auto.modelo} · ${auto.patente}` : "";

  if (guardado) {
    const f = new Date(guardado.fecha_hora);
    const horaTexto = `${String(f.getHours()).padStart(2, "0")}:${String(f.getMinutes()).padStart(2, "0")}`;
    const diaTexto = nombreDia(fechaLocal(f), true).toLowerCase();
    const wa = buildWhatsAppUrl(
      `Hola ${nombreCliente.split(" ")[0]}! Te confirmo el turno para el ${diaTexto} a las ${horaTexto}${guardado.vehiculo_desc && guardado.vehiculo_desc !== "Sin Vehículo" ? ` con tu ${guardado.vehiculo_desc}` : ""} (${guardado.motivo}). ¡Te esperamos!`,
      guardado.cliente_telefono || telefonoCliente,
    );
    return (
      <section className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-2xl text-emerald-600 dark:bg-emerald-950/40">✓</span>
        <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">{editId ? "Turno actualizado" : "Turno agendado"}</h2>
        <p className="mt-1 text-slate-600 dark:text-slate-300">{nombreDia(fechaLocal(f), true)} a las {horaTexto}</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">{nombreCliente}{descAuto ? ` · ${descAuto}` : ""}</p>
        <div className="mt-6 grid gap-2">
          {wa ? (
            <a href={wa} target="_blank" rel="noopener noreferrer" className="inline-flex h-11 items-center justify-center rounded-xl bg-emerald-600 text-sm font-bold text-white transition hover:bg-emerald-700">
              Mandarle la confirmación por WhatsApp
            </a>
          ) : (
            <p className="rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-500 dark:bg-slate-900/50">El cliente no tiene celular cargado para avisarle por WhatsApp.</p>
          )}
          <Link href="/turnos" className="inline-flex h-11 items-center justify-center rounded-xl text-sm font-bold text-slate-800 ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50 dark:text-slate-100 dark:ring-slate-700 dark:hover:bg-slate-700">Ir a la agenda</Link>
        </div>
      </section>
    );
  }

  return (
    <form onSubmit={guardar} className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">{error}</div>}

        {/* Quién */}
        <Tarjeta
          titulo="¿Quién viene?"
          descripcion={editId ? "El cliente y el auto de un turno no se cambian." : undefined}
          extra={!editId && (
            <div className="flex shrink-0 rounded-xl bg-slate-100 p-1 dark:bg-slate-900" role="tablist">
              {([["DIRECTORIO", "Ya es cliente"], ["EXPRESS", "Cliente nuevo"]] as const).map(([valor, texto]) => (
                <button key={valor} type="button" role="tab" aria-selected={modo === valor} onClick={() => setModo(valor)} className={cn("h-8 rounded-lg px-3 text-sm font-semibold transition", modo === valor ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400")}>
                  {texto}
                </button>
              ))}
            </div>
          )}
        >
          {modo === "DIRECTORIO" || editId ? (
            <div className="space-y-4">
              <BuscadorCliente
                clientes={clientes}
                clienteId={clienteId}
                onElegir={elegirCliente}
                bloqueado={Boolean(editId)}
                autoFocus={!editId && !clientePreId && !vehiculoPreId}
                onNoEncontrado={(texto) => { setModo("EXPRESS"); setExpress((x) => ({ ...x, nombre: texto })); }}
              />
              {cliente && (autosDelCliente.length ? (
                <ElegirVehiculo vehiculos={autosDelCliente} vehiculoId={vehiculoId} onElegir={setVehiculoId} bloqueado={Boolean(editId)} />
              ) : (
                <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                  No tiene autos cargados. <Link href={`/vehiculos/nuevo?cliente=${cliente.id}`} className="font-semibold underline">Agregale uno</Link> o cargalo como cliente nuevo.
                </p>
              ))}
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Nombre y apellido" obligatorio><input autoFocus value={express.nombre} onChange={(e) => setExpress((x) => ({ ...x, nombre: e.target.value }))} placeholder="Ej: Juan Pérez" className={campoClase} /></Campo>
              <Campo etiqueta="Celular" ayuda="Para mandarle la confirmación."><input type="tel" value={express.telefono} onChange={(e) => setExpress((x) => ({ ...x, telefono: e.target.value }))} placeholder="Ej: 342 555 1234" className={campoClase} /></Campo>
              <Campo etiqueta="Patente" obligatorio><input value={express.patente} onChange={(e) => setExpress((x) => ({ ...x, patente: e.target.value.toUpperCase().replace(/\s/g, "") }))} placeholder="Ej: AB123CD" className={cn(campoClase, "font-semibold uppercase tracking-wider placeholder:normal-case placeholder:font-normal placeholder:tracking-normal")} /></Campo>
              <Campo etiqueta="Vehículo" obligatorio><input value={express.marca} onChange={(e) => setExpress((x) => ({ ...x, marca: e.target.value }))} placeholder="Ej: VW Gol 2015" className={campoClase} /></Campo>
            </div>
          )}
        </Tarjeta>

        {/* Cuándo */}
        <Tarjeta titulo="¿Cuándo?">
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
            {dias.map((d) => (
              <button key={d} type="button" onClick={() => setDia(d)} aria-pressed={dia === d} className={cn("h-10 shrink-0 rounded-xl px-3.5 text-sm font-semibold transition", dia === d ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-700")}>
                {nombreDia(d)}
              </button>
            ))}
            <label className={cn("relative flex h-10 shrink-0 cursor-pointer items-center rounded-xl px-3.5 text-sm font-semibold ring-1 ring-inset transition", !dias.includes(dia) ? "bg-slate-900 text-white ring-slate-900 dark:bg-white dark:text-slate-900" : "text-slate-700 ring-slate-200 hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-700")}>
              {!dias.includes(dia) ? nombreDia(dia) : "Otra fecha"}
              <input type="date" min={editId ? undefined : hoy} value={dia} onChange={(e) => e.target.value && setDia(e.target.value)} aria-label="Elegir otra fecha" className="absolute inset-0 cursor-pointer opacity-0" />
            </label>
          </div>

          <div className="mt-4 grid grid-cols-4 gap-1.5 sm:grid-cols-6 xl:grid-cols-7">
            {HORARIOS.map((h) => {
              const quien = ocupados.get(h);
              const pasado = !editId && new Date(`${dia}T${h}`).getTime() < Date.now();
              return (
                <button
                  key={h}
                  type="button"
                  disabled={pasado}
                  onClick={() => setHora(h)}
                  aria-pressed={hora === h}
                  title={quien ? `Ya hay turno: ${quien}` : undefined}
                  className={cn(
                    "flex h-11 flex-col items-center justify-center rounded-xl text-sm font-semibold tabular-nums transition disabled:cursor-not-allowed disabled:opacity-30",
                    hora === h ? "bg-brand-600 text-white" : quien ? "bg-amber-50 text-amber-800 ring-1 ring-inset ring-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:ring-amber-900" : "text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-700",
                  )}
                >
                  {h}
                  {quien && <span className={cn("max-w-full truncate px-1 text-[10px] font-medium leading-none", hora === h ? "text-white/80" : "text-amber-700 dark:text-amber-400")}>{quien}</span>}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
            <label className="flex items-center gap-2">
              Otra hora
              <input type="time" value={HORARIOS.includes(hora) ? "" : hora} onChange={(e) => setHora(e.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:[color-scheme:dark]" />
            </label>
            {ocupados.size > 0 && <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-amber-200 dark:bg-amber-800" /> ya tiene turno</span>}
          </div>
        </Tarjeta>

        {/* Qué */}
        <Tarjeta titulo="¿Qué trae?">
          <div className="mb-3 flex flex-wrap gap-1.5">
            {MOTIVOS.map((m) => (
              <button key={m} type="button" onClick={() => setMotivo(m)} aria-pressed={motivo === m} className={cn("h-8 rounded-full px-3 text-sm font-semibold transition", motivo === m ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-700")}>
                {m}
              </button>
            ))}
          </div>
          <div className="grid gap-4">
            <Campo etiqueta="Motivo" obligatorio>
              <input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ej: Ruido en el tren delantero" className={campoClase} />
            </Campo>
            <Campo etiqueta="Notas" ayuda="Opcional. Sólo las ve el taller.">
              <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3} placeholder="Ej: Lo deja a la mañana y lo retira a la tarde." className={cn(campoClase, "h-auto resize-none py-2.5")} />
            </Campo>
          </div>
        </Tarjeta>
      </div>

      <aside className="lg:sticky lg:top-24">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">El turno</p>
          <p className="mt-2 font-display text-2xl font-extrabold leading-tight text-slate-900 dark:text-white">{hora || "--:--"}</p>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{nombreDia(dia, true)}</p>
          <dl className="mt-4 space-y-2 border-t border-slate-100 pt-4 text-sm dark:border-slate-700">
            <div><dt className="text-xs text-slate-500">Cliente</dt><dd className="truncate text-slate-900 dark:text-white">{nombreCliente || "—"}</dd></div>
            <div><dt className="text-xs text-slate-500">Auto</dt><dd className="truncate text-slate-900 dark:text-white">{descAuto || "—"}</dd></div>
            <div><dt className="text-xs text-slate-500">Motivo</dt><dd className="truncate text-slate-900 dark:text-white">{motivo || "—"}</dd></div>
          </dl>
          {hora && ocupados.get(hora) && <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">A esa hora ya viene {ocupados.get(hora)}. Si podés atender a los dos, dale nomás.</p>}
          <div className="mt-5 grid gap-2">
            <button type="submit" disabled={guardando} className="inline-flex h-11 items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-60">
              {guardando ? "Guardando…" : editId ? "Guardar cambios" : "Agendar turno"}
            </button>
            <Link href="/turnos" className="inline-flex h-10 items-center justify-center rounded-xl text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">Cancelar</Link>
          </div>
        </section>
      </aside>
    </form>
  );
}

export default function NuevoTurnoPage() {
  return (
    <Suspense fallback={null}>
      <Titulo />
    </Suspense>
  );
}

function Titulo() {
  const editId = useSearchParams().get("id");
  return (
    <AppShell currentPath="/turnos" compact badge="Agenda" title={editId ? "Editar turno" : "Nuevo turno"} description="Quién viene, cuándo y qué trae.">
      <FormularioTurno />
    </AppShell>
  );
}
