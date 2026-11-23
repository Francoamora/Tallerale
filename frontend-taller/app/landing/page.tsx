/**
 * Landing pública de Tallerista (se sirve en la raíz para quien no tiene sesión).
 * Portada con el video del taller, un motor 3D que se desarma al bajar y las
 * funciones como un abanico de repuestos. Grafito cálido + naranja de marca.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { AbanicoRepuestos } from "@/components/abanico-repuestos";
import { ContadorVisitas } from "@/components/contador-visitas";
import { DisenoCapturas } from "@/components/celular-cliente";
import { MotorDespiece } from "@/components/motor-despiece";
import { LandingNav } from "@/components/landing-nav";
import { MarcaTallerista } from "@/components/marca-tallerista";
import { WA_SOPORTE } from "@/lib/trial";
import { SEO, SITE_URL } from "@/lib/seo";

// absolute: sin el sufijo "| Tallerista" del layout, que duplicaba la marca.
// canonical "/": la landing se sirve en la raíz; /landing apunta ahí.
export const metadata: Metadata = {
  title: { absolute: SEO.title },
  description: SEO.description,
  keywords: "sistema para taller mecánico, software taller mecánico, gestión de taller, órdenes de trabajo, presupuesto digital, turnos taller, argentina",
  alternates: { canonical: "/" },
  // La imagen de app/opengraph-image va explícita: al definir openGraph en este
  // segmento, Next reemplaza el del layout y la imagen se perdía.
  openGraph: { title: SEO.title, description: SEO.description, url: "/", images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: SEO.tagline }] },
  twitter: { title: SEO.title, description: SEO.description, images: ["/opengraph-image"] },
};

/** Qué es Tallerista, en el formato que leen Google y las IAs. */
const JSON_LD = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "SoftwareApplication",
      "@id": `${SITE_URL}/#app`,
      name: "Tallerista",
      url: SITE_URL,
      description: SEO.description,
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Gestión de talleres mecánicos",
      operatingSystem: "Web, Android, iOS",
      inLanguage: "es-AR",
      audience: { "@type": "BusinessAudience", audienceType: "Talleres mecánicos" },
      featureList: [
        "Presupuestos digitales que el cliente aprueba desde el celular",
        "Órdenes de trabajo y tablero del taller",
        "Agenda de turnos con confirmación por WhatsApp",
        "Clientes y vehículos con historial y próximo service",
        "Portal del vehículo para el cliente",
        "Caja, gastos y planilla para el contador",
        "Usuarios y permisos para el equipo",
      ],
      publisher: { "@id": "https://famdesarrollos.com.ar/#organization" },
    },
    { "@type": "Organization", "@id": "https://famdesarrollos.com.ar/#organization", name: "FAM Desarrollos", url: "https://famdesarrollos.com.ar", sameAs: ["https://www.instagram.com/famdesarrollos/"] },
  ],
};

const WA_ICONO = (
  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35ZM12.04 21.5a9.45 9.45 0 0 1-4.82-1.32l-.35-.2-3.58.94.96-3.49-.23-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.22 4.25-9.47 9.48-9.47a9.47 9.47 0 0 1 9.47 9.48c0 5.22-4.25 9.46-9.47 9.46Zm8.06-17.53A11.3 11.3 0 0 0 12.04.63C5.76.63.65 5.74.65 12.02c0 2 .52 3.96 1.52 5.69L.55 23.6l6.04-1.58a11.4 11.4 0 0 0 5.44 1.39c6.28 0 11.39-5.11 11.39-11.39 0-3.04-1.19-5.9-3.34-8.05Z" />
  </svg>
);
const FLECHA = (
  <svg className="h-4 w-4 transition group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>
);
const waLink = (texto: string) => `https://wa.me/${WA_SOPORTE}?text=${encodeURIComponent(texto)}`;

// ─── Página ──────────────────────────────────────────────────────────────────
const OSCURO = "#0f1113";
const PRUEBA = [
  { cuando: "Hoy", titulo: "Creás la cuenta", texto: "Nombre del taller y listo. En dos minutos estás cargando tu primer auto." },
  { cuando: "Esta semana", titulo: "Lo usás de verdad", texto: "Con tus clientes y tu equipo. Todo incluido, sin funciones bloqueadas." },
  { cuando: "Día 7", titulo: "Si te sirvió, seguimos", texto: "Nos escribís por WhatsApp y te acompañamos. Nada automático, nada sorpresivo." },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen antialiased" style={{ background: OSCURO }}>
      <LandingNav />
      <ContadorVisitas />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD).replace(/</g, "\\u003c") }} />

      {/* ══ Portada: el taller de fondo, el mensaje encima ══ */}
      <section className="relative isolate flex min-h-dvh flex-col justify-center overflow-hidden" style={{ background: OSCURO }}>
        {/* En la compu el video se corre a la derecha: el mecánico queda al costado del texto, no detrás. */}
        <video className="absolute inset-0 h-full w-full object-cover object-[30%_28%] lg:left-[22%] lg:w-[78%] lg:object-[50%_30%]" poster="/images/taller-hero-poster.jpg" autoPlay muted loop playsInline preload="auto">
          <source src="/videos/taller-hero.mp4" type="video/mp4" />
        </video>
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(15,17,19,.97)_0%,rgba(15,17,19,.88)_45%,rgba(15,17,19,.55)_75%,rgba(15,17,19,.35)_100%)] lg:bg-[linear-gradient(90deg,rgba(15,17,19,1)_0%,rgba(15,17,19,1)_22%,rgba(15,17,19,.82)_40%,rgba(15,17,19,.25)_68%,rgba(15,17,19,.1)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40" style={{ background: `linear-gradient(to bottom, ${OSCURO}, transparent)` }} />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40" style={{ background: `linear-gradient(to top, ${OSCURO}, transparent)` }} />

        <div className="relative mx-auto w-full max-w-7xl px-4 pb-24 pt-32 sm:px-8">
          <span className="block h-1.5 w-14 rounded-full bg-brand-500" aria-hidden="true" />
          <h1 className="mt-7 font-display text-[3.4rem] font-extrabold leading-[0.88] tracking-tight text-white sm:text-8xl xl:text-[7.5rem]">
            Tu taller,
            <span className="block">ordenado.</span>
            <span className="block text-brand-500">Tus clientes,</span>
            <span className="block text-brand-500">avisados.</span>
          </h1>
          <p className="mt-8 max-w-lg text-lg leading-relaxed text-zinc-300 sm:text-xl">
            Órdenes, presupuestos, turnos y caja en un solo sistema para tu taller mecánico. Y cada cliente, al tanto de todo por WhatsApp.
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link href="/registro" className="group inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-2xl bg-brand-600 px-8 py-4 text-base font-bold text-white shadow-2xl shadow-brand-600/40 transition hover:bg-brand-700">Probar 7 días gratis {FLECHA}</Link>
            <a href={waLink("Hola! Quiero saber más sobre Tallerista")} className="inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-4 text-base font-semibold text-white ring-1 ring-white/25 backdrop-blur transition hover:bg-white/10">{WA_ICONO} Hablemos por WhatsApp</a>
          </div>
          <p className="mt-5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-400">
            <span>Sin tarjeta</span><span className="h-1 w-1 rounded-full bg-brand-500" aria-hidden="true" /><span>Sin contrato</span><span className="h-1 w-1 rounded-full bg-brand-500" aria-hidden="true" /><span>Sin instalar nada</span>
          </p>
        </div>

        <a href="#como-funciona" className="absolute bottom-7 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-2 text-xs font-semibold text-zinc-400 transition hover:text-white sm:flex">
          Mirá cómo funciona
          <span className="flex h-9 w-6 justify-center rounded-full ring-1 ring-white/25"><span className="mt-2 h-2 w-1 animate-bounce rounded-full bg-white/70" /></span>
        </a>
      </section>

      {/* ══ El motor que se desarma ══ */}
      <MotorDespiece />

      {/* ══ Todo lo que trae, como un abanico de repuestos ══ */}
      <AbanicoRepuestos />

      {/* ══ Lo que ve tu cliente: capturas que cambian al bajar ══ */}
      <DisenoCapturas />

      {/* ══ 7 días gratis ══ */}
      <section id="contacto" className="relative scroll-mt-16 overflow-hidden px-4 py-24 sm:py-32" style={{ background: OSCURO }}>
        <div className="pointer-events-none absolute -top-40 left-1/4 h-96 w-96 rounded-full bg-brand-600/20 blur-3xl" aria-hidden="true" />
        <div className="relative mx-auto grid max-w-7xl gap-14 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div>
            <h2 className="font-display text-5xl font-extrabold leading-[0.9] tracking-tight text-white sm:text-7xl">
              Probalo 7 días
              <span className="block text-brand-500">con tu taller de verdad.</span>
            </h2>
            <p className="mt-6 max-w-lg text-lg text-zinc-300">Sin tarjeta, sin contrato y sin instalar nada. Lo abrís en el celular o en la compu y arrancás hoy.</p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <Link href="/registro" className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-8 py-4 text-base font-bold text-white shadow-2xl shadow-brand-600/30 transition hover:bg-brand-700">Empezar gratis {FLECHA}</Link>
              <a href={waLink("Hola! Quiero saber más sobre Tallerista antes de registrarme")} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-7 py-4 text-base font-semibold text-white transition hover:bg-emerald-700">{WA_ICONO} Consultar por WhatsApp</a>
            </div>
          </div>

          {/* Cómo son los 7 días */}
          <ol className="relative space-y-9 border-l-2 border-white/10 pl-8">
            {PRUEBA.map((p, i) => (
              <li key={p.cuando} className="relative">
                <span className={`absolute -left-[43px] top-0.5 flex h-5 w-5 items-center justify-center rounded-full ring-4 ring-[#0f1113] ${i === PRUEBA.length - 1 ? "bg-brand-500" : "bg-zinc-600"}`} />
                <p className="text-sm font-semibold text-brand-400">{p.cuando}</p>
                <p className="mt-1 font-display text-2xl font-extrabold text-white sm:text-3xl">{p.titulo}</p>
                <p className="mt-1.5 max-w-md text-zinc-400">{p.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ══ Pie ══ */}
      <footer className="border-t border-white/10 bg-[#0a0b0c] px-4 pt-16">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr] lg:gap-12">
          <div className="col-span-2 max-w-sm lg:col-span-1">
            <div className="flex items-center gap-3">
              <MarcaTallerista className="h-10 w-10" />
              <div>
                <p className="font-display text-xl font-extrabold leading-none text-white">Tallerista</p>
                <p className="mt-1 text-sm text-zinc-400">La herramienta amiga de los talleres</p>
              </div>
            </div>
            <p className="mt-5 text-sm leading-relaxed text-zinc-400">Órdenes, presupuestos, turnos, caja y el portal para tus clientes. Hecho en Argentina, pensado para el taller de todos los días.</p>
            <a href={waLink("Hola! Quiero saber más sobre Tallerista")} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white/5 px-4 py-2.5 text-sm font-semibold text-white ring-1 ring-white/10 transition hover:bg-white/10">{WA_ICONO} Escribinos</a>
          </div>
          {[
            { titulo: "Producto", links: [["Cómo funciona", "#como-funciona"], ["Funciones", "#features"], ["Tu cliente", "#cliente"], ["Probar 7 días gratis", "/registro"]] },
            { titulo: "Tu cuenta", links: [["Entrar", "/login"], ["Crear cuenta", "/registro"]] },
            { titulo: "FAM Desarrollos", links: [["famdesarrollos.com.ar", "https://famdesarrollos.com.ar"], ["Programa para taller mecánico", "https://famdesarrollos.com.ar/soluciones/programa-para-taller-mecanico"], ["Instagram", "https://www.instagram.com/famdesarrollos/"]] },
          ].map((col) => (
            <div key={col.titulo}>
              <p className="text-sm font-semibold text-white">{col.titulo}</p>
              <ul className="mt-3 space-y-1 text-sm">
                {col.links.map(([t, href]) => (
                  <li key={t}>
                    {href.startsWith("/") ? (
                      <Link href={href} className="inline-block py-1.5 text-zinc-400 transition hover:text-white">{t}</Link>
                    ) : (
                      <a href={href} {...(href.startsWith("http") ? { target: "_blank", rel: "noopener" } : {})} className="inline-block py-1.5 text-zinc-400 transition hover:text-white">{t}</a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-14 flex max-w-7xl flex-col gap-2 border-t border-white/10 py-6 text-xs text-zinc-500 sm:flex-row sm:justify-between">
          <p>© {new Date().getFullYear()} Tallerista. Todos los derechos reservados.</p>
          <p>Desarrollado por <a href="https://famdesarrollos.com.ar" target="_blank" rel="noopener noreferrer" className="font-semibold text-zinc-300 hover:text-brand-400">FAM Desarrollos</a></p>
        </div>
      </footer>
    </div>
  );
}
