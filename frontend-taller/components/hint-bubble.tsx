"use client";

/**
 * components/hint-bubble.tsx
 *
 * Sistema de ayudas contextuales in-app.
 * Se muestran la primera vez que el usuario visita cada sección.
 * Se descartan individualmente y el estado persiste en localStorage.
 *
 * Uso:
 *   <HintBubble id="clientes-nuevo" title="Agregá tu primer cliente"
 *     desc="Tocá el botón + para empezar." action={{ label: "Agregar cliente", href: "/clientes/nuevo" }} />
 */

import { useEffect, useState } from "react";
import Link from "next/link";

interface HintAction {
  label: string;
  href?: string;
  onClick?: () => void;
}

interface HintBubbleProps {
  id: string;           // Clave única — se guarda en localStorage
  emoji?: string;
  title: string;
  desc: string;
  action?: HintAction;
  variant?: "inline" | "banner"; // inline = tarjetita, banner = franja superior
}

const STORAGE_KEY = "ag_hints_dismissed";

function getDismissed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function dismiss(id: string) {
  if (typeof window === "undefined") return;
  try {
    const set = getDismissed();
    set.add(id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch { /* noop */ }
}

// ─── Componente ───────────────────────────────────────────────────────────────
export function HintBubble({
  id,
  emoji = "💡",
  title,
  desc,
  action,
  variant = "inline",
}: HintBubbleProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Solo mostrar si NO fue descartado antes
    if (!getDismissed().has(id)) setVisible(true);
  }, [id]);

  function handleDismiss() {
    dismiss(id);
    setVisible(false);
  }

  if (!visible) return null;

  if (variant === "banner") {
    return (
      <div className="animate-in slide-in-from-top-2 mb-4 flex items-start justify-between gap-4 rounded-2xl border border-orange-200 bg-orange-50 px-5 py-4 dark:border-orange-900/40 dark:bg-orange-900/10">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-xl">{emoji}</span>
          <div>
            <p className="text-sm font-bold text-orange-800 dark:text-orange-300">{title}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-orange-700 dark:text-orange-400">{desc}</p>
            {action && (
              action.href ? (
                <Link
                  href={action.href}
                  onClick={handleDismiss}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-orange-600 active:scale-95"
                >
                  {action.label}
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ) : (
                <button
                  onClick={() => { action.onClick?.(); handleDismiss(); }}
                  className="mt-2.5 inline-flex items-center gap-1.5 rounded-lg bg-orange-500 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-orange-600 active:scale-95"
                >
                  {action.label}
                </button>
              )
            )}
          </div>
        </div>
        {/* Botón cerrar */}
        <button
          onClick={handleDismiss}
          className="shrink-0 rounded-lg p-1 text-orange-400 hover:bg-orange-100 hover:text-orange-600 dark:hover:bg-orange-900/30"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    );
  }

  // variant === "inline"
  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-50 to-orange-50/40 p-5 shadow-sm ring-1 ring-orange-200/60 dark:from-slate-800/60 dark:to-orange-900/10 dark:ring-orange-900/30">
      {/* Acento lateral */}
      <div className="absolute left-0 top-0 h-full w-1 rounded-l-2xl bg-gradient-to-b from-orange-400 to-orange-500" />

      <div className="flex items-start justify-between gap-3 pl-2">
        <div className="flex items-start gap-3">
          <span className="mt-0.5 text-2xl">{emoji}</span>
          <div>
            <p className="font-bold text-slate-800 dark:text-white">{title}</p>
            <p className="mt-1 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{desc}</p>
            {action && (
              <div className="mt-3">
                {action.href ? (
                  <Link
                    href={action.href}
                    onClick={handleDismiss}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-orange-600 active:scale-95"
                  >
                    {action.label}
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                    </svg>
                  </Link>
                ) : (
                  <button
                    onClick={() => { action.onClick?.(); handleDismiss(); }}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-orange-500 px-4 py-2 text-xs font-black text-white shadow-sm transition hover:bg-orange-600 active:scale-95"
                  >
                    {action.label}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        <button
          onClick={handleDismiss}
          title="Entendido, no mostrar más"
          className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Componente de estado vacío con hint integrado ────────────────────────────
export function EmptyWithHint({
  emoji = "📭",
  title,
  desc,
  hintId,
  hintTitle,
  hintDesc,
  actionLabel,
  actionHref,
}: {
  emoji?: string;
  title: string;
  desc: string;
  hintId: string;
  hintTitle: string;
  hintDesc: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-slate-100 text-4xl dark:bg-slate-800">
        {emoji}
      </div>
      <div>
        <p className="text-lg font-black text-slate-800 dark:text-white">{title}</p>
        <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">{desc}</p>
      </div>
      <HintBubble
        id={hintId}
        emoji="👆"
        title={hintTitle}
        desc={hintDesc}
        action={{ label: actionLabel, href: actionHref }}
        variant="inline"
      />
    </div>
  );
}
