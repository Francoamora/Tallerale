import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permite que Vercel sirva el build correctamente desde subdirectorio
  // en un monorepo (raiz del repo es Django, frontend-taller es Next.js)
  output: "standalone",

  // Imágenes externas permitidas (si algún día se usan avatares/logos externos)
  images: {
    remotePatterns: [],
  },

  // Variables de entorno que deben estar en build-time (seguras para exponer)
  env: {
    NEXT_PUBLIC_APP_VERSION: "2.0.0",
  },
};

export default nextConfig;
