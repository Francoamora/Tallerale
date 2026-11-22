const RESOURCE_TIMEOUT_MS = 4_000;

function withTimeout<T>(promise: Promise<T>, timeoutMs = RESOURCE_TIMEOUT_MS): Promise<T | null> {
  return Promise.race([
    promise,
    new Promise<null>((resolve) => {
      window.setTimeout(() => resolve(null), timeoutMs);
    }),
  ]);
}

/**
 * Espera los recursos visuales del comprobante antes de convertir el DOM en
 * imagen. Es especialmente importante en Safari/iOS, donde una imagen que ya
 * tiene URL puede seguir pendiente de decodificación durante algunos frames.
 */
export async function esperarRecursosDocumento(elemento: HTMLElement): Promise<void> {
  await withTimeout(document.fonts?.ready ?? Promise.resolve());

  const imagenes = Array.from(elemento.querySelectorAll("img"));
  await Promise.all(
    imagenes.map(async (imagen) => {
      if (!imagen.complete) {
        await withTimeout(
          new Promise<void>((resolve) => {
            imagen.addEventListener("load", () => resolve(), { once: true });
            imagen.addEventListener("error", () => resolve(), { once: true });
          })
        );
      }

      if (typeof imagen.decode === "function") {
        await withTimeout(imagen.decode().catch(() => undefined));
      }
    })
  );

  await new Promise<void>((resolve) =>
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
  );
}

let cssArchivo: Promise<string | undefined> | null = null;

/**
 * CSS con la fuente Archivo embebida (data URL) para pasarle a html-to-image
 * como `fontEmbedCSS`. La exportación usa `skipFonts` para no colgarse
 * leyendo todas las hojas de estilo; sin esto el PDF salía con la letra del
 * sistema en vez de la de la app. Sólo se embebe el subconjunto latino.
 */
export function fuenteArchivoEmbebida(): Promise<string | undefined> {
  if (cssArchivo) return cssArchivo;
  cssArchivo = (async () => {
    try {
      let url: string | undefined;
      for (const hoja of Array.from(document.styleSheets)) {
        let reglas: CSSRuleList;
        try { reglas = hoja.cssRules; } catch { continue; }
        for (const regla of Array.from(reglas)) {
          if (!(regla instanceof CSSFontFaceRule)) continue;
          const familia = regla.style.getPropertyValue("font-family");
          const rango = regla.style.getPropertyValue("unicode-range");
          if (!familia.includes("Archivo") || !/U\+0-FF/i.test(rango)) continue;
          const coincide = regla.style.getPropertyValue("src").match(/url\(["']?([^"')]+\.woff2)["']?\)/);
          if (coincide) url = new URL(coincide[1], hoja.href ?? window.location.href).href;
        }
      }
      if (!url) return undefined;
      const blob = await withTimeout(fetch(url).then((r) => r.blob()));
      if (!blob) return undefined;
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const lector = new FileReader();
        lector.onload = () => resolve(String(lector.result));
        lector.onerror = reject;
        lector.readAsDataURL(blob);
      });
      return `@font-face{font-family:'Archivo Variable';font-style:normal;font-display:block;font-weight:100 900;font-stretch:62% 125%;src:url(${dataUrl}) format('woff2');}`;
    } catch {
      return undefined;
    }
  })();
  return cssArchivo;
}
