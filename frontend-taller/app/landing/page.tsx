/**
 * app/landing/page.tsx
 *
 * Landing page pública de Tallerista.
 * Marca: Tallerista — "El sistema operativo de tu taller"
 * Dominio sugerido: talleristas.com.ar / tutallermecanico.com.ar (alias SEO)
 */
import type { Metadata } from "next";
import Link from "next/link";
import { LandingNav } from "@/components/landing-nav";
import { CarIcon, CheckIcon, XIcon } from "@/components/icons";
import { WA_SOPORTE } from "@/lib/trial";

export const metadata: Metadata = {
  title: "Tallerista · El sistema operativo de tu taller mecánico",
  description:
    "Presupuestos digitales, órdenes de trabajo, portal del cliente y control de caja. Probalo 7 días gratis — sin tarjeta, sin contrato.",
  keywords: "software taller mecanico, gestion taller, presupuesto digital, orden de trabajo, argentina",
};

// ─── Íconos ───────────────────────────────────────────────────────────────────
const I = {
  wrench: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  doc: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  users: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  cash: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
    </svg>
  ),
  phone: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  kanban: (
    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2" />
    </svg>
  ),
  check: (
    <svg className="h-4 w-4 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
    </svg>
  ),
  arrow: (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
    </svg>
  ),
  wa: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
  ),
  link: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
    </svg>
  ),
  checkCircle: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  bolt: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  ),
  pdf: (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 3h6m-7 6h8a2 2 0 002-2V7.828a2 2 0 00-.586-1.414l-3.828-3.828A2 2 0 0011.172 2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
};

// ─── Logo Tallerista ────────────────────────────────────────────────────────────
function LogoOS({ size = "md" }: { size?: "sm" | "md" | "lg" }) {
  const dims = size === "sm" ? "h-7 w-7 text-[10px]" : size === "lg" ? "h-14 w-14 text-lg" : "h-9 w-9 text-xs";
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-sm shadow-orange-500/30 font-black text-white ${dims}`}>
      OS
    </div>
  );
}

function BrandName({ className = "" }: { className?: string }) {
  return (
    <span className={className}>
      <span className="text-slate-900">Taller</span>
      <span className="text-orange-500">ista</span>
    </span>
  );
}

// ─── Feature card ─────────────────────────────────────────────────────────────
function FeatureCard({
  icon, title, desc, color, items,
}: {
  icon: React.ReactNode; title: string; desc: string; color: string; items: string[];
}) {
  return (
    <div className="group rounded-3xl bg-white p-7 shadow-sm ring-1 ring-slate-200/80 transition duration-200 hover:-translate-y-1 hover:shadow-lg">
      <div className={`mb-5 inline-flex h-12 w-12 items-center justify-center rounded-2xl ${color}`}>
        {icon}
      </div>
      <h3 className="mb-2 text-lg font-black text-slate-900">{title}</h3>
      <p className="mb-5 text-sm leading-relaxed text-slate-500">{desc}</p>
      <ul className="space-y-2.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2.5 text-sm text-slate-600">
            <span className="mt-0.5">{I.check}</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white antialiased">

      {/* ══ NAVBAR ══════════════════════════════════════════════════════════════ */}
      <LandingNav />

      {/* ══ HERO ════════════════════════════════════════════════════════════════ */}
      {/* Composición única: el taller ocupa todo el fondo, el contenido flota   */}
      {/* encima. Nada de "foto adentro de una tarjeta" — es un solo plano.      */}
      {/* min-h-dvh: el video siempre llena como mínimo la primera pantalla,      */}
      {/* sin importar la relación de ancho/alto — nada de franja blanca abajo. */}
      <section className="relative isolate flex min-h-dvh flex-col overflow-hidden bg-slate-950">

        {/* ── Fondo: video del taller (loop, sin sonido, cámara fija) ── */}
        <video
          className="absolute inset-0 h-full w-full object-cover object-[30%_28%]"
          poster="/images/taller-hero-poster.jpg"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
        >
          <source src="/videos/taller-hero.mp4" type="video/mp4" />
        </video>

        {/* ── Overlay: degradado horizontal oscuro→transparente ── */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "linear-gradient(90deg, rgba(2,6,23,.95) 0%, rgba(2,6,23,.88) 26%, rgba(2,6,23,.58) 52%, rgba(2,6,23,.24) 76%, rgba(2,6,23,.15) 100%)",
          }}
        />

        {/* ── Overlay: viñeta sutil ── */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 45%, rgba(2,6,23,.4) 100%)",
          }}
        />

        {/* ── Overlay: glow naranja detrás del mecánico ── */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(circle at 58% 42%, rgba(249,115,22,.16), transparent 55%)",
          }}
        />

        {/* ── Contenido — flota a la izquierda, ancla arriba (sin centrado que */}
        {/* deje huecos impredecibles), aprovechando el ancho disponible ── */}
        {/* Sin mx-auto/max-w acá: si lo centramos en un contenedor angosto,     */}
        {/* en pantallas anchas el texto queda lejos del borde real izquierdo. */}
        <div className="relative mt-auto w-full px-4 pb-16 pt-24 sm:pb-20 lg:pb-24">
          <div className="max-w-2xl">
            {/* Headline */}
            <h1 className="text-4xl font-black leading-[1.05] tracking-tight text-white sm:text-6xl 2xl:text-7xl">
              El sistema{" "}
              <br />
              operativo de{" "}
              <span className="bg-gradient-to-r from-orange-400 via-orange-500 to-orange-400 bg-clip-text text-transparent">
                tu taller
              </span>
            </h1>

            {/* Subtítulo */}
            <p className="mt-4 max-w-xl text-base leading-relaxed text-slate-300 sm:mt-5 sm:text-xl">
              Presupuestos digitales, órdenes de trabajo, estado del taller,{" "}
              <strong className="font-semibold text-white">portal del cliente</strong>{" "}
              y control de caja. Todo desde el celular, sin papeles, sin complicaciones.
            </p>

            {/* CTAs */}
            <div className="mt-7 flex flex-col gap-3 sm:mt-8 sm:flex-row sm:gap-4">
              <Link
                href="/registro"
                className="group flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 px-6 py-3.5 text-sm font-black text-white shadow-2xl shadow-orange-500/40 transition hover:from-orange-600 hover:to-orange-700 active:scale-[0.98] sm:px-8 sm:py-4 sm:text-base"
              >
                Empezar gratis — 7 días
                <svg className="h-4 w-4 transition group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              <a
                href={`https://wa.me/${WA_SOPORTE}?text=${encodeURIComponent("Hola! Quiero saber más sobre Tallerista")}`}
                className="flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 px-6 py-3.5 text-sm font-semibold text-white backdrop-blur-sm transition hover:border-white/30 hover:bg-white/10 sm:px-8 sm:py-4 sm:text-base"
              >
                {I.wa}
                Contactanos
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ══ FEATURES ════════════════════════════════════════════════════════════ */}
      <section id="features" className="px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-orange-500">
              Todo lo que necesitás
            </p>
            <h2 className="text-3xl font-black tracking-tight text-slate-900 sm:text-4xl">
              Un sistema hecho para talleres reales
            </h2>
            <p className="mx-auto mt-4 max-w-xl text-base text-slate-500">
              Nada de programas de oficina complicados. Está pensado desde cero
              para el día a día de un taller argentino: simple, claro y sin vueltas.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={I.doc}
              title="Presupuestos Digitales"
              desc="Generá presupuestos profesionales en minutos. Mandáselos al cliente por WhatsApp o con un link único."
              color="bg-sky-50 text-sky-600"
              items={[
                "Formato listo para compartir",
                "Mano de obra, repuestos e insumos",
                "Estados: Borrador → Enviado → Aprobado",
                "Convertir a Orden de Trabajo en 1 click",
              ]}
            />
            <FeatureCard
              icon={I.wrench}
              title="Órdenes de Trabajo"
              desc="Registrá cada reparación con todos los detalles: historial del vehículo, KM, ítems y recomendaciones."
              color="bg-amber-50 text-amber-600"
              items={[
                "Documento oficial con logo del taller",
                "Observaciones para el cliente e internas",
                "Recomendaciones para el próximo service",
                "Link directo al portal del cliente",
              ]}
            />
            <FeatureCard
              icon={I.kanban}
              title="Estado del Taller"
              desc="Todos los autos del taller de un vistazo: Ingresado, En Proceso, Finalizado, Entregado."
              color="bg-violet-50 text-violet-600"
              items={[
                "Vista tipo tablero por estado",
                "Se actualiza solo, sin recargar la página",
                "Total de facturación por estado",
                "Avisa si un auto lleva muchos días en el taller",
              ]}
            />
            <FeatureCard
              icon={I.users}
              title="Directorio de Clientes"
              desc="Ficha completa de cada cliente: historial, saldo, vehículos y cuenta corriente en un solo lugar."
              color="bg-emerald-50 text-emerald-600"
              items={[
                "Cuenta corriente con saldo de deuda",
                "Historial completo de trabajos y presupuestos",
                "Filtro rápido 'Solo con deuda'",
                "WhatsApp directo desde la ficha",
              ]}
            />
            <FeatureCard
              icon={I.cash}
              title="Control de Caja"
              desc="Registrá cobros, gastos y consultá el balance en tiempo real. Nunca más perder plata sin registrar."
              color="bg-rose-50 text-rose-600"
              items={[
                "Ingresos y gastos ordenados por categoría",
                "Evolución de facturación mes a mes",
                "Promedio de facturación por trabajo",
                "Cuenta corriente por cliente",
              ]}
            />
            <FeatureCard
              icon={I.phone}
              title="Desde el celular o la PC"
              desc="Sin programas para instalar. Se abre desde el navegador y funciona en cualquier dispositivo."
              color="bg-slate-100 text-slate-600"
              items={[
                "Pensado para usarlo con una mano",
                "Botones grandes, fáciles de tocar",
                "Compartís por WhatsApp con un toque",
                "Modo claro y oscuro",
              ]}
            />
          </div>
        </div>
      </section>

      {/* ══ PORTAL DEL CLIENTE ══════════════════════════════════════════════════ */}
      <section id="portal" className="bg-gradient-to-b from-slate-900 to-slate-800 px-4 py-16 sm:py-20 lg:py-24">
        <div className="mx-auto max-w-7xl">
          {/* 3 columnas corriendo en paralelo — texto, tarjetas y teléfono — en vez  */}
          {/* de apilar todo lo visual en serie, que era lo que hacía gigante la sección. */}
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_0.85fr_0.95fr] lg:gap-8">

            {/* Texto */}
            <div>
              <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-orange-400">
                Cómo funciona
              </p>
              <h2 className="text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl">
                Así se ve{" "}
                <span className="text-orange-400">Tallerista por dentro.</span>
              </h2>
              <p className="mt-5 text-base leading-relaxed text-slate-400">
                Cada presupuesto se convierte en un documento prolijo y en un Portal
                donde tu cliente lo ve en su celular y <strong className="font-semibold text-slate-200">aprueba con un botón</strong>.
                Vos, mientras tanto, ves el historial de cada auto y la plata que
                entra y sale — todo en el mismo lugar, sin planillas aparte.
              </p>

              <ul className="mt-8 space-y-5">
                {[
                  { icon: I.link, t: "Un link, no una app. Lo abre y ya está — sin cuenta, sin contraseña." },
                  { icon: I.checkCircle, t: "Aprueba o rechaza con un botón. Te enterás en el momento, no cuando te acordás de llamarlo." },
                  { icon: <CarIcon className="h-5 w-5" />, t: "Historial completo del vehículo, con cada service registrado — vos y tu cliente ven lo mismo." },
                  {
                    icon: (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    ),
                    t: "Cada cobro queda anotado en tu caja al toque, sin planilla aparte.",
                  },
                  { icon: I.bolt, t: "Menos llamadas explicando presupuestos por teléfono. El trabajo arranca antes." },
                ].map(({ icon, t }) => (
                  <li key={t} className="flex items-start gap-3.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/5 text-orange-400 ring-1 ring-white/10">
                      {icon}
                    </span>
                    <span className="pt-2 text-sm leading-snug text-slate-300">{t}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Columna de tarjetas — Comprobante, Historial y Caja, apiladas   */}
            {/* en una sola fila angosta, no repartidas en dos filas anchas.   */}
            <div className="mx-auto w-full max-w-[260px] space-y-3">
              {/* Comprobante */}
              <div className="overflow-hidden rounded-2xl bg-white shadow-2xl">
                <div style={{ height: 4, background: "#efd38f" }} />
                <div className="p-3.5">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-[9px] font-black"
                      style={{ color: "#92400e" }}
                    >
                      MT
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-[10px] font-black leading-tight text-slate-900">Mi Taller</p>
                      <p className="text-[7px] font-black uppercase tracking-widest" style={{ color: "#a16207" }}>Presupuesto</p>
                    </div>
                  </div>
                  <div className="mt-2.5 space-y-1 border-t border-slate-100 pt-2">
                    <div className="flex justify-between text-[8px]">
                      <span className="text-slate-500">Mano de obra</span>
                      <span className="font-mono font-bold text-slate-700">$20.000</span>
                    </div>
                    <div className="flex justify-between text-[8px]">
                      <span className="text-slate-500">Pastillas</span>
                      <span className="font-mono font-bold text-slate-700">$28.500</span>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between rounded-lg bg-slate-900 px-2 py-1.5">
                    <span className="text-[7px] font-black uppercase tracking-widest text-slate-400">Total</span>
                    <span className="font-mono text-[11px] font-black text-orange-400">$48.500</span>
                  </div>
                </div>
              </div>

              {/* Historial del vehículo */}
              <div className="rounded-2xl bg-white p-3.5 shadow-2xl">
                <p className="mb-2 text-[8px] font-black uppercase tracking-widest text-slate-400">Historial</p>
                <div className="space-y-2.5">
                  {[
                    { ot: "OT-0006", estado: "Entregado", dot: "bg-blue-400" },
                    { ot: "OT-0004", estado: "Ingresado", dot: "bg-slate-400" },
                  ].map((item, i) => (
                    <div key={item.ot} className="flex items-center gap-2">
                      <div className="flex flex-col items-center self-stretch">
                        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${item.dot}`} />
                        {i < 1 && <span className="mt-0.5 w-px flex-1 bg-slate-200" />}
                      </div>
                      <div className="min-w-0 flex-1 pb-1">
                        <p className="truncate text-[9px] font-black text-slate-800">{item.ot}</p>
                        <p className="text-[7px] font-bold uppercase tracking-wider text-slate-400">{item.estado}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Caja */}
              <div className="rounded-2xl bg-white p-3.5 shadow-2xl">
                <div className="flex items-center justify-between">
                  <p className="text-[8px] font-black uppercase tracking-widest text-slate-400">Caja del mes</p>
                  <span className="font-mono text-[10px] font-black text-emerald-600">+18%</span>
                </div>
                <div className="mt-2.5 flex h-8 items-end gap-1">
                  {[38, 55, 46, 70, 62, 95].map((h, i) => (
                    <div key={i} className="flex-1 rounded-t-sm bg-gradient-to-t from-orange-300 to-orange-500" style={{ height: `${h}%` }} />
                  ))}
                </div>
                <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2.5">
                  <span className="text-[9px] text-slate-500">Ingresos del mes</span>
                  <span className="font-mono text-[11px] font-black text-slate-900">$517.000</span>
                </div>
              </div>
            </div>

            {/* Teléfono — columna propia, corre en paralelo a las tarjetas */}
            <div className="relative mx-auto w-full max-w-[260px]">
                <div className="mx-auto w-64 rounded-[2.5rem] bg-slate-700 p-3 shadow-2xl ring-4 ring-white/5">
                  <div className="overflow-hidden rounded-[2rem] bg-gradient-to-b from-slate-50 to-white">
                    {/* Notch */}
                    <div className="flex justify-center pt-3 pb-2">
                      <div className="h-1.5 w-12 rounded-full bg-slate-200" />
                    </div>
                    {/* Header portal */}
                    <div className="border-b border-slate-100 px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-500 text-[8px] font-black text-white">TA</div>
                        <div>
                          <p className="text-[9px] font-black text-slate-900">Tallerista</p>
                          <p className="text-[7px] font-bold uppercase tracking-wider text-slate-400">Portal del Cliente</p>
                        </div>
                        <span className="ml-auto rounded-full bg-orange-50 px-2 py-0.5 text-[7px] font-black uppercase tracking-wider text-orange-600 ring-1 ring-orange-200">Portal</span>
                      </div>
                    </div>
                    {/* Contenido */}
                    <div className="space-y-2.5 p-4">
                      <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="text-[8px] font-black uppercase tracking-wider text-slate-400">Presupuesto</p>
                            <p className="font-mono text-base font-black text-slate-900">P-0042</p>
                            <p className="text-[9px] font-medium text-slate-500">Cambio de pastillas de freno</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1 rounded-full border border-sky-200 bg-white px-2 py-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
                            <span className="text-[7px] font-black uppercase text-sky-700">Enviado</span>
                          </div>
                        </div>
                        <div className="mt-2.5 flex items-center justify-between rounded-xl bg-slate-900 px-3 py-2">
                          <span className="text-[8px] font-black uppercase tracking-wider text-slate-400">Total</span>
                          <span className="font-mono text-sm font-black text-orange-400">$48.500</span>
                        </div>
                      </div>
                      <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
                        <p className="mb-1 text-[8px] font-black uppercase tracking-wider text-slate-400">Vehículo</p>
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-slate-400">
                            <CarIcon className="h-3.5 w-3.5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-mono text-xs font-black text-slate-900">ABC 123</p>
                            <p className="text-[9px] text-slate-500">Toyota Corolla · 2019</p>
                          </div>
                          <div className="shrink-0 text-right">
                            <p className="text-[9px] font-black text-slate-700">4 services</p>
                            <p className="text-[7px] font-bold uppercase tracking-wider text-slate-400">historial</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    {/* Sticky bar */}
                    <div className="border-t border-slate-100 bg-white px-3 py-3">
                      <p className="mb-2 text-center text-[8px] font-semibold text-slate-400">¿Aprobás este presupuesto?</p>
                      <div className="flex gap-2">
                        <div className="flex flex-1 items-center justify-center gap-1 rounded-xl border-2 border-slate-200 py-2 text-[9px] font-black text-slate-500">
                          <XIcon className="h-2.5 w-2.5" /> Rechazar
                        </div>
                        <div className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-500 py-2 text-[9px] font-black text-white shadow-md shadow-emerald-500/30">
                          <CheckIcon className="h-2.5 w-2.5" /> Aprobar
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Placas flotantes — calmas, sin rebote ni confetti */}
                <div className="absolute -right-4 top-14 flex items-center gap-1.5 rounded-2xl bg-emerald-500 px-3 py-2 shadow-xl">
                  <CheckIcon className="h-3.5 w-3.5 text-white" />
                  <p className="text-xs font-black text-white">Aprobado</p>
                </div>
                <div className="absolute -left-4 bottom-24 flex items-center gap-1.5 rounded-2xl bg-white px-3 py-2 shadow-xl ring-1 ring-slate-200">
                  <span className="text-emerald-500">{I.wa}</span>
                  <p className="text-[10px] font-bold text-slate-600">Compartido por WA</p>
                </div>
              </div>
          </div>
        </div>
      </section>

      {/* ══ 7 DÍAS GRATIS ═══════════════════════════════════════════════════════ */}
      <section id="prueba" className="px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="grid items-center gap-12 lg:grid-cols-2">

            {/* Left: Big number + copy */}
            <div>
              <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-orange-500">
                Sin tarjeta · Sin contrato · Sin riesgos
              </p>
              <h2 className="text-3xl font-black leading-tight tracking-tight text-slate-900 sm:text-5xl">
                Probá el sistema{" "}
                <span className="text-orange-500">7 días</span>{" "}
                completamente gratis
              </h2>
              <p className="mt-5 text-base leading-relaxed text-slate-500">
                Creás tu cuenta, cargás los datos de tu taller y empezás a trabajar
                en minutos. Si a los 7 días te sirve, nos escribís por WhatsApp y
                te asesoramos para que sigas. <strong className="font-semibold text-slate-700">Así de simple.</strong>
              </p>

              {/* Steps */}
              <ol className="mt-8 space-y-4">
                {[
                  { n: "01", t: "Registrate", d: "Nombre, taller y listo. 2 minutos." },
                  { n: "02", t: "Explorá el sistema", d: "Cargá clientes, vehículos, órdenes de trabajo y presupuestos." },
                  { n: "03", t: "Si te gusta, seguimos", d: "Nos escribís y te asesoramos personalmente por WhatsApp." },
                ].map(({ n, t, d }) => (
                  <li key={n} className="flex items-start gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-orange-100 text-sm font-black text-orange-600">
                      {n}
                    </span>
                    <div>
                      <p className="font-bold text-slate-800">{t}</p>
                      <p className="text-sm text-slate-500">{d}</p>
                    </div>
                  </li>
                ))}
              </ol>

              <div className="mt-10 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/registro"
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 px-7 py-4 text-sm font-black text-white shadow-lg shadow-orange-500/30 transition hover:from-orange-600 hover:to-orange-700 active:scale-95"
                >
                  Empezar los 7 días gratis
                  <span>{I.arrow}</span>
                </Link>
                <a
                  href={`https://wa.me/${WA_SOPORTE}?text=${encodeURIComponent("Hola! Quiero saber más sobre Tallerista antes de registrarme")}`}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-7 py-4 text-sm font-black text-white transition hover:bg-[#1ebe5d] active:scale-95"
                >
                  {I.wa}
                  Consultar antes
                </a>
              </div>
            </div>

            {/* Right: Feature list card */}
            <div className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 p-8 shadow-2xl ring-1 ring-white/5">
              <p className="mb-1 text-[11px] font-black uppercase tracking-widest text-orange-400">
                Los 7 días incluyen
              </p>
              <p className="mb-6 text-lg font-black text-white">Todo. Sin restricciones.</p>

              <ul className="space-y-4">
                {[
                  "Clientes y vehículos ilimitados",
                  "Presupuestos digitales con link de cliente",
                  "Órdenes de trabajo completas",
                  "Estado del taller en tiempo real",
                  "Portal del cliente con aprobación online",
                  "Control de caja y cuenta corriente",
                  "Agenda de turnos",
                  "Anda perfecto desde el celular",
                  "Soporte por WhatsApp si te trabás",
                ].map((f) => (
                  <li key={f} className="flex items-center gap-3 text-sm text-slate-300">
                    <svg className="h-4 w-4 shrink-0 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              <div className="mt-8 rounded-2xl bg-white/5 px-5 py-4 ring-1 ring-white/10">
                <p className="text-sm text-slate-400">
                  <strong className="text-white">Al terminar los 7 días</strong>, si el sistema te sirvió,
                  nos escribís por WhatsApp y te damos continuidad al precio acordado en pesos argentinos.
                  Nada automático, nada sorpresivo.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ CTA FINAL + FAM DESARROLLOS ═══════════════════════════════════════════ */}
      {/* Lado a lado en vez de apilado: son dos mensajes independientes, uno       */}
      {/* debajo del otro solo estiraba la sección sin necesidad.                  */}
      <section id="contacto" className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 px-4 py-20 sm:py-24">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/4 top-0 h-64 w-64 -translate-y-1/2 rounded-full bg-orange-500/15 blur-3xl" />
          <div className="absolute -right-20 bottom-0 h-72 w-72 rounded-full bg-orange-500/10 blur-3xl" />
        </div>

        <div className="relative mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">

          {/* Oferta principal */}
          <div className="text-center lg:text-left">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-2xl shadow-orange-500/40 lg:mx-0">
              <span className="text-lg font-black text-white">TA</span>
            </div>

            <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
              ¿Listo para modernizar tu taller?
            </h2>
            <p className="mx-auto mt-4 max-w-md text-base text-slate-400 lg:mx-0">
              Empezá hoy. Sin instalación, sin contrato. Abrís el navegador
              y ya está funcionando — desde el celular o la PC.
            </p>

            <div className="mt-8 flex justify-center lg:justify-start">
              <Link
                href="/registro"
                className="flex w-full max-w-xs items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 px-8 py-4 text-base font-black text-white shadow-lg shadow-orange-500/30 transition hover:from-orange-600 hover:to-orange-700 active:scale-[0.98] sm:w-auto"
              >
                Empezar 7 días gratis
                <span>{I.arrow}</span>
              </Link>
            </div>
          </div>

          {/* Nota de la casa — separada por un borde, no apilada abajo */}
          <div className="border-t border-white/10 pt-10 text-center lg:border-l lg:border-t-0 lg:pl-16 lg:pt-0 lg:text-left">
            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-orange-400">
              Un producto de FAM Desarrollos
            </p>
            <h3 className="mt-2.5 text-xl font-black tracking-tight text-white sm:text-2xl">
              ¿Tu negocio necesita algo a medida?
            </h3>
            <p className="mx-auto mt-2.5 max-w-sm text-sm leading-relaxed text-slate-400 lg:mx-0">
              Tallerista es nuestro sistema listo para usar. Si lo tuyo es otro rubro,
              también desarrollamos sitios y sistemas desde cero.
            </p>

            <div className="mt-5 flex justify-center lg:justify-start">
              <a
                href="https://famdesarrollos.com.ar"
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-2 rounded-2xl border border-white/15 px-6 py-3.5 text-sm font-bold text-white transition hover:border-orange-500/50 hover:bg-orange-500/10"
              >
                famdesarrollos.com.ar
                <svg className="h-4 w-4 transition group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ══════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-slate-200 bg-slate-50">
        {/* Footer principal — marca a la izquierda, enlaces agrupados y     */}
        {/* pegados entre sí a la derecha, un solo hueco intencional entre   */}
        {/* ambos en vez de tres columnas fr que se estiran cada una sola.   */}
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-12 lg:flex-row lg:items-start lg:justify-between lg:gap-20">

            {/* Marca */}
            <div className="max-w-xs">
              <div className="flex items-center gap-3">
                <LogoOS size="sm" />
                <div>
                  <BrandName className="text-base font-black" />
                  <p className="text-[10px] font-medium text-slate-400 leading-tight">
                    El sistema operativo de tu taller
                  </p>
                </div>
              </div>
              <p className="mt-4 text-sm leading-relaxed text-slate-500">
                Presupuestos, órdenes de trabajo, estado del taller y portal del cliente,
                todo en un solo lugar.
              </p>
              <p className="mt-3 text-xs text-slate-400">
                Pensado para los mejores talleres
              </p>
            </div>

            {/* Enlaces — Producto y Cuenta, uno al lado del otro, compactos */}
            <div className="flex gap-16 sm:gap-20">
              <div>
                <p className="mb-3.5 text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Producto
                </p>
                <ul className="space-y-2.5">
                  <li><a href="#features" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">Funciones</a></li>
                  <li><a href="#portal" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">Cómo funciona</a></li>
                  <li><a href="#prueba" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">Probá gratis</a></li>
                </ul>
              </div>

              <div>
                <p className="mb-3.5 text-[11px] font-black uppercase tracking-widest text-slate-400">
                  Cuenta
                </p>
                <ul className="space-y-2.5">
                  <li><Link href="/login" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">Acceder</Link></li>
                  <li><Link href="/registro" className="text-sm font-medium text-slate-600 transition hover:text-slate-900">Crear cuenta</Link></li>
                  <li>
                    <a
                      href={`https://wa.me/${WA_SOPORTE}`}
                      className="text-sm font-medium text-[#25D366] transition hover:text-[#1ebe5d]"
                    >
                      WhatsApp
                    </a>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer inferior — copyright + crédito */}
        <div className="border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-2 sm:flex-row lg:px-4">
            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()}{" "}
              <span className="font-semibold">
                <span className="text-slate-600">Taller</span>
                <span className="text-orange-500">ista</span>
              </span>
              {" "}· Todos los derechos reservados
            </p>

            {/* ── Crédito de la casa ── */}
            <p className="inline-flex items-center gap-1.5 text-xs text-slate-400">
              Desarrollado por
              <a
                href="https://famdesarrollos.com.ar"
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-slate-600 underline-offset-2 transition hover:text-orange-500 hover:underline"
              >
                FAM Desarrollos
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
