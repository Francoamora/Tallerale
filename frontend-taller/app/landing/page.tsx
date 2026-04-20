/**
 * app/landing/page.tsx
 *
 * Landing page pública de TallerOS.
 * Marca: TallerOS — "El sistema operativo de tu taller"
 * Dominio sugerido: talleros.com.ar / tutallermecanico.com.ar (alias SEO)
 */
import type { Metadata } from "next";
import Link from "next/link";
import { LandingNav } from "@/components/landing-nav";

export const metadata: Metadata = {
  title: "TallerOS · El sistema operativo de tu taller mecánico",
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
};

// ─── Logo TallerOS ────────────────────────────────────────────────────────────
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
      <span className="text-orange-500">OS</span>
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
      <section className="relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-800 to-slate-900 px-4 py-24 sm:py-36">
        {/* Blobs decorativos */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute left-1/2 top-0 h-[500px] w-[800px] -translate-x-1/2 -translate-y-1/4 rounded-full bg-orange-500/10 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-blue-500/8 blur-3xl" />
          <div className="absolute bottom-0 right-0 h-72 w-72 rounded-full bg-orange-500/8 blur-3xl" />
          {/* Grid pattern sutil */}
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: "linear-gradient(rgba(255,255,255,.8) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.8) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }} />
        </div>

        <div className="relative mx-auto max-w-4xl text-center">
          {/* Badge animado */}
          <div className="mb-8 inline-flex items-center gap-2.5 rounded-full bg-orange-500/10 px-5 py-2 ring-1 ring-orange-500/25">
            <span className="h-2 w-2 animate-pulse rounded-full bg-orange-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-orange-300">
              🇦🇷 Hecho para talleres argentinos
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-5xl font-black leading-[1.05] tracking-tight text-white sm:text-7xl">
            El sistema{" "}
            <br className="hidden sm:block" />
            operativo de{" "}
            <span className="bg-gradient-to-r from-orange-400 via-orange-500 to-orange-400 bg-clip-text text-transparent">
              tu taller
            </span>
          </h1>

          {/* Subtítulo */}
          <p className="mx-auto mt-7 max-w-2xl text-lg leading-relaxed text-slate-400 sm:text-xl">
            Presupuestos digitales, órdenes de trabajo, estado del taller,{" "}
            <strong className="font-semibold text-slate-200">portal del cliente</strong>{" "}
            y control de caja. Todo desde el celular, sin papeles, sin complicaciones.
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/registro"
              className="group flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 px-8 py-4 text-base font-black text-white shadow-2xl shadow-orange-500/40 transition hover:from-orange-600 hover:to-orange-700 active:scale-[0.98] sm:w-auto"
            >
              Empezar gratis — 7 días
              <svg className="h-4 w-4 transition group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
            <a
              href="#portal"
              className="flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-8 py-4 text-base font-semibold text-slate-300 transition hover:border-white/25 hover:bg-white/5 hover:text-white sm:w-auto"
            >
              Ver Portal del Cliente
            </a>
          </div>

          {/* Stats strip */}
          <div className="mt-16 grid grid-cols-3 gap-4 border-t border-white/10 pt-12 sm:gap-12">
            {[
              { v: "100%",  l: "Digital · Sin papel" },
              { v: "5 min", l: "Para crear una OT completa" },
              { v: "📱",    l: "Funciona en el celular" },
            ].map(({ v, l }) => (
              <div key={l} className="text-center">
                <p className="text-3xl font-black text-white sm:text-4xl">{v}</p>
                <p className="mt-1 text-xs font-medium text-slate-500 sm:text-sm">{l}</p>
              </div>
            ))}
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
              No es un ERP genérico adaptado. Es la herramienta que un mecánico
              necesita, pensada desde cero para el día a día del taller argentino.
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
                "Auto-refresh cada 60 segundos",
                "Total de facturación por columna",
                "Alertas de días en taller",
              ]}
            />
            <FeatureCard
              icon={I.users}
              title="Directorio de Clientes"
              desc="Ficha completa de cada cliente: historial, saldo, vehículos y cuenta corriente en un solo lugar."
              color="bg-emerald-50 text-emerald-600"
              items={[
                "Cuenta corriente con saldo de deuda",
                "Historial completo de OTs y presupuestos",
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
                "Ingresos y egresos categorizados",
                "Evolución de facturación mensual",
                "Ticket promedio y tendencias",
                "Cuenta corriente por cliente",
              ]}
            />
            <FeatureCard
              icon={I.phone}
              title="100% Mobile-First"
              desc="Diseñado para el celular. Sin apps que instalar — todo desde el navegador, en cualquier dispositivo."
              color="bg-slate-100 text-slate-600"
              items={[
                "Navbar inferior nativa para móvil",
                "Botones touch del tamaño correcto",
                "Compartir por WhatsApp en un tap",
                "Modo oscuro automático",
              ]}
            />
          </div>
        </div>
      </section>

      {/* ══ PORTAL DEL CLIENTE ══════════════════════════════════════════════════ */}
      <section id="portal" className="bg-gradient-to-b from-slate-900 to-slate-800 px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-5xl">
          <div className="grid items-center gap-14 lg:grid-cols-2">

            {/* Texto */}
            <div>
              <p className="mb-3 text-[11px] font-black uppercase tracking-widest text-orange-400">
                La diferencia que te pone adelante
              </p>
              <h2 className="text-3xl font-black leading-tight tracking-tight text-white sm:text-4xl">
                Tu competencia manda PDFs.{" "}
                <span className="text-orange-400">Vos mandás un link.</span>
              </h2>
              <p className="mt-5 text-base leading-relaxed text-slate-400">
                El Portal del Cliente de TallerOS es una página personalizada para cada
                presupuesto u orden de trabajo. El cliente la abre en su celular, ve todo
                el detalle y <strong className="font-semibold text-slate-200">puede aprobar o rechazar con un botón</strong> — sin apps, sin PDF de 5MB, sin llamadas.
              </p>

              <ul className="mt-8 space-y-4">
                {[
                  { e: "🔗", t: "Link único por presupuesto — el cliente no necesita cuenta ni contraseña" },
                  { e: "✅", t: "Aprueba o rechaza con un botón. Vos recibís la notificación al instante" },
                  { e: "🚗", t: "Portal del vehículo: historial completo + barra de próximo service en KM" },
                  { e: "📤", t: "Compartí por WhatsApp con navigator.share() nativo del celular" },
                  { e: "🎊", t: "Confetti animado cuando el cliente aprueba — experiencia memorable" },
                ].map(({ e, t }) => (
                  <li key={t} className="flex items-start gap-3.5">
                    <span className="shrink-0 text-xl">{e}</span>
                    <span className="text-sm leading-snug text-slate-300">{t}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-10">
                <Link
                  href="/registro"
                  className="inline-flex items-center gap-2 rounded-2xl bg-orange-500 px-7 py-4 text-sm font-black text-white shadow-lg shadow-orange-500/30 transition hover:bg-orange-600 active:scale-95"
                >
                  Probarlo ahora — 7 días gratis
                  <span>{I.arrow}</span>
                </Link>
              </div>
            </div>

            {/* Mockup del portal */}
            <div className="relative mx-auto w-72">
              {/* Teléfono */}
              <div className="mx-auto w-64 rounded-[2.5rem] bg-slate-700 p-3 shadow-2xl ring-4 ring-white/5">
                <div className="overflow-hidden rounded-[2rem] bg-gradient-to-b from-slate-50 to-white">
                  {/* Notch */}
                  <div className="flex justify-center pt-3 pb-2">
                    <div className="h-1.5 w-12 rounded-full bg-slate-200" />
                  </div>
                  {/* Header portal */}
                  <div className="border-b border-slate-100 px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-orange-500 text-[8px] font-black text-white">OS</div>
                      <div>
                        <p className="text-[9px] font-black text-slate-900">TallerOS</p>
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
                        <div className="rounded-xl bg-sky-50 px-2 py-1 text-center ring-1 ring-sky-200">
                          <span className="block text-sm">📨</span>
                          <span className="block text-[7px] font-black uppercase text-sky-600">Enviado</span>
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
                        <span className="text-base">🚗</span>
                        <div>
                          <p className="font-mono text-xs font-black text-slate-900">ABC 123</p>
                          <p className="text-[9px] text-slate-500">Toyota Corolla · 2019</p>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Sticky bar */}
                  <div className="border-t border-slate-100 bg-white px-3 py-3">
                    <p className="mb-2 text-center text-[8px] font-semibold text-slate-400">¿Aprobás este presupuesto?</p>
                    <div className="flex gap-2">
                      <div className="flex flex-1 items-center justify-center gap-1 rounded-xl border-2 border-slate-200 py-2 text-[9px] font-black text-slate-500">
                        ✕ Rechazar
                      </div>
                      <div className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-emerald-500 py-2 text-[9px] font-black text-white shadow-md shadow-emerald-500/30">
                        ✓ Aprobar
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Floating badges */}
              <div className="absolute -right-6 top-16 animate-bounce rounded-2xl bg-emerald-500 px-3 py-2 shadow-xl" style={{ animationDuration: "2.5s" }}>
                <p className="text-xs font-black text-white">🎊 ¡Aprobado!</p>
              </div>
              <div className="absolute -left-6 bottom-28 rounded-2xl bg-white px-3 py-2 shadow-xl ring-1 ring-slate-200">
                <p className="text-[10px] font-bold text-slate-600">📲 Compartido por WA</p>
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
              <h2 className="text-4xl font-black leading-tight tracking-tight text-slate-900 sm:text-5xl">
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
                  { n: "02", t: "Explorá el sistema", d: "Cargá clientes, vehículos, OTs y presupuestos." },
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
                  href="https://wa.me/543482277706?text=Hola!%20Quiero%20saber%20m%C3%A1s%20sobre%20TallerOS%20antes%20de%20registrarme"
                  target="_blank"
                  rel="noopener noreferrer"
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
                  "Modo oscuro · Mobile-First",
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

      {/* ══ CTA FINAL ═══════════════════════════════════════════════════════════ */}
      <section id="contacto" className="bg-slate-50 px-4 py-20 sm:py-28">
        <div className="mx-auto max-w-3xl">
          <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 px-8 py-16 text-center shadow-2xl ring-1 ring-white/5">
            {/* Glow */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute left-1/2 top-0 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-500/15 blur-3xl" />
            </div>

            <div className="relative">
              {/* Logo grande */}
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-orange-500 to-orange-600 shadow-2xl shadow-orange-500/40">
                <span className="text-xl font-black text-white">OS</span>
              </div>

              <h2 className="text-3xl font-black tracking-tight text-white sm:text-4xl">
                ¿Listo para modernizar tu taller?
              </h2>
              <p className="mx-auto mt-4 max-w-md text-base text-slate-400">
                Empezá hoy. Sin instalación, sin contrato. Abrís el navegador
                y ya está funcionando — desde el celular o la PC.
              </p>

              <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
                <Link
                  href="/registro"
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-orange-500 to-orange-600 px-8 py-4 text-base font-black text-white shadow-lg shadow-orange-500/30 transition hover:from-orange-600 hover:to-orange-700 active:scale-[0.98] sm:w-auto"
                >
                  Empezar 7 días gratis
                  <span>{I.arrow}</span>
                </Link>
                <a
                  href="https://wa.me/543482277706?text=Hola!%20Quiero%20info%20sobre%20TallerOS"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#25D366] px-8 py-4 text-base font-black text-white transition hover:bg-[#1ebe5d] active:scale-[0.98] sm:w-auto"
                >
                  {I.wa}
                  Consultar por WhatsApp
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══ FOOTER ══════════════════════════════════════════════════════════════ */}
      <footer className="border-t border-slate-200 bg-slate-50">
        {/* Footer principal */}
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-8 sm:flex-row sm:items-start">

            {/* Marca */}
            <div className="text-center sm:text-left">
              <div className="flex items-center justify-center gap-3 sm:justify-start">
                <LogoOS size="sm" />
                <div>
                  <BrandName className="text-base font-black" />
                  <p className="text-[10px] font-medium text-slate-400 leading-tight">
                    El sistema operativo de tu taller
                  </p>
                </div>
              </div>
              <p className="mt-3 text-xs text-slate-400">
                🇦🇷 Software argentino para talleres mecánicos argentinos
              </p>
            </div>

            {/* Links */}
            <div className="flex flex-wrap justify-center gap-x-8 gap-y-2 sm:justify-end">
              <a href="#features" className="text-sm font-medium text-slate-500 transition hover:text-slate-900">Funciones</a>
              <a href="#portal" className="text-sm font-medium text-slate-500 transition hover:text-slate-900">Portal del Cliente</a>
              <a href="#prueba" className="text-sm font-medium text-slate-500 transition hover:text-slate-900">Probá gratis</a>
              <Link href="/login" className="text-sm font-medium text-slate-500 transition hover:text-slate-900">Acceder</Link>
              <a
                href="https://wa.me/543482277706"
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm font-medium text-[#25D366] transition hover:text-[#1ebe5d]"
              >
                WhatsApp
              </a>
            </div>
          </div>
        </div>

        {/* Footer inferior — copyright + crédito */}
        <div className="border-t border-slate-200 bg-white px-4 py-4 sm:px-6">
          <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 sm:flex-row">
            <p className="text-xs text-slate-400">
              © {new Date().getFullYear()}{" "}
              <span className="font-semibold">
                <span className="text-slate-600">Taller</span>
                <span className="text-orange-500">OS</span>
              </span>
              {" "}· tutallermecanico.com.ar · Todos los derechos reservados
            </p>

            {/* ── Crédito FAM Soluciones con tooltip de teléfono ── */}
            <div className="group relative inline-flex items-center gap-1.5">
              <span className="text-xs text-slate-400">Desarrollado por</span>
              <span className="relative cursor-default">
                <span className="text-xs font-bold text-slate-600 transition group-hover:text-orange-500">
                  FAM Soluciones
                </span>
                {/* Tooltip con teléfono — aparece al hover */}
                <span className="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-slate-900 px-3 py-1.5 text-[11px] font-bold text-white opacity-0 shadow-lg transition-all duration-200 group-hover:-translate-y-1 group-hover:opacity-100">
                  📱 3482277706
                  {/* Triangulito */}
                  <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
                </span>
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
