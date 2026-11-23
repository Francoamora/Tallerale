"use client";

/**
 * Cuenta una visita a la página pública en la que está (landing, login,
 * registro) para el panel CEO. Sin cookies ni terceros: un número al azar en
 * el navegador para contar visitantes únicos, de dónde vino y si es celular.
 * Si algo falla no pasa nada: la página no depende de esto.
 */
import { useEffect } from "react";

const CLAVE = "tallerista:visitante";
// Mismo proxy que usa lib/api; no se importa para no sumarle todo ese módulo a la landing.
const API_ROOT = "/api/backend";

function idDelVisitante() {
  try {
    let id = localStorage.getItem(CLAVE);
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(CLAVE, id);
    }
    return id;
  } catch {
    // Navegación privada sin almacenamiento: cuenta como visitante del momento.
    return crypto.randomUUID();
  }
}

function dispositivo() {
  const ancho = window.innerWidth;
  return ancho < 768 ? "celular" : ancho < 1024 ? "tablet" : "compu";
}

export function ContadorVisitas() {
  useEffect(() => {
    // Robots que ejecutan JavaScript (pruebas automáticas, capturas) no cuentan.
    if (navigator.webdriver || /bot|crawl|spider|preview|headless|lighthouse/i.test(navigator.userAgent)) return;
    const params = new URLSearchParams(window.location.search);
    const datos = {
      ruta: window.location.pathname,
      visitante: idDelVisitante(),
      referente: document.referrer,
      utm: params.get("utm_source") ?? "",
      dispositivo: dispositivo(),
      sitio: window.location.hostname,
    };
    fetch(`${API_ROOT}/visitas/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
      keepalive: true,
    }).catch(() => {});
  }, []);
  return null;
}
