/**
 * app/p/presupuesto/[token]/page.tsx  — SERVER COMPONENT
 *
 * Usa exclusivamente tokens públicos.
 */
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { getPublicPresupuesto, PublicApiNotFoundError } from "@/lib/api-public";
import type { PublicPresupuesto } from "@/lib/api-public";
import { PresupuestoView } from "./PresupuestoView";

interface PageProps {
  params: Promise<{ token: string }>;
}

async function fetchPresupuesto(token: string): Promise<PublicPresupuesto | null> {
  try {
    return await getPublicPresupuesto(token);
  } catch (err) {
    if (err instanceof PublicApiNotFoundError) return null;
    return null;
  }
}

// ─── Metadata og: ─────────────────────────────────────────────────────────────
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const moneda = new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  });

  try {
    const p = await fetchPresupuesto(token);
    if (!p) return { title: "Presupuesto" };

    const num     = `P-${String(p.id).padStart(4, "0")}`;
    const vehiculo = p.vehiculo
      ? `${p.vehiculo.marca} ${p.vehiculo.modelo} ${p.vehiculo.patente}`
      : "tu vehículo";
    const total = moneda.format(Number(p.total));

    // Sin esto, WhatsApp/Telegram/etc. arman una tarjeta de vista previa sin
    // imagen (se ve vacía/genérica). Se arma la URL a mano con el host real
    // de la request en vez de metadataBase — así funciona igual en
    // localhost, IP de LAN, túnel de ngrok o el dominio de producción.
    const h = await headers();
    const host = h.get("host") ?? "";
    const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.0\.0\.1|192\.168\.|10\.)/.test(host) ? "http" : "https");
    const origin = host ? `${proto}://${host}` : "";
    const imageUrl = origin ? `${origin}/images/taller-hero-poster.jpg` : undefined;

    return {
      title: `Presupuesto ${num}`,
      description: `${p.resumen_corto || "Presupuesto de reparación"} · ${vehiculo} · Total: ${total}`,
      openGraph: {
        title: `Presupuesto ${num} · Tallerista`,
        description: `${p.resumen_corto || "Presupuesto de reparación"} — ${vehiculo}\nTotal: ${total}`,
        siteName: "Tallerista",
        images: imageUrl ? [{ url: imageUrl, width: 1104, height: 720, alt: "Tallerista" }] : undefined,
      },
    };
  } catch {
    return { title: "Presupuesto" };
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function PresupuestoPortalPage({ params }: PageProps) {
  const { token } = await params;

  const presupuesto = await fetchPresupuesto(token);
  if (!presupuesto) notFound();

  return <PresupuestoView presupuesto={presupuesto} />;
}
