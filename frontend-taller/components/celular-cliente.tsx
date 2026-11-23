"use client";

/**
 * Lo que ve el cliente en su celular: el teléfono queda fijo y la pantalla
 * cambia según cuánto bajás (WhatsApp → presupuesto → auto listo → ficha).
 * Las pantallas copian las reales del portal del cliente.
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

// ─── El celular ──────────────────────────────────────────────────────────────
function Celular({ children, barraClara = false, className }: { children: React.ReactNode; barraClara?: boolean; className?: string }) {
  return (
    <div className={cn("relative w-[290px] shrink-0", className)}>
      {/* Botones laterales */}
      <span className="absolute -left-[3px] top-[108px] h-7 w-[3px] rounded-l bg-zinc-600" />
      <span className="absolute -left-[3px] top-[152px] h-12 w-[3px] rounded-l bg-zinc-600" />
      <span className="absolute -left-[3px] top-[212px] h-12 w-[3px] rounded-l bg-zinc-600" />
      <span className="absolute -right-[3px] top-[170px] h-20 w-[3px] rounded-r bg-zinc-600" />
      <div className="rounded-[3.3rem] bg-gradient-to-br from-zinc-400 via-zinc-700 to-zinc-500 p-[2.5px] shadow-[0_60px_100px_-35px_rgba(15,23,42,.6),0_25px_50px_-25px_rgba(0,0,0,.45)]">
        <div className="rounded-[3.15rem] bg-black p-[9px]">
          <div className="relative h-[600px] overflow-hidden rounded-[2.6rem] bg-white">
            {/* Barra de estado */}
            <div className={cn("absolute inset-x-0 top-0 z-30 flex h-11 items-center justify-between px-7 pt-1 text-[13px] font-semibold", barraClara ? "text-white" : "text-slate-900")}>
              <span className="tabular-nums">9:41</span>
              <span className="flex items-center gap-1.5">
                <svg viewBox="0 0 18 12" className="h-2.5 w-4" fill="currentColor" aria-hidden="true"><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" /><rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></svg>
                <svg viewBox="0 0 16 12" className="h-2.5 w-3.5" fill="currentColor" aria-hidden="true"><path d="M8 2.5c2.3 0 4.4.9 6 2.4l1.2-1.3A10.3 10.3 0 0 0 8 .7 10.3 10.3 0 0 0 .8 3.6L2 4.9a8.5 8.5 0 0 1 6-2.4Zm0 3.6c1.3 0 2.5.5 3.4 1.3l1.2-1.3A6.6 6.6 0 0 0 8 4.3a6.6 6.6 0 0 0-4.6 1.8l1.2 1.3c.9-.8 2.1-1.3 3.4-1.3Zm0 3.5c-.5 0-1 .2-1.3.5L8 11.5l1.3-1.4c-.3-.3-.8-.5-1.3-.5Z" /></svg>
                <span className="relative flex h-3 w-6 items-center rounded-[4px] border border-current p-[1.5px] opacity-90"><span className="h-full w-4/5 rounded-[2px] bg-current" /><span className="absolute -right-[3px] top-1/2 h-1 w-[2px] -translate-y-1/2 rounded-r bg-current" /></span>
              </span>
            </div>
            {/* Isla */}
            <span className="absolute left-1/2 top-2.5 z-40 h-[27px] w-[92px] -translate-x-1/2 rounded-full bg-black" />
            <div className="absolute inset-0">{children}</div>
            {/* Barra de inicio y reflejo */}
            <span className="absolute bottom-2 left-1/2 z-30 h-[5px] w-28 -translate-x-1/2 rounded-full bg-slate-900/80" />
            <span className="pointer-events-none absolute inset-0 z-20 bg-gradient-to-br from-white/25 via-transparent to-transparent" />
          </div>
        </div>
      </div>
    </div>
  );
}

const WA = (
  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.65.07-.3-.15-1.26-.46-2.4-1.48-.89-.79-1.49-1.77-1.66-2.07-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.08 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35ZM12.04 21.5a9.45 9.45 0 0 1-4.82-1.32l-.35-.2-3.58.94.96-3.49-.23-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.22 4.25-9.47 9.48-9.47a9.47 9.47 0 0 1 9.47 9.48c0 5.22-4.25 9.46-9.47 9.46Zm8.06-17.53A11.3 11.3 0 0 0 12.04.63C5.76.63.65 5.74.65 12.02c0 2 .52 3.96 1.52 5.69L.55 23.6l6.04-1.58a11.4 11.4 0 0 0 5.44 1.39c6.28 0 11.39-5.11 11.39-11.39 0-3.04-1.19-5.9-3.34-8.05Z" /></svg>
);

/** El dedo que toca: un círculo que late sobre el botón. */
function Toque({ className }: { className?: string }) {
  return (
    <span className={cn("pointer-events-none absolute z-10 flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center", className)} aria-hidden="true">
      <span className="absolute inset-0 animate-ping rounded-full bg-slate-900/25" />
      <span className="h-7 w-7 rounded-full bg-slate-900/30 ring-2 ring-white/80" />
    </span>
  );
}

// ─── Las pantallas ───────────────────────────────────────────────────────────
type Mensaje = { de: "taller" | "cliente" | "aviso"; texto: string; link?: { titulo: string; dato: string } };

const CHAT: Mensaje[] = [
  { de: "taller", texto: "¡Hola Diego! 👋 Te paso el presupuesto del Onix:", link: { titulo: "Presupuesto P-0003", dato: "$135.000 · Taller San Martín" } },
  { de: "cliente", texto: "Buenísimo, ahí lo apruebo 👍" },
  { de: "aviso", texto: "✓ Diego aprobó el presupuesto" },
  { de: "taller", texto: "¡Listo! Tu Onix ya está para retirar 🚗 Acá ves todo lo que le hicimos:", link: { titulo: "Chevrolet Onix · AB123CD", dato: "Ficha del auto · Taller San Martín" } },
  { de: "cliente", texto: "¡Genial! Paso a las 18 🙌" },
];

function Burbuja({ m }: { m: Mensaje }) {
  if (m.de === "aviso") return <p className="mx-auto w-fit rounded-lg bg-emerald-100 px-2.5 py-1 text-[10.5px] font-semibold text-emerald-800 shadow-sm">{m.texto}</p>;
  const mio = m.de === "taller";
  return (
    <div className={cn("max-w-[86%] rounded-xl px-2.5 py-1.5 text-[11.5px] leading-snug text-slate-800 shadow-sm", mio ? "ml-auto rounded-tr-sm bg-[#d9fdd3]" : "rounded-tl-sm bg-white")}>
      {m.link && (
        <span className="mb-1.5 block overflow-hidden rounded-lg bg-black/5">
          <span className="flex h-14 items-center justify-center bg-gradient-to-br from-brand-500 to-brand-700 font-display text-lg font-extrabold text-white">Tallerista</span>
          <span className="block px-2 py-1.5"><span className="block font-semibold text-slate-900">{m.link.titulo}</span><span className="block text-[10px] text-slate-500">{m.link.dato}</span></span>
        </span>
      )}
      {m.texto}
      <span className="ml-1.5 inline-block translate-y-0.5 text-[9px] text-slate-500">10:4{CHAT.indexOf(m)}{mio ? " ✓✓" : ""}</span>
    </div>
  );
}

function PantallaWhatsApp({ mensajes = CHAT.slice(0, 1) }: { mensajes?: Mensaje[] }) {
  const lista = useRef<HTMLDivElement>(null);
  // Baja el chat al último mensaje (sin mover la página).
  useEffect(() => { const el = lista.current; if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }); }, [mensajes.length]);
  return (
    <div className="flex h-full flex-col bg-[#efeae2]">
      <div className="flex items-center gap-2.5 bg-[#008069] px-4 pb-2.5 pt-12 text-white">
        <span className="text-lg leading-none">‹</span>
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-600 text-[11px] font-bold">TS</span>
        <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-semibold">Taller San Martín</p><p className="text-[10px] text-white/80">en línea</p></div>
      </div>
      <div ref={lista} className="flex-1 space-y-2 overflow-hidden px-3 pb-6 pt-3">
        <p className="mx-auto w-fit rounded-md bg-white/80 px-2 py-0.5 text-[10px] text-slate-500">HOY</p>
        {mensajes.map((m) => <div key={m.texto} className="animate-in fade-in slide-in-from-bottom-2 duration-300"><Burbuja m={m} /></div>)}
      </div>
    </div>
  );
}

function BarraWeb() {
  return <div className="mx-4 mt-12 flex items-center justify-center gap-1 rounded-full bg-slate-100 py-1 text-[10px] text-slate-500"><span aria-hidden="true">🔒</span><span className="truncate">tallerista.famdesarrollos.com.ar</span></div>;
}

function PantallaPresupuesto({ animar = false }: { animar?: boolean }) {
  const [aprobado, setAprobado] = useState(false);
  useEffect(() => {
    if (!animar) return;
    const t = window.setTimeout(() => setAprobado(true), 1600);
    return () => window.clearTimeout(t);
  }, [animar]);
  return (
    <div className="flex h-full flex-col bg-white">
      <BarraWeb />
      <div className="flex items-center gap-2.5 px-4 pt-3">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand-600 text-[10px] font-bold text-white">TS</span>
        <div><p className="text-[11px] font-semibold text-slate-900">Taller San Martín</p><p className="text-[9px] text-slate-500">342-456-7890</p></div>
        <span className="ml-auto rounded-full bg-slate-100 px-2 py-0.5 text-[9px] text-slate-600">P-0003</span>
      </div>
      <div className="px-4 pb-3 pt-4 text-center">
        <p className="text-[10px] text-slate-500">Diego, este es el presupuesto para tu</p>
        <p className="text-sm font-semibold text-slate-900">Chevrolet Onix <span className="font-normal text-slate-500">· 2020</span></p>
        <p className="mt-3 text-[10px] text-slate-500">Total</p>
        <p className="font-display text-4xl font-extrabold leading-none text-slate-900">$135.000</p>
        <p className="mt-1 text-[9px] text-slate-500">Válido hasta el 6 de diciembre</p>
      </div>
      <div className="mx-4 border-t-2 border-dashed border-slate-200" />
      <ul className="space-y-2 px-4 py-3 text-[10.5px]">
        {[["Cambio de pastillas", "$100.000"], ["Pastillas de freno", "$50.000"]].map(([d, p]) => (
          <li key={d} className="flex items-baseline gap-1.5"><span className="text-slate-800">{d}</span><span className="flex-1 border-b border-dotted border-slate-300" /><span className="tabular-nums text-slate-900">{p}</span></li>
        ))}
        <li className="flex justify-between text-emerald-700"><span>Descuento</span><span>− $15.000</span></li>
      </ul>
      <div className="relative mt-auto space-y-1.5 border-t border-slate-100 p-3 pb-6">
        {aprobado ? (
          <div className="animate-in zoom-in-95 fade-in rounded-xl bg-emerald-50 py-3 text-center duration-300">
            <p className="text-lg">✅</p>
            <p className="text-[12px] font-bold text-emerald-800">¡Presupuesto aprobado!</p>
            <p className="text-[10px] text-emerald-700">Ya le avisamos al taller.</p>
          </div>
        ) : (
          <>
            <p className="relative rounded-xl bg-emerald-600 py-2.5 text-center text-[11.5px] font-semibold text-white">
              Aprobar presupuesto
              {animar && <Toque className="left-1/2 top-1/2" />}
            </p>
            <div className="grid grid-cols-2 gap-1.5">
              <p className="rounded-xl py-2 text-center text-[10.5px] font-semibold text-slate-700 ring-1 ring-slate-200">Rechazar</p>
              <p className="rounded-xl py-2 text-center text-[10.5px] font-semibold text-slate-700 ring-1 ring-slate-200">Tengo una duda</p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function PantallaListo({ animar = false }: { animar?: boolean }) {
  const etapas = ["Recibido", "En trabajo", "Listo"];
  return (
    <div className="flex h-full flex-col bg-white">
      <BarraWeb />
      <div className="px-4 pt-4">
        <p className="text-[10px] text-slate-500">Diego, tu</p>
        <p className="font-display text-2xl font-extrabold leading-tight text-slate-900">Chevrolet Onix</p>
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-800"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-600" />Listo para retirar</p>
      </div>
      <div className="mx-4 mt-4 flex items-center">
        {etapas.map((e, i) => (
          <div key={e} className="flex flex-1 items-center last:flex-none">
            <span className={cn("flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-[10px] font-bold text-white", animar && "animate-in zoom-in fill-mode-both duration-300")} style={{ animationDelay: `${i * 350}ms` }}>✓</span>
            {i < etapas.length - 1 && <span className="mx-1 h-0.5 flex-1 rounded bg-emerald-600" />}
          </div>
        ))}
      </div>
      <div className="mx-4 mt-1 flex justify-between text-[9px] text-slate-500">{etapas.map((e) => <span key={e}>{e}</span>)}</div>
      <p className="mx-4 mt-5 text-[10px] font-medium text-slate-500">Lo que le hicimos</p>
      <ul className="mx-4 mt-1 divide-y divide-slate-100 text-[11px]">
        {["Cambio de pastillas delanteras", "Rectificado de discos", "Control de líquido de frenos"].map((t, i) => (
          <li key={t} className={cn("flex items-center gap-2 py-2", animar && "animate-in fade-in slide-in-from-left-2 fill-mode-both duration-300")} style={{ animationDelay: `${900 + i * 250}ms` }}><span className="text-emerald-600">✓</span>{t}</li>
        ))}
      </ul>
      <div className="mx-4 mt-3 flex items-baseline justify-between rounded-xl bg-slate-50 px-3 py-2.5"><span className="text-[11px] text-slate-600">Total</span><span className="font-display text-xl font-extrabold text-slate-900">$135.000</span></div>
      <p className="mx-3 mb-6 mt-auto flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-[11.5px] font-semibold text-white">{WA}Avisar que paso</p>
    </div>
  );
}

function PantallaFicha({ animar = false }: { animar?: boolean }) {
  return (
    <div className="flex h-full flex-col bg-white">
      <BarraWeb />
      <div className="px-4 pt-4">
        <p className="text-[10px] text-slate-500">Diego, esta es la ficha de tu</p>
        <p className="font-display text-2xl font-extrabold leading-tight text-slate-900">Chevrolet Onix</p>
        <p className="text-[10px] text-slate-500">2020 · Patente <span className="font-semibold text-slate-700">AB123CD</span></p>
      </div>
      <div className="mx-4 mt-4 rounded-xl bg-amber-50 p-3 ring-1 ring-amber-200">
        <div className="flex justify-between text-[11px]"><span className="font-semibold text-slate-900">Próximo service</span><span className="font-bold text-amber-700">faltan 800 km</span></div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white">
          <div className={cn("h-full rounded-full bg-amber-500 transition-[width] delay-300 duration-[1400ms] ease-out", animar ? "w-[92%]" : "w-[10%]")} />
        </div>
        <p className="mt-1.5 text-[9.5px] text-slate-500">A los 135.000 km · hoy tiene 134.200</p>
      </div>
      <p className="mx-4 mt-4 text-[10px] font-medium text-slate-500">Lo que le hicimos</p>
      <ul className="mx-4 mt-1 divide-y divide-slate-100 text-[10.5px]">
        {[["2026", "Frenos delanteros", "134.200 km"], ["2025", "Service de 120.000 km", "121.000 km"], ["2024", "Correa de distribución", "98.500 km"]].map(([a, t, km]) => (
          <li key={a} className="flex items-center gap-3 py-2"><span className="font-display text-sm font-extrabold text-slate-900">{a}</span><span className="flex-1 text-slate-700">{t}</span><span className="text-[9.5px] text-slate-500">{km}</span></li>
        ))}
      </ul>
      <p className="relative mx-3 mb-6 mt-auto flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-[11.5px] font-semibold text-white">
        {WA}Pedir turno por WhatsApp
        {animar && <Toque className="left-1/2 top-1/2 [animation-delay:1.8s]" />}
      </p>
    </div>
  );
}

const PANTALLAS = [
  { corto: "WhatsApp", titulo: "Le llega por WhatsApp", texto: "Sin apps ni contraseñas: un mensaje desde tu número con el link. Lo abre como cualquier página.", clara: true },
  { corto: "Presupuesto", titulo: "Lo aprueba con un toque", texto: "Ve cada repuesto con su precio y aprueba. Vos te enterás al instante y arrancás antes.", clara: false },
  { corto: "Listo", titulo: "Sabe cuándo está listo", texto: "Le avisás con el total y ve todo lo que le hiciste. Chau llamadas de “¿ya está?”.", clara: false },
  { corto: "Ficha", titulo: "Y vuelve a tu taller", texto: "Su ficha le marca cuánto falta para el próximo service. El turno te lo pide a vos, no a otro.", clara: false },
];

function Pantalla({ i, activa }: { i: number; activa: boolean }) {
  if (i === 0) return <PantallaWhatsApp mensajes={activa ? CHAT.slice(0, 1) : []} />;
  if (i === 1) return <PantallaPresupuesto key={String(activa)} animar={activa} />;
  if (i === 2) return <PantallaListo key={String(activa)} animar={activa} />;
  return <PantallaFicha animar={activa} />;
}

const ESTUDIO = { background: "linear-gradient(#f3f3f4, #e9eaec 55%, #e3e4e6)" };

// ─── Capturas que cambian al bajar ───────────────────────────────────────────
export function DisenoCapturas() {
  const zona = useRef<HTMLElement>(null);
  const [i, setI] = useState(0);
  useEffect(() => {
    const leer = () => {
      const r = zona.current?.getBoundingClientRect();
      if (!r) return;
      const p = Math.min(0.999, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight)));
      setI(Math.floor(p * PANTALLAS.length));
    };
    leer();
    window.addEventListener("scroll", leer, { passive: true });
    return () => window.removeEventListener("scroll", leer);
  }, []);
  return (
    <section ref={zona} id="cliente" className="relative h-[250vh]" style={ESTUDIO}>
      <div className="sticky top-0 flex h-dvh items-center overflow-hidden px-4 pt-14">
        <div className="mx-auto grid w-full max-w-6xl items-center gap-8 lg:grid-cols-[1fr_auto] lg:gap-20">
          <div className="hidden lg:block">
            <p className="text-sm font-semibold text-brand-700">Lo que ve tu cliente</p>
            <h2 className="mt-2 font-display text-5xl font-extrabold leading-[0.95] tracking-tight text-slate-900 xl:text-6xl">Del WhatsApp a la ficha de su auto.</h2>
            <ol className="mt-10 space-y-6">
              {PANTALLAS.map((p, j) => (
                <li key={p.corto} className={cn("flex gap-4 transition-all duration-500", j === i ? "opacity-100" : "opacity-35")}>
                  <span className={cn("mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors", j === i ? "bg-brand-600 text-white" : "bg-slate-300 text-slate-600")}>{j + 1}</span>
                  <div>
                    <p className="font-display text-2xl font-extrabold text-slate-900">{p.titulo}</p>
                    <p className={cn("overflow-hidden text-slate-600 transition-all duration-500", j === i ? "mt-1 max-h-24" : "max-h-0")}>{p.texto}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
          <div className="relative mx-auto flex flex-col items-center">
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-brand-500/20 blur-3xl" aria-hidden="true" />
            <Celular barraClara={PANTALLAS[i].clara} className="max-sm:[zoom:0.74] max-sm:[@media(max-height:700px)]:[zoom:0.62]">
              {PANTALLAS.map((p, j) => (
                <div key={p.corto} aria-hidden={j !== i} className={cn("absolute inset-0 transition-all duration-500 ease-out", j === i ? "translate-y-0 opacity-100" : j < i ? "-translate-y-8 opacity-0" : "translate-y-8 opacity-0")}>
                  <Pantalla i={j} activa={j === i} />
                </div>
              ))}
            </Celular>
            {/* En el celular: el texto del paso abajo */}
            <div className="mt-2 text-center lg:hidden">
              <p className="font-display text-2xl font-extrabold text-slate-900">{PANTALLAS[i].titulo}</p>
              <p className="mx-auto mt-1 max-w-xs text-sm text-slate-600">{PANTALLAS[i].texto}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
