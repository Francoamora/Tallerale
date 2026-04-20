import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No usar "standalone" en Vercel — Vercel tiene su propia adaptación serverless.
  // standalone es para self-hosting con Node.js puro (VPS, Docker).

  images: {
    remotePatterns: [],
  },
};

export default nextConfig;
