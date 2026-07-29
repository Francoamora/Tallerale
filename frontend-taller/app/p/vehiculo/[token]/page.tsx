/**
 * app/p/vehiculo/[token]/page.tsx  — SERVER COMPONENT
 *
 * Usa exclusivamente tokens públicos.
 */
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import type { Metadata } from "next";
import { getPublicVehiculo, PublicApiNotFoundError } from "@/lib/api-public";
import type { PublicVehiculo } from "@/lib/api-public";
import { VehiculoView } from "./VehiculoView";

interface PageProps {
  params: Promise<{ token: string }>;
}

async function fetchVehiculo(token: string): Promise<PublicVehiculo | null> {
  try {
    return await getPublicVehiculo(token);
  } catch (err) {
    if (err instanceof PublicApiNotFoundError) return null;
    return null;
  }
}

// ─── Metadata ─────────────────────────────────────────────────────────────────
export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  try {
    const v = await fetchVehiculo(token);
    if (!v) return { title: "Vehículo" };

    // Ver comentario equivalente en app/p/presupuesto/[token]/page.tsx: sin
    // imagen, WhatsApp arma una vista previa vacía del link.
    const h = await headers();
    const host = h.get("host") ?? "";
    const proto = h.get("x-forwarded-proto") ?? (/^(localhost|127\.0\.0\.1|192\.168\.|10\.)/.test(host) ? "http" : "https");
    const origin = host ? `${proto}://${host}` : "";
    const imageUrl = origin ? `${origin}/images/taller-hero-poster.jpg` : undefined;

    return {
      title: `${v.patente} · ${v.marca} ${v.modelo}`,
      description: `Historial y seguimiento del ${v.marca} ${v.modelo} (${v.patente})`,
      openGraph: {
        title: `${v.patente} · TallerOS`,
        description: `${v.marca} ${v.modelo} · ${v.historial.length} servicio${v.historial.length !== 1 ? "s" : ""} registrado${v.historial.length !== 1 ? "s" : ""}`,
        siteName: "TallerOS",
        images: imageUrl ? [{ url: imageUrl, width: 1104, height: 720, alt: "TallerOS" }] : undefined,
      },
    };
  } catch {
    return { title: "Vehículo" };
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default async function VehiculoPortalPage({ params }: PageProps) {
  const { token } = await params;

  const vehiculo = await fetchVehiculo(token);
  if (!vehiculo) notFound();

  return <VehiculoView vehiculo={vehiculo} />;
}
