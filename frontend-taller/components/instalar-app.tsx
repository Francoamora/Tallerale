"use client";

/**
 * "Instalá Tallerista en tu celular": en Android/Chrome instala con un toque
 * (el aviso nativo del navegador); en iPhone explica los dos pasos de Safari,
 * que no tiene botón de instalar. No aparece si ya está instalada, en la
 * compu, o si el usuario lo cerró.
 */
import { useEffect, useState } from "react";
import { MarcaTallerista } from "@/components/marca-tallerista";

type AvisoInstalar = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

const CLAVE = "tallerista:instalar-cerrado";

function leerCerrado() {
  try { return localStorage.getItem(CLAVE) === "1"; } catch { return false; }
}

/** Registra el service worker (solo en producción: en desarrollo molesta con el recargado). */
export function RegistrarServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production" || !("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}

export function InstalarApp() {
  const [aviso, setAviso] = useState<AvisoInstalar | null>(null);
  const [modo, setModo] = useState<"oculto" | "android" | "iphone">("oculto");
  const [pasos, setPasos] = useState(false);

  useEffect(() => {
    const instalada = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const celular = window.matchMedia("(max-width: 767px)").matches;
    if (instalada || !celular || leerCerrado()) return;

    const ua = navigator.userAgent;
    const esIphone = /iPhone|iPad|iPod/.test(ua);
    let t = 0;
    if (esIphone) t = window.setTimeout(() => setModo("iphone"), 0);

    const alAviso = (e: Event) => {
      e.preventDefault();
      setAviso(e as AvisoInstalar);
      setModo("android");
    };
    const alInstalar = () => setModo("oculto");
    window.addEventListener("beforeinstallprompt", alAviso);
    window.addEventListener("appinstalled", alInstalar);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", alAviso);
      window.removeEventListener("appinstalled", alInstalar);
    };
  }, []);

  function cerrar() {
    try { localStorage.setItem(CLAVE, "1"); } catch { /* sin almacenamiento: se vuelve a mostrar */ }
    setModo("oculto");
  }

  async function instalar() {
    if (modo === "iphone") { if (pasos) cerrar(); else setPasos(true); return; }
    if (!aviso) return;
    await aviso.prompt();
    const { outcome } = await aviso.userChoice;
    if (outcome === "accepted") setModo("oculto");
    setAviso(null);
  }

  if (modo === "oculto") return null;

  return (
    <section className="mb-4 rounded-2xl bg-slate-900 p-4 text-white shadow-lg ring-1 ring-white/10 dark:bg-slate-800">
      <div className="flex items-center gap-3">
        <MarcaTallerista className="h-11 w-11 shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="font-semibold">Instalá Tallerista en tu celular</p>
          <p className="text-sm text-slate-300">Se abre como una app, desde la pantalla de inicio.</p>
        </div>
        <button type="button" onClick={cerrar} aria-label="Cerrar aviso" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-white/10 hover:text-white">
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
      </div>

      {pasos && (
        <ol className="mt-4 space-y-2.5 rounded-xl bg-white/5 p-3.5 text-sm text-slate-200">
          <li className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold">1</span>
            <span>
              Tocá <strong>Compartir</strong>
              <svg className="mx-1 inline h-4 w-4 -translate-y-px" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-label="(el cuadrado con la flecha para arriba)"><path strokeLinecap="round" strokeLinejoin="round" d="M12 3v12m0-12-4 4m4-4 4 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" /></svg>
              abajo en Safari.
            </span>
          </li>
          <li className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-bold">2</span>
            <span>Elegí <strong>Agregar a inicio</strong> y listo.</span>
          </li>
        </ol>
      )}

      <button type="button" onClick={() => void instalar()} className="mt-3 flex h-11 w-full items-center justify-center rounded-xl bg-brand-600 text-sm font-bold text-white transition hover:bg-brand-700">
        {modo === "iphone" ? (pasos ? "Entendido" : "Cómo instalarla") : "Instalar app"}
      </button>
    </section>
  );
}
