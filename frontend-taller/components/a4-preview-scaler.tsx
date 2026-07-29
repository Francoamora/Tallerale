"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/** Ancho real de una hoja A4 a 96dpi — el mismo valor fijo que usa DocumentoA4. */
const A4_WIDTH_PX = 794;

/**
 * Envuelve un documento de ancho fijo (A4) y lo achica para que entre
 * completo en pantallas angostas, en vez de cortarse o forzar scroll
 * horizontal. En desktop, donde ya entra, no hace nada (scale: 1).
 *
 * Usa `transform: scale()` con un contenedor de tamaño explícito en vez de
 * la propiedad `zoom` — `zoom` no es estándar y tiene bugs históricos de
 * layout específicos de Safari (sombras/anillos que no escalan igual que el
 * contenido, columnas que se ven "pegadas" al borde) que rompían la vista
 * en mobile real aunque en Chrome se viera bien.
 */
export function A4PreviewScaler({ children }: { children: ReactNode }) {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [innerHeight, setInnerHeight] = useState(0);

  useEffect(() => {
    const outer = outerRef.current;
    const inner = innerRef.current;
    if (!outer || !inner) return;

    function recalc() {
      const available = outer!.parentElement?.clientWidth ?? window.innerWidth;
      const padding = 24; // margen respirable a cada lado
      const next = Math.min(1, (available - padding * 2) / A4_WIDTH_PX);
      setScale(Number(next.toFixed(3)));
      setInnerHeight(inner!.scrollHeight);
    }

    recalc();
    const ro = new ResizeObserver(recalc);
    ro.observe(inner);
    window.addEventListener("resize", recalc);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", recalc);
    };
  }, [children]);

  return (
    <>
      {/* position:fixed en el CSS de impresión de DocumentoA4 necesita que
          ningún ancestro tenga transform (si no, queda fijo respecto a ese
          ancestro en vez de la página) — lo desactivamos del todo al imprimir. */}
      <style>{`
        @media print {
          .a4-preview-scaler-outer { width: auto !important; height: auto !important; }
          .a4-preview-scaler-inner { transform: none !important; }
        }
      `}</style>
      <div
        ref={outerRef}
        className="a4-preview-scaler-outer"
        style={{ width: A4_WIDTH_PX * scale, height: innerHeight ? innerHeight * scale : undefined }}
      >
        <div
          ref={innerRef}
          className="a4-preview-scaler-inner"
          style={{ width: A4_WIDTH_PX, transform: `scale(${scale})`, transformOrigin: "top left" }}
        >
          {children}
        </div>
      </div>
    </>
  );
}

/**
 * Neutraliza temporalmente el escalado (para que html-to-image capture el
 * documento a resolución completa, igual en mobile que en desktop) y
 * devuelve una función para restaurarlo. Usar siempre en un try/finally.
 */
export function suspenderEscalaA4(): () => void {
  const outers = Array.from(document.querySelectorAll<HTMLElement>(".a4-preview-scaler-outer"));
  const inners = Array.from(document.querySelectorAll<HTMLElement>(".a4-preview-scaler-inner"));
  const prevOuters = outers.map((el) => ({ width: el.style.width, height: el.style.height }));
  const prevInners = inners.map((el) => el.style.transform);

  outers.forEach((el) => { el.style.width = "auto"; el.style.height = "auto"; });
  inners.forEach((el) => { el.style.transform = "none"; });

  return function restaurar() {
    outers.forEach((el, i) => { el.style.width = prevOuters[i].width; el.style.height = prevOuters[i].height; });
    inners.forEach((el, i) => { el.style.transform = prevInners[i]; });
  };
}
