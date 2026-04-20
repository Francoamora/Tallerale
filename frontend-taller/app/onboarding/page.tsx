"use client";

/**
 * app/onboarding/page.tsx
 *
 * Wizard de bienvenida después del registro.
 * Guía al usuario a través de los módulos principales del sistema.
 * Se muestra UNA SOLA VEZ (markOnboardingDone persiste en localStorage).
 */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession, markOnboardingDone } from "@/lib/trial";

// ─── Pasos del onboarding ─────────────────────────────────────────────────────
const PASOS = [
  {
    emoji: "👋",
    titulo: (nombre: string) => `¡Hola, ${nombre}!`,
    desc: "Te damos la bienvenida a TallerOS. En los próximos 30 segundos te mostramos cómo sacarle el máximo provecho desde el primer día.",
    cta: "Empezar →",
    href: null,
    color: "from-orange-500 to-orange-600",
  },
  {
    emoji: "👤",
    titulo: () => "Primero, agregá un cliente",
    desc: "El taller gira en torno a los clientes. Registrá a tu primer cliente con su nombre, teléfono y DNI. Así después le podés asignar un vehículo y una orden de trabajo.",
    cta: "Ir a Clientes →",
    href: "/clientes",
    color: "from-emerald-500 to-emerald-600",
    tip: "💡 Tip: podés buscar por nombre, DNI o teléfono desde cualquier pantalla.",
  },
  {
    emoji: "🚗",
    titulo: () => "Después, el vehículo",
    desc: "Cada cliente puede tener uno o más autos. Registrá la patente, marca, modelo, año y el kilometraje actual para controlar el próximo service.",
    cta: "Ir a Vehículos →",
    href: "/vehiculos",
    color: "from-sky-500 to-sky-600",
    tip: "💡 Tip: el sistema avisa cuando un auto se acerca al km de service programado.",
  },
  {
    emoji: "📋",
    titulo: () => "Creá tu primer presupuesto",
    desc: "Un presupuesto digital con tu logo. Lo mandás por WhatsApp y el cliente puede aprobarlo o rechazarlo desde su celular — sin apps, sin PDF.",
    cta: "Ir a Presupuestos →",
    href: "/presupuestos",
    color: "from-violet-500 to-violet-600",
    tip: "💡 Tip: cuando el cliente aprueba, lo convertís a Orden de Trabajo con un solo click.",
  },
  {
    emoji: "🔧",
    titulo: () => "Las Órdenes de Trabajo",
    desc: "Una OT es el registro oficial del trabajo en el auto. Cargás los ítems, el mecánico que trabajó, y al finalizar el cliente recibe el comprobante por WhatsApp.",
    cta: "Ir a Trabajos →",
    href: "/trabajos",
    color: "from-amber-500 to-amber-600",
    tip: "💡 Tip: desde el 'Estado del Taller' ves todos los autos en proceso de un vistazo.",
  },
  {
    emoji: "💰",
    titulo: () => "Controlá la caja",
    desc: "Registrá cada cobro y gasto del taller. El sistema lleva la cuenta corriente de cada cliente y te muestra la evolución de facturación mensual.",
    cta: "Ir a Caja →",
    href: "/caja",
    color: "from-rose-500 to-rose-600",
    tip: "💡 Tip: usá el filtro 'Solo con deuda' en Clientes para ver quién te debe.",
  },
  {
    emoji: "🚀",
    titulo: (nombre: string) => `¡Ya estás listo, ${nombre}!`,
    desc: "Eso es todo lo que necesitás saber para empezar. El sistema está diseñado para que sea intuitivo — si en algún momento te trabás, tenés el botón de ayuda o nos escribís por WhatsApp.",
    cta: "Ir al Panel Principal",
    href: "/",
    color: "from-orange-500 to-orange-600",
  },
];

// ─── Page ─────────────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [nombre, setNombre] = useState("Mecánico");

  useEffect(() => {
    const session = getSession();
    if (!session) {
      router.replace("/registro");
      return;
    }
    setNombre(session.owner_nombre.split(" ")[0] || "Mecánico");
  }, [router]);

  const pasoActual = PASOS[step];
  const isLast = step === PASOS.length - 1;

  function handleCta() {
    if (isLast || pasoActual.href === "/") {
      markOnboardingDone();
      router.push("/");
    } else if (pasoActual.href) {
      // Marcar done y navegar al módulo
      markOnboardingDone();
      router.push(pasoActual.href);
    } else {
      setStep((s) => s + 1);
    }
  }

  function handleSkip() {
    markOnboardingDone();
    router.push("/");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 px-4 py-12">

      {/* Fondo decorativo */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/4 rounded-full bg-orange-500/8 blur-3xl" />
      </div>

      <div className="relative w-full max-w-sm">

        {/* Marca */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-orange-500 text-[10px] font-black text-white">OS</div>
            <span className="text-sm font-black text-white">Taller<span className="text-orange-400">OS</span></span>
          </div>
        </div>

        {/* Barra de progreso */}
        <div className="mb-8 flex gap-1.5">
          {PASOS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                i <= step ? "bg-orange-500" : "bg-white/10"
              }`}
            />
          ))}
        </div>

        {/* Card del paso */}
        <div
          key={step}
          className="animate-in fade-in slide-in-from-bottom-4 rounded-3xl bg-white/[0.04] p-8 ring-1 ring-white/10 backdrop-blur-xl duration-300"
        >
          {/* Emoji */}
          <div className="mb-5 text-center text-5xl">{pasoActual.emoji}</div>

          {/* Título */}
          <h2 className="mb-3 text-center text-xl font-black text-white">
            {pasoActual.titulo(nombre)}
          </h2>

          {/* Descripción */}
          <p className="text-center text-sm leading-relaxed text-slate-400">
            {pasoActual.desc}
          </p>

          {/* Tip */}
          {"tip" in pasoActual && pasoActual.tip && (
            <div className="mt-5 rounded-2xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
              <p className="text-xs leading-relaxed text-slate-400">{pasoActual.tip}</p>
            </div>
          )}

          {/* CTA */}
          <button
            onClick={handleCta}
            className={`mt-7 w-full rounded-xl bg-gradient-to-r ${pasoActual.color} py-4 text-sm font-black text-white shadow-lg transition hover:opacity-90 active:scale-[0.98]`}
          >
            {pasoActual.cta}
          </button>

          {/* Saltar */}
          {!isLast && (
            <button
              onClick={handleSkip}
              className="mt-4 w-full text-center text-xs font-medium text-slate-600 transition hover:text-slate-400"
            >
              Saltar introducción — ir directo al panel
            </button>
          )}
        </div>

        {/* Número de paso */}
        <p className="mt-6 text-center text-xs text-slate-700">
          {step + 1} / {PASOS.length}
        </p>
      </div>
    </div>
  );
}
