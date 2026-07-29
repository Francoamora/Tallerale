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
