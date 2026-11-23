import type { MetadataRoute } from "next";

/**
 * Lo que necesita el celular para instalar Tallerista como app: nombre, ícono,
 * color y que abra a pantalla completa (sin la barra del navegador).
 * Se sirve en /manifest.webmanifest.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Tallerista",
    short_name: "Tallerista",
    description: "El sistema de tu taller: órdenes, presupuestos, turnos y caja, con tus clientes avisados por WhatsApp.",
    lang: "es-AR",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0f1113",
    theme_color: "#0f1113",
    categories: ["business", "productivity"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Mantener apretado el ícono en Android muestra estos atajos.
    shortcuts: [
      { name: "Nueva orden", url: "/trabajos/nuevo", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Turnos", url: "/turnos", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Caja", url: "/caja", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
