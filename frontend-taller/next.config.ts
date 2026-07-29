import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No usar "standalone" en Vercel — Vercel tiene su propia adaptación serverless.
  // standalone es para self-hosting con Node.js puro (VPS, Docker).

  images: {
    remotePatterns: [],
  },

  // Solo en dev: permite que el dev server acepte pedidos (assets, HMR) que
  // llegan desde un origen distinto a localhost — necesario para probar
  // desde el celular vía IP de LAN o túnel de ngrok. Next.js los bloquea
  // por defecto para evitar accesos no autorizados a endpoints de dev.
  // OJO: Next.js NO soporta notación CIDR acá (ej. "192.168.1.0/24" no
  // matchea nada) — solo hostnames exactos o wildcards de subdominio tipo
  // "192.168.1.*" (un solo segmento por *).
  allowedDevOrigins: [
    "127.0.0.1",
    "localhost",
    "*.ngrok-free.dev",
    "*.ngrok-free.app",
    "192.168.1.*",
    "192.168.0.*",
  ],

  // En desarrollo, liberar enseguida las páginas que no se están usando.
  // Reduce la memoria retenida al recorrer muchas pantallas del panel.
  onDemandEntries: {
    maxInactiveAge: 20 * 1000,
    pagesBufferLength: 2,
  },

  // El reenvío de /api/* al Django local vive en proxy.ts (necesita
  // preservar la barra final exacta, algo que rewrites() de acá no logra).

  // Sin esto, Next.js le saca la barra final a cualquier ruta con "/" antes
  // de que el middleware llegue a verla (con un 308), y Django la exige
  // (APPEND_SLASH) — un POST sin barra termina en 500 en vez de procesarse.
  skipTrailingSlashRedirect: true,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
