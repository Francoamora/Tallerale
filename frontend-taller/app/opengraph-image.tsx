import { ImageResponse } from "next/og";

import { SEO } from "@/lib/seo";

/** Imagen al compartir el link (WhatsApp, Facebook, X), con los colores de la marca. */
export const alt = `Tallerista: ${SEO.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "64px 72px",
          background: "linear-gradient(135deg, #020618 0%, #0f172b 60%, #1c2742 100%)",
          color: "#ffffff",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div style={{ display: "flex", width: 64, height: 64, borderRadius: 18, background: "#fe6e00", color: "#ffffff", fontSize: 34, fontWeight: 800, alignItems: "center", justifyContent: "center" }}>
            T
          </div>
          <div style={{ display: "flex", fontSize: 40, fontWeight: 800 }}>Tallerista</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 74, fontWeight: 800, lineHeight: 1.04, letterSpacing: -2, maxWidth: 1000 }}>
            {SEO.tagline}
          </div>
          <div style={{ display: "flex", marginTop: 26, fontSize: 32, color: "rgba(255,255,255,.75)" }}>
            Órdenes de trabajo · Presupuestos por WhatsApp · Caja
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", fontSize: 26, color: "rgba(255,255,255,.6)" }}>tallerista.famdesarrollos.com.ar</div>
          <div style={{ display: "flex", padding: "14px 30px", borderRadius: 999, background: "#fe6e00", color: "#ffffff", fontSize: 28, fontWeight: 800 }}>
            7 días gratis
          </div>
        </div>
      </div>
    ),
    size,
  );
}
