"use client";

import { useEffect, useMemo, useState } from "react";
import { descargarPlanillaContador } from "@/lib/api";
import { cn } from "@/lib/utils";
import { buildWhatsAppUrl, normalizeWhatsAppPhone } from "@/lib/whatsapp";

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];

function fechaLocal(fecha: Date) {
  return new Date(fecha.getTime() - fecha.getTimezoneOffset() * 60_000).toISOString().slice(0, 10);
}

/** Los últimos 12 meses, empezando por el anterior (el que se suele mandar). */
function mesesRecientes() {
  const hoy = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const inicio = new Date(hoy.getFullYear(), hoy.getMonth() - i, 1);
    const fin = i === 0 ? hoy : new Date(hoy.getFullYear(), hoy.getMonth() - i + 1, 0);
    const nombre = `${MESES[inicio.getMonth()]} ${inicio.getFullYear()}`;
    return { clave: fechaLocal(inicio), desde: fechaLocal(inicio), hasta: fechaLocal(fin), nombre: nombre.charAt(0).toUpperCase() + nombre.slice(1), enCurso: i === 0 };
  });
}

/**
 * Ventana para bajar la planilla del mes y mandársela al contador por WhatsApp.
 * En el celular se comparte el archivo directo (el menú de compartir deja
 * elegir WhatsApp con el Excel adjunto). En la compu se descarga y se abre
 * el chat del contador con el texto listo: el archivo se arrastra al chat.
 */
export function ExportarContador({
  abierto,
  onCerrar,
  telefonoContador = "",
  nombreTaller = "",
}: {
  abierto: boolean;
  onCerrar: () => void;
  telefonoContador?: string;
  nombreTaller?: string;
}) {
  const meses = useMemo(() => mesesRecientes(), []);
  const [clave, setClave] = useState(meses[1].clave);
  const [desde, setDesde] = useState(meses[1].desde);
  const [hasta, setHasta] = useState(meses[1].hasta);
  const [personalizado, setPersonalizado] = useState(false);
  const [estado, setEstado] = useState<"listo" | "bajando" | "bajado" | "compartido">("listo");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!abierto) return;
    const tecla = (e: KeyboardEvent) => { if (e.key === "Escape") onCerrar(); };
    document.addEventListener("keydown", tecla);
    return () => document.removeEventListener("keydown", tecla);
  }, [abierto, onCerrar]);

  if (!abierto) return null;

  const mes = meses.find((m) => m.clave === clave);
  const rango = personalizado ? { desde, hasta } : { desde: mes?.desde ?? desde, hasta: mes?.hasta ?? hasta };
  const nombrePeriodo = personalizado
    ? `del ${new Date(`${rango.desde}T00:00`).toLocaleDateString("es-AR")} al ${new Date(`${rango.hasta}T00:00`).toLocaleDateString("es-AR")}`
    : (mes?.nombre ?? "").toLowerCase();

  const nombreArchivo = `Planilla contador ${personalizado ? `${rango.desde} a ${rango.hasta}` : mes?.nombre}.xlsx`;
  const mensaje = `Hola! Te paso la planilla de ${nombrePeriodo}${nombreTaller ? ` de ${nombreTaller}` : ""} con las ventas, los cobros y las compras del taller.`;
  const chatContador = normalizeWhatsAppPhone(telefonoContador) ? buildWhatsAppUrl(mensaje, telefonoContador) : `https://wa.me/?text=${encodeURIComponent(mensaje)}`;

  /** En el celular: se comparte el archivo y se elige WhatsApp. Si no se puede, se descarga. */
  async function mandar(compartir: boolean) {
    setError("");
    setEstado("bajando");
    try {
      const blob = await descargarPlanillaContador(rango.desde, rango.hasta);
      const archivo = new File([blob], nombreArchivo, { type: blob.type });
      const esCelular = navigator.maxTouchPoints > 0 && window.matchMedia("(pointer: coarse)").matches;
      if (compartir && esCelular && navigator.canShare?.({ files: [archivo] })) {
        try {
          await navigator.share({ files: [archivo], text: mensaje, title: nombreArchivo });
          setEstado("compartido");
          return;
        } catch (e) {
          if (e instanceof Error && e.name === "AbortError") return setEstado("listo");
        }
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = nombreArchivo;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setEstado("bajado");
    } catch (e) {
      setError(e instanceof Error ? e.message : "No pudimos armar la planilla.");
      setEstado("listo");
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="titulo-contador">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-800">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="titulo-contador" className="text-lg font-bold text-slate-900 dark:text-white">Planilla para el contador</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Un Excel con las ventas, los cobros y las compras del período, listo para que facture y declare en ARCA.</p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="-mr-2 -mt-2 grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-700">×</button>
        </div>

        {estado === "compartido" ? (
          <div className="mt-5">
            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">Listo, la planilla de {nombrePeriodo} salió compartida.</div>
            <button type="button" onClick={() => setEstado("listo")} className="mt-3 w-full text-center text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">Mandar otro período</button>
          </div>
        ) : estado === "bajado" ? (
          <div className="mt-5">
            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-300">
              La planilla de {nombrePeriodo} quedó en tus descargas.
            </div>
            <a href={chatContador} target="_blank" rel="noopener noreferrer" className="mt-4 flex h-11 items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white transition hover:bg-emerald-700">
              {normalizeWhatsAppPhone(telefonoContador) ? "Abrir el chat con tu contador" : "Abrir WhatsApp"}
            </a>
            <p className="mt-2 text-center text-xs text-slate-500">El mensaje va escrito; arrastrá al chat el archivo que se descargó.</p>
            {!normalizeWhatsAppPhone(telefonoContador) && <p className="mt-2 text-center text-xs text-slate-500">Cargá el WhatsApp de tu contador en Configuración y te abrimos su chat directo.</p>}
            <button type="button" onClick={() => setEstado("listo")} className="mt-3 w-full text-center text-sm font-semibold text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">Bajar otro período</button>
          </div>
        ) : (
          <>
            <div className="mt-5">
              <label htmlFor="mes-contador" className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Período</label>
              <select
                id="mes-contador"
                value={personalizado ? "otro" : clave}
                onChange={(e) => { if (e.target.value === "otro") setPersonalizado(true); else { setPersonalizado(false); setClave(e.target.value); } }}
                className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              >
                {meses.map((m) => <option key={m.clave} value={m.clave}>{m.nombre}{m.enCurso ? " (en curso)" : ""}</option>)}
                <option value="otro">Elegir fechas…</option>
              </select>
              {personalizado && (
                <div className="mt-2 flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <input type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} aria-label="Desde" className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:[color-scheme:dark]" />
                  a
                  <input type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} aria-label="Hasta" className="h-9 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:[color-scheme:dark]" />
                </div>
              )}
            </div>

            <ul className="mt-4 space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
              {[
                ["Ventas", "Órdenes entregadas, con cliente, DNI/CUIT y total"],
                ["Cobros", "Lo que entró, por medio de pago"],
                ["Compras y gastos", "Con su comprobante, para el IVA compras"],
              ].map(([t, d]) => (
                <li key={t} className="flex gap-2"><span className="text-emerald-600">✓</span><span><span className="font-semibold text-slate-800 dark:text-slate-100">{t}:</span> {d}</span></li>
              ))}
            </ul>

            {error && <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/30 dark:text-red-300">{error}</p>}

            <div className="mt-5 grid gap-2">
              <button
                type="button"
                onClick={() => void mandar(true)}
                disabled={estado === "bajando"}
                className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35ZM12.04 21.5a9.45 9.45 0 0 1-4.82-1.32l-.35-.2-3.58.94.96-3.49-.23-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.22 4.25-9.47 9.48-9.47a9.47 9.47 0 0 1 9.47 9.48c0 5.22-4.25 9.46-9.47 9.46Zm8.06-17.53A11.3 11.3 0 0 0 12.04.63C5.76.63.65 5.74.65 12.02c0 2 .52 3.96 1.52 5.69L.55 23.6l6.04-1.58a11.4 11.4 0 0 0 5.44 1.39c6.28 0 11.39-5.11 11.39-11.39 0-3.04-1.19-5.9-3.34-8.05Z" /></svg>
                {estado === "bajando" ? "Armando la planilla…" : "Mandar por WhatsApp"}
              </button>
              <button
                type="button"
                onClick={() => void mandar(false)}
                disabled={estado === "bajando"}
                className={cn("flex h-10 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold text-slate-700 ring-1 ring-inset ring-slate-200 transition hover:bg-slate-50 disabled:opacity-60 dark:text-slate-200 dark:ring-slate-700 dark:hover:bg-slate-700")}
              >
                Sólo descargar el Excel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
