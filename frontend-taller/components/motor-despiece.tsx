"use client";

/**
 * Un motor V8 en 3D que se desarma mientras bajás: "vos desarmás el motor,
 * Tallerista registra cada pieza". Cada etapa pinta de naranja la pieza que
 * se está moviendo y muestra la función que le corresponde.
 *
 * El motor está hecho con código (components/motor3d, del repo teardown, MIT):
 * se dibuja en vivo, nítido a cualquier tamaño. three.js se carga recién acá,
 * así no pesa en el resto del sitio.
 */
import { useEffect, useRef, useState } from "react";

const D2R = Math.PI / 180;
const limitar = (x: number) => Math.min(1, Math.max(0, x));
// Antes y después del despiece (para leer el título y el cierre con el motor quieto).
const ENTRADA = 0.1;
const SALIDA = 0.1;

const PASOS = [
  { desde: 0, titulo: "Abrís la orden", texto: "Entra el auto y en un toque queda la orden. El mecánico tilda lo que hace y suma lo que apareció.", pieza: "El cigüeñal" },
  { desde: 0.27, titulo: "Cada repuesto, presupuestado", texto: "Le llega por WhatsApp y lo aprueba desde el celular. Vos te enterás en el momento.", pieza: "Los balancines" },
  { desde: 0.47, titulo: "Le avisás que está listo", texto: "Un WhatsApp con el total y el link para que vea todo lo que le hiciste.", pieza: "Las tapas y las válvulas" },
  { desde: 0.67, titulo: "Cobrás y cerrás el mes", texto: "La caja se arma sola y la planilla para tu contador sale en un toque.", pieza: "Los pistones" },
];

function pasoDe(ex: number) {
  let i = 0;
  PASOS.forEach((p, j) => { if (ex >= p.desde) i = j; });
  return i;
}

export function MotorDespiece() {
  const zona = useRef<HTMLElement>(null);
  const lienzo = useRef<HTMLCanvasElement>(null);
  // -1 = título, 0..3 = pasos, 4 = cierre
  const [etapa, setEtapa] = useState(-1);
  const [avance, setAvance] = useState(0);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    const canvas = lienzo.current;
    const seccion = zona.current;
    if (!canvas || !seccion) return;
    let vivo = true;
    let visible = false;
    let pedido = 0;
    let progreso = 0;
    let ultimoScroll = 0;
    let limpiar = () => {};
    // Lo pone el 3D cuando ya está armado: vuelve a dibujar si estaba en pausa.
    let despertar = () => {};
    const quieto = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    function leerScroll() {
      if (!seccion) return;
      const r = seccion.getBoundingClientRect();
      progreso = limitar(-r.top / Math.max(1, r.height - window.innerHeight));
      ultimoScroll = performance.now();
      despertar();
      const ex = limitar((progreso - ENTRADA) / (1 - ENTRADA - SALIDA));
      setAvance(ex);
      setEtapa(progreso < ENTRADA ? -1 : progreso > 1 - SALIDA ? PASOS.length : pasoDe(ex));
    }

    // El 3D (three.js + armar el motor) recién se carga cuando la sección se
    // acerca a la pantalla: la portada con el video carga primero y liviana.
    const iniciar = async () => {
      try {
        const [THREE, { createV8Stage }] = await Promise.all([import("three"), import("./motor3d/stage.js")]);
        if (!vivo) return;
        // Sombras "duras" (PCF): las suaves del repo (VSM 4096 con desenfoque)
        // eran lo más caro de cada cuadro y en una página no se nota la diferencia.
        const st = createV8Stage({ canvas, look: { shadow: "hard" } });
        const eng = st.eng;
        const angosto = () => window.innerWidth < 768;

        // Niveles de calidad. Arranca en el que corresponde al equipo y, si los
        // cuadros tardan, baja solo (nunca sube, para que no titile).
        // Sin sombreado de ambiente (GTAO): es una pasada extra sobre toda la
        // pantalla en cada cuadro y en una página casi no se nota.
        const NIVELES = [
          { dpr: 1.25, samples: 4, ao: false, shadow: 2048 },
          { dpr: 1, samples: 2, ao: false, shadow: 1024 },
          { dpr: 1, samples: 0, ao: false, shadow: 1024 },
          { dpr: 0.75, samples: 0, ao: false, shadow: 1024 },
        ];
        const nav = navigator as Navigator & { deviceMemory?: number };
        const equipoModesto = (nav.hardwareConcurrency ?? 8) <= 4 || (nav.deviceMemory ?? 8) <= 4;
        let nivel = angosto() ? 2 : equipoModesto ? 1 : 0;
        const aplicarNivel = () => {
          const n = NIVELES[nivel];
          st.setQuality({ samples: n.samples, ao: n.ao, shadow: n.shadow });
          medir();
        };

        // La pieza de cada paso, en naranja.
        const naranja = new THREE.MeshPhysicalMaterial({ color: "#ea580c", roughness: 0.32, metalness: 0.25, clearcoat: 0.6, clearcoatRoughness: 0.2 });
        const grupos = [
          [eng.crank, eng.crankGear, eng.pulley, eng.flywheel],
          [...eng.cyl.map((c: { cage: unknown }) => c.cage), ...eng.cams.map((c: { g: unknown }) => c.g)],
          eng.cyl.map((c: { head: unknown }) => c.head),
          eng.pist.flatMap((p: { g: unknown; rod: unknown }) => [p.g, p.rod]),
        ] as { traverse: (fn: (o: { isMesh?: boolean; material: unknown; userData: { mat0?: unknown } }) => void) => void }[][];
        let pintado = -2;
        const pintar = (i: number) => {
          if (i === pintado) return;
          grupos.forEach((g, j) => g.forEach((o) => o.traverse((m) => {
            if (!m.isMesh || !m.userData.mat0) return;
            m.material = j === i ? naranja : m.userData.mat0;
          })));
          pintado = i;
        };

        function medir() {
          const r = canvas!.getBoundingClientRect();
          st.resize(r.width, r.height, Math.min(window.devicePixelRatio || 1, NIVELES[nivel].dpr));
        }
        aplicarNivel();
        window.addEventListener("resize", medir);

        // Medición de cuánto tarda cada cuadro (promedio móvil).
        let previo = 0;
        let promedio = 16;
        let cuadros = 0;
        let ultimoDibujo = 0;

        let giro = 0;
        const cuadro = (ahora: number) => {
          pedido = 0;
          if (!vivo || !visible) return;
          // Mientras bajás: a todo lo que dé. Al soltar, el cigüeñal sigue
          // girando un ratito a 30 cuadros por segundo y después el dibujo se
          // pausa del todo (la placa de video descansa mientras leés). Al volver
          // a bajar, arranca de nuevo.
          const bajando = ahora - ultimoScroll < 250;
          if (!bajando && ahora - ultimoScroll > 1800 && ultimoDibujo) return;
          if (!bajando && ahora - ultimoDibujo < 32) {
            pedido = requestAnimationFrame(cuadro);
            return;
          }
          if (previo) {
            promedio = promedio * 0.9 + Math.min(100, ahora - previo) * 0.1;
            cuadros++;
            // Después de calentar, si anda por debajo de ~40 cuadros por segundo
            // mientras se baja, se baja un nivel y se vuelve a medir.
            if (bajando && cuadros > 30 && promedio > 22 && nivel < NIVELES.length - 1) {
              nivel++;
              aplicarNivel();
              cuadros = 0;
              promedio = 16;
            }
          }
          previo = bajando ? ahora : 0;
          // El giro avanza sólo con el tiempo dibujado: al despertar no pega un salto.
          if (ultimoDibujo) giro += Math.min(100, ahora - ultimoDibujo);
          ultimoDibujo = ahora;
          const ex = limitar((progreso - ENTRADA) / (1 - ENTRADA - SALIDA));
          const enPaso = progreso >= ENTRADA && progreso <= 1 - SALIDA;
          pintar(enPaso ? pasoDe(ex) : -1);
          // El cigüeñal gira despacio: el motor está vivo mientras se desarma.
          const th = quieto ? 30 : ((giro / 1000) * 90) % 720;
          const { w, h } = st.size;
          const celu = w < 768;
          st.frame(th, {
            tx: 0, ty: 0.1 + 0.2 * ex, tz: 0,
            az: (38 + 32 * progreso) * D2R,
            el: (20 + 10 * progreso) * D2R,
            d: (celu ? 3.9 : 2.25) + (celu ? 2.4 : 1.9) * ex,
            sx: celu ? 0 : w * 0.17,
            sy: celu ? -h * 0.14 : 0,
          }, { explode: ex, charge: 0, arrows: 0 });
          pedido = requestAnimationFrame(cuadro);
        };
        despertar = () => {
          if (visible && !pedido) pedido = requestAnimationFrame(cuadro);
        };
        // Al cambiar el tamaño de la ventana el lienzo se borra: se dibuja de nuevo
        // aunque esté en pausa.
        const redibujar = () => { ultimoDibujo = 0; despertar(); };
        window.addEventListener("resize", redibujar);
        const obs = new IntersectionObserver(([e]) => {
          visible = e.isIntersecting;
          despertar();
        });
        obs.observe(seccion);
        limpiar = () => {
          obs.disconnect();
          window.removeEventListener("resize", medir);
          window.removeEventListener("resize", redibujar);
          st.renderer.dispose();
        };
      } catch {
        if (vivo) setFallo(true);
      }
    };
    const cerca = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      cerca.disconnect();
      void iniciar();
    }, { rootMargin: "900px 0px" });
    cerca.observe(seccion);

    leerScroll();
    window.addEventListener("scroll", leerScroll, { passive: true });
    return () => {
      vivo = false;
      cerca.disconnect();
      cancelAnimationFrame(pedido);
      window.removeEventListener("scroll", leerScroll);
      limpiar();
    };
  }, []);

  return (
    <section ref={zona} id="como-funciona" className="relative h-[300vh] bg-[#e9eaec]">
      <div className="sticky top-0 h-dvh overflow-hidden" style={{ background: "linear-gradient(#f3f3f4, #e9eaec 55%, #e3e4e6)" }}>
        {!fallo && <canvas ref={lienzo} role="img" aria-label="Un motor que se va desarmando pieza por pieza" className="absolute inset-0 h-full w-full" />}

        {/* Textos: a la izquierda en la compu, abajo en el celular */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#e9eaec] via-[#e9eaec]/95 to-transparent px-4 pb-10 pt-16 md:inset-y-0 md:right-auto md:flex md:w-[46%] md:items-center md:bg-none md:px-10 md:pb-0 lg:pl-16 xl:pl-24">
          <div className="relative w-full max-w-lg">
            <Bloque activo={etapa === -1}>
              <h2 className="font-display text-4xl font-extrabold leading-[0.95] tracking-tight text-slate-900 sm:text-6xl">
                Vos desarmás el motor.
                <span className="block text-brand-600">Tallerista registra cada pieza.</span>
              </h2>
              <p className="mt-4 text-base text-slate-600 sm:text-lg">Bajá y miralo.</p>
            </Bloque>

            {PASOS.map((p, i) => (
              <Bloque key={p.titulo} activo={etapa === i}>
                <p className="flex items-center gap-2 text-sm font-semibold text-brand-700">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-600 text-xs font-bold text-white">{i + 1}</span>
                  {p.pieza}
                </p>
                <h2 className="mt-3 font-display text-4xl font-extrabold leading-[0.95] tracking-tight text-slate-900 sm:text-6xl">{p.titulo}</h2>
                <p className="mt-4 max-w-md text-base leading-relaxed text-slate-600 sm:text-lg">{p.texto}</p>
              </Bloque>
            ))}

            <Bloque activo={etapa === PASOS.length}>
              <h2 className="font-display text-5xl font-extrabold leading-[0.92] tracking-tight text-slate-900 sm:text-7xl">
                Cada pieza,
                <span className="block text-brand-600">registrada.</span>
              </h2>
              <p className="mt-4 text-base text-slate-600 sm:text-lg">Vos te ocupás del auto. Tallerista, de los papeles.</p>
            </Bloque>
          </div>
        </div>

        {/* Por dónde vas */}
        <div className="pointer-events-none absolute bottom-6 right-6 hidden w-56 md:block lg:right-10">
          <div className="h-1 overflow-hidden rounded-full bg-slate-900/10"><div className="h-full rounded-full bg-brand-600" style={{ width: `${avance * 100}%` }} /></div>
          <p className="mt-2 text-right text-xs font-semibold text-slate-500">{etapa >= 0 && etapa < PASOS.length ? `Paso ${etapa + 1} de ${PASOS.length}` : " "}</p>
        </div>
      </div>
    </section>
  );
}

function Bloque({ activo, children }: { activo: boolean; children: React.ReactNode }) {
  return (
    <div aria-hidden={!activo} className={`transition-all duration-300 ${activo ? "relative opacity-100" : "pointer-events-none absolute inset-x-0 bottom-0 translate-y-4 opacity-0 md:bottom-auto md:top-1/2 md:-translate-y-1/2"}`}>
      {children}
    </div>
  );
}
