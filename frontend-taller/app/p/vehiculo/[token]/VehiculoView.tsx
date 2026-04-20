"use client";

/**
 * app/p/vehiculo/[token]/VehiculoView.tsx — CLIENT COMPONENT
 *
 * Ficha del vehículo para el cliente final:
 *  · Info del auto + dueño
 *  · Barra de progreso de service (km actual vs próximo service)
 *  · Timeline de OTs (historial de trabajos)
 *  · Recomendaciones del último service
 */

import type { PublicVehiculo, PublicOTResumen } from "@/lib/api-public";

// ─── Formateo ─────────────────────────────────────────────────────────────────
const ARS = new Intl.NumberFormat("es-AR", {
  style: "currency",
  currency: "ARS",
  maximumFractionDigits: 0,
});

function formatCurrency(v: number | string) {
  return ARS.format(Number(v));
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ─── Badge de estado OT ───────────────────────────────────────────────────────
const OT_ESTADO: Record<string, { label: string; dot: string; text: string }> = {
  INGRESADO:  { label: "Ingresado",  dot: "bg-slate-400",   text: "text-slate-500"   },
  EN_PROCESO: { label: "En Proceso", dot: "bg-amber-400",   text: "text-amber-600"   },
  FINALIZADO: { label: "Finalizado", dot: "bg-emerald-400", text: "text-emerald-600" },
  ENTREGADO:  { label: "Entregado",  dot: "bg-blue-400",    text: "text-blue-600"    },
  ANULADO:    { label: "Anulado",    dot: "bg-red-300",     text: "text-red-400"     },
};

// ─── Barra de Service ─────────────────────────────────────────────────────────
function ServiceBar({ kmActual, kmProximo }: { kmActual: number; kmProximo: number }) {
  const pct = Math.min((kmActual / kmProximo) * 100, 100);
  const kmRestantes = kmProximo - kmActual;
  const vencido = kmActual >= kmProximo;

  let barColor = "bg-emerald-400";
  let statusLabel = `Faltan ${kmRestantes.toLocaleString("es-AR")} km`;
  let statusColor = "text-emerald-600";

  if (vencido) {
    barColor = "bg-red-500";
    statusLabel = `Service vencido (${Math.abs(kmRestantes).toLocaleString("es-AR")} km pasados)`;
    statusColor = "text-red-600";
  } else if (pct >= 85) {
    barColor = "bg-amber-400";
    statusLabel = `¡Próximo service! Faltan ${kmRestantes.toLocaleString("es-AR")} km`;
    statusColor = "text-amber-600";
  }

  return (
    <div>
      <div className="mb-2 flex items-end justify-between">
        <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">
          Próximo service
        </p>
        <span className={`text-xs font-bold ${statusColor}`}>{statusLabel}</span>
      </div>

      {/* Barra */}
      <div className="relative h-3 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-700 ${barColor}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      {/* Etiquetas */}
      <div className="mt-1.5 flex justify-between text-[11px] font-mono text-slate-400">
        <span>0 km</span>
        <span className="font-bold text-slate-600">
          {kmActual.toLocaleString("es-AR")} km actuales
        </span>
        <span>{kmProximo.toLocaleString("es-AR")} km</span>
      </div>
    </div>
  );
}

// ─── Ítem de OT en timeline ───────────────────────────────────────────────────
function OTItem({ ot, isLast }: { ot: PublicOTResumen; isLast: boolean }) {
  const cfg = OT_ESTADO[ot.estado] ?? OT_ESTADO.ENTREGADO;

  return (
    <div className="flex gap-4">
      {/* Línea de tiempo */}
      <div className="flex flex-col items-center">
        <div className={`mt-1 h-3 w-3 shrink-0 rounded-full ring-2 ring-white ${cfg.dot}`} />
        {!isLast && <div className="mt-1 w-0.5 flex-1 bg-slate-200" />}
      </div>

      {/* Contenido */}
      <div className={`pb-6 flex-1 ${isLast ? "pb-0" : ""}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-bold text-slate-900">
              OT-{String(ot.id).padStart(5, "0")}
              {" · "}
              <span className="font-mono">{ot.kilometraje.toLocaleString("es-AR")} km</span>
            </p>
            <p className="text-[11px] text-slate-400">{formatDate(ot.fecha_ingreso)}</p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <span className={`text-[10px] font-bold uppercase tracking-wider ${cfg.text}`}>
              {cfg.label}
            </span>
            <span className="font-mono text-xs font-black text-slate-700">
              {formatCurrency(ot.total)}
            </span>
          </div>
        </div>

        {ot.resumen_trabajos && (
          <p className="mt-2 text-sm leading-snug text-slate-600">{ot.resumen_trabajos}</p>
        )}

        {ot.recomendaciones_proximo_service && (
          <div className="mt-2 rounded-xl bg-amber-50 px-3 py-2 ring-1 ring-amber-200">
            <p className="text-[11px] font-semibold text-amber-700">
              💡 {ot.recomendaciones_proximo_service}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Componente principal ─────────────────────────────────────────────────────
interface Props {
  vehiculo: PublicVehiculo;
}

export function VehiculoView({ vehiculo }: Props) {
  // Ordenar historial: más reciente primero
  const historialOrdenado = [...vehiculo.historial].sort(
    (a, b) => new Date(b.fecha_ingreso).getTime() - new Date(a.fecha_ingreso).getTime(),
  );

  // Stats rápidas del historial
  const totalServicios = historialOrdenado.length;
  const totalInvertido = historialOrdenado.reduce((acc, ot) => acc + Number(ot.total), 0);
  const ultimoService  = historialOrdenado.find(ot => ot.estado === "FINALIZADO" || ot.estado === "ENTREGADO");

  return (
    <div className="space-y-4">

      {/* ── FICHA DEL VEHÍCULO ── */}
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80">
        <div className="flex items-start gap-4">
          {/* Ícono */}
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-slate-100 text-3xl">
            🚗
          </div>
          <div className="flex-1 min-w-0">
            {/* Patente */}
            <div className="inline-block rounded-lg bg-slate-900 px-3 py-1 font-mono text-lg font-black tracking-[0.2em] text-white">
              {vehiculo.patente}
            </div>
            <p className="mt-1.5 text-base font-bold text-slate-900">
              {vehiculo.marca} {vehiculo.modelo}
              {vehiculo.anio && (
                <span className="ml-1.5 text-sm font-medium text-slate-400">{vehiculo.anio}</span>
              )}
            </p>
            {vehiculo.color && (
              <p className="text-xs text-slate-400">{vehiculo.color}</p>
            )}
            <p className="mt-1 text-xs font-medium text-slate-500">
              Titular: {vehiculo.cliente_nombre}
            </p>
          </div>
        </div>

        {/* Stats rápidas */}
        <div className="mt-5 grid grid-cols-3 gap-2">
          <div className="rounded-2xl bg-slate-50 px-3 py-3 text-center">
            <p className="font-mono text-lg font-black text-slate-900">
              {vehiculo.kilometraje_actual.toLocaleString("es-AR")}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">km actuales</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-3 text-center">
            <p className="font-mono text-lg font-black text-slate-900">{totalServicios}</p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">servicios</p>
          </div>
          <div className="rounded-2xl bg-slate-50 px-3 py-3 text-center">
            <p className="font-mono text-sm font-black text-slate-900 truncate">
              {new Intl.NumberFormat("es-AR", { notation: "compact", style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(totalInvertido)}
            </p>
            <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">invertido</p>
          </div>
        </div>
      </div>

      {/* ── BARRA DE SERVICE ── */}
      {vehiculo.proximo_service_km && vehiculo.proximo_service_km > 0 && (
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80">
          <ServiceBar
            kmActual={vehiculo.kilometraje_actual}
            kmProximo={vehiculo.proximo_service_km}
          />
        </div>
      )}

      {/* ── ÚLTIMO SERVICE ── */}
      {ultimoService && ultimoService.recomendaciones_proximo_service && (
        <div className="rounded-3xl bg-amber-50 p-5 ring-1 ring-amber-200">
          <p className="mb-2 text-[10px] font-black uppercase tracking-widest text-amber-500">
            Recomendación del taller
          </p>
          <p className="text-sm font-semibold leading-relaxed text-amber-800">
            💡 {ultimoService.recomendaciones_proximo_service}
          </p>
        </div>
      )}

      {/* ── HISTORIAL DE SERVICIOS (Timeline) ── */}
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80">
        <p className="mb-5 text-[10px] font-black uppercase tracking-widest text-slate-400">
          Historial de servicios
        </p>

        {historialOrdenado.length === 0 ? (
          <div className="py-8 text-center">
            <span className="text-3xl">🔧</span>
            <p className="mt-2 text-sm text-slate-400">
              Aún no hay servicios registrados para este vehículo.
            </p>
          </div>
        ) : (
          <div>
            {historialOrdenado.map((ot, i) => (
              <OTItem
                key={ot.id}
                ot={ot}
                isLast={i === historialOrdenado.length - 1}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── RECORDATORIO ── */}
      <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-slate-200/80">
        <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-slate-400">
          ¿Necesitás turno?
        </p>
        <a
          href={vehiculo.taller_tel
            ? `https://wa.me/${vehiculo.taller_tel.replace(/\D/g, "")}?text=${encodeURIComponent(`Hola! Quiero sacar un turno para mi ${vehiculo.marca} ${vehiculo.modelo} (${vehiculo.patente}).`)}`
            : "#"}
          target="_blank"
          rel="noopener noreferrer"
          className={`flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-sm font-bold text-white shadow-sm transition active:scale-95 ${vehiculo.taller_tel ? "bg-[#25D366] hover:bg-[#1ebe5d]" : "pointer-events-none bg-slate-300"}`}
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
          </svg>
          Sacar turno por WhatsApp
        </a>
      </div>
    </div>
  );
}
