"use client";

/**
 * Las funciones de Tallerista como un abanico de repuestos (rueda, aceite,
 * freno…): el elegido sube al centro y cuenta lo suyo. Gira solo hasta que el
 * visitante toca uno. En lugar de una grilla de tarjetas.
 */
import { useEffect, useState } from "react";

const S = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const REPUESTOS = [
  {
    nombre: "La llave", titulo: "Órdenes de trabajo", texto: "Abrís la orden con un toque. El mecánico tilda lo que hizo y suma lo que apareció, aunque tenga las manos sucias.",
    icono: <path {...S} d="M38 10a10 10 0 0 0-12.6 12.6L11 37a4.2 4.2 0 0 0 6 6l14.4-14.4A10 10 0 0 0 44 16l-6 6-5.5-1.5L31 15l7-5Z" />,
  },
  {
    nombre: "El freno", titulo: "Presupuestos", texto: "Le llega por WhatsApp, lo ve prolijo en el celular y lo aprueba con un botón. Se acabó el “¿cuánto me sale?”.",
    icono: <g {...S}><circle cx="24" cy="26" r="15" /><circle cx="24" cy="26" r="5" /><circle cx="24" cy="16" r="1.2" /><circle cx="33" cy="29" r="1.2" /><circle cx="17" cy="33" r="1.2" /><path d="M33 9.5a18 18 0 0 1 8.5 11.5l-5 1.5A13 13 0 0 0 31 14Z" /></g>,
  },
  {
    nombre: "El aceite", titulo: "Próximo service", texto: "Cada auto con su kilometraje y cuándo le toca. Le avisás a tiempo y vuelve a tu taller, no a otro.",
    icono: <g {...S}><path d="M8 20h22l8-6 6 2-12 12H12a4 4 0 0 1-4-4v-4Z" /><path d="M14 20v-4h8v4" /><path d="M8 24 4 22" /><path d="M41 32c0 2-1.5 3.5-3 3.5S35 34 35 32s3-6 3-6 3 4 3 6Z" /></g>,
  },
  {
    nombre: "La rueda", titulo: "Agenda de turnos", texto: "Lista y calendario. Ves quién viene cada día y le confirmás el turno por WhatsApp.",
    icono: <g {...S}><circle cx="24" cy="24" r="17" /><circle cx="24" cy="24" r="10" /><circle cx="24" cy="24" r="2.5" /><path d="M24 14v7.5M33.5 21l-7 2.2M30 32.5l-4.4-6.3M18 32.5l4.4-6.3M14.5 21l7 2.2" /></g>,
  },
  {
    nombre: "La bujía", titulo: "Avisos por WhatsApp", texto: "Auto listo, presupuesto, turno: cada aviso sale con un toque y con el link para que vea todo.",
    icono: <g {...S}><path d="M20 4h8v6h-8z" /><path d="M18 10h12v8H18z" /><path d="M19.5 18h9l-1.5 12h-6z" /><path d="M24 30v6M24 36h5" /><path d="M36 30l4-3M38 37h5M12 30l-4-3" /></g>,
  },
  {
    nombre: "La batería", titulo: "Caja y gastos", texto: "Lo que entra y lo que sale, por día, por cliente y por medio de pago. Siempre sabés cómo estás.",
    icono: <g {...S}><rect x="6" y="14" width="36" height="24" rx="3" /><path d="M12 14v-4h6v4M30 14v-4h6v4" /><path d="M12 26h6M15 23v6M30 26h6" /></g>,
  },
  {
    nombre: "El filtro", titulo: "Planilla para el contador", texto: "Ventas, cobros y compras del mes en un Excel con tu CUIT y tu condición de IVA, listo para facturar en ARCA.",
    icono: <g {...S}><path d="M13 12h22v28a3 3 0 0 1-3 3H16a3 3 0 0 1-3-3V12Z" /><path d="M11 8h26v4H11z" /><path d="M13 20h22M13 26h22M13 32h22" /></g>,
  },
  {
    nombre: "El gato", titulo: "Tu equipo", texto: "Le creás el usuario a cada uno. El mecánico ve sus trabajos, no la plata.",
    icono: <g {...S}><path d="M6 40h30l4-4H10z" /><path d="M14 36l10-14 10 14" /><path d="M20 22h8" /><path d="M24 22v-8M19 14h10" /><path d="M34 36l8-10" /></g>,
  },
];

const PASO = 24; // grados entre repuesto y repuesto

export function AbanicoRepuestos() {
  const [elegido, setElegido] = useState(0);
  const [tocado, setTocado] = useState(false);

  useEffect(() => {
    if (tocado || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setElegido((i) => (i + 1) % REPUESTOS.length), 3800);
    return () => window.clearInterval(id);
  }, [tocado]);

  const elegir = (i: number) => { setTocado(true); setElegido((i + REPUESTOS.length) % REPUESTOS.length); };
  const r = REPUESTOS[elegido];

  return (
    <section id="features" className="relative scroll-mt-16 overflow-hidden bg-[#0f1113] px-4 pb-20 pt-20 sm:pb-28 sm:pt-28">
      <div className="pointer-events-none absolute left-1/2 top-[52%] h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-brand-600/10 blur-3xl" aria-hidden="true" />
      <div className="relative mx-auto max-w-5xl text-center">
        <h2 className="font-display text-4xl font-extrabold leading-[0.95] tracking-tight text-white sm:text-6xl">
          Cada repuesto, <span className="text-brand-500">una herramienta</span>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-zinc-400">Tocá uno y te contamos qué hace.</p>

        {/* El abanico: gira para dejar el elegido arriba al centro */}
        <div className="relative mx-auto mt-10 h-[190px] w-full max-w-[640px] sm:mt-14 sm:h-[260px]">
          <div
            className="absolute left-1/2 top-[300px] h-0 w-0 [--radio:-270px] sm:top-[420px] sm:[--radio:-380px]"
          >
            {REPUESTOS.map((x, i) => {
              const activo = i === elegido;
              // Posición relativa al elegido, dando la vuelta: el abanico siempre queda parejo a los dos lados.
              const n = REPUESTOS.length;
              const rel = ((i - elegido + n + n / 2) % n) - n / 2;
              const lejos = Math.abs(rel);
              return (
                <button
                  key={x.nombre}
                  type="button"
                  onClick={() => elegir(i)}
                  aria-label={`${x.nombre}: ${x.titulo}`}
                  aria-pressed={activo}
                  tabIndex={lejos > 2 ? -1 : 0}
                  className={`absolute left-0 top-0 origin-[0_0] transition-[transform,opacity] duration-700 [transition-timing-function:cubic-bezier(0.65,0,0.35,1)] ${lejos > 2 ? "pointer-events-none opacity-0" : lejos === 2 ? "opacity-50" : "opacity-100"}`}
                  style={{ transform: `rotate(${rel * PASO}deg) translateY(var(--radio))` }}
                >
                  <span
                    className={`-ml-9 -mt-9 flex h-[72px] w-[72px] items-center justify-center rounded-full transition-all duration-500 sm:-ml-11 sm:-mt-11 sm:h-[88px] sm:w-[88px] ${activo ? "scale-125 bg-brand-600 text-white shadow-2xl shadow-brand-600/40" : "bg-white/[0.06] text-zinc-300 ring-1 ring-white/10 hover:bg-white/10 hover:text-white"}`}
                    style={{ transform: `rotate(${-rel * PASO}deg)` }}
                  >
                    <svg viewBox="0 0 48 48" className="h-10 w-10 sm:h-12 sm:w-12" aria-hidden="true">{x.icono}</svg>
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Las 8 funciones completas, para lectores de pantalla y para que
            Google y las IAs las lean todas (en pantalla se ve una por vez). */}
        <ul className="sr-only">
          {REPUESTOS.map((x) => <li key={x.titulo}><h3>{x.titulo}</h3><p>{x.texto}</p></li>)}
        </ul>

        {/* Lo que hace el elegido */}
        <div className="mx-auto mt-2 max-w-xl" aria-hidden="true">
          <p className="text-sm font-semibold text-brand-400">{r.nombre}</p>
          <p key={r.titulo} className="mt-1 animate-in fade-in slide-in-from-bottom-2 font-display text-3xl font-extrabold text-white duration-500 sm:text-5xl">{r.titulo}</p>
          <p key={r.texto} className="mt-3 animate-in fade-in text-base leading-relaxed text-zinc-300 duration-700 sm:text-lg">{r.texto}</p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button type="button" onClick={() => elegir(elegido - 1)} aria-label="Anterior" className="flex h-11 w-11 items-center justify-center rounded-full text-white ring-1 ring-white/20 transition hover:bg-white/10">‹</button>
            <span className="min-w-14 text-sm tabular-nums text-zinc-400">{elegido + 1} / {REPUESTOS.length}</span>
            <button type="button" onClick={() => elegir(elegido + 1)} aria-label="Siguiente" className="flex h-11 w-11 items-center justify-center rounded-full text-white ring-1 ring-white/20 transition hover:bg-white/10">›</button>
          </div>
        </div>
      </div>
    </section>
  );
}
