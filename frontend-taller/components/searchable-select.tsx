"use client";

/**
 * components/searchable-select.tsx
 *
 * Select con búsqueda para listas que pueden crecer mucho (clientes,
 * vehículos, etc.). Reemplaza un <select> nativo cuando la cantidad de
 * opciones hace pesado desplegar todo el listado sin filtrar.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  value: string;
  label: string;
  sublabel?: string;
}

interface SearchableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder = "Escribí para buscar…",
  emptyMessage = "Sin resultados.",
  disabled,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [highlight, setHighlight] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = options.find((option) => option.value === value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (option) =>
        option.label.toLowerCase().includes(q) ||
        option.sublabel?.toLowerCase().includes(q),
    );
  }, [options, query]);

  // Cerrar al hacer click afuera
  useEffect(() => {
    if (!open) return;
    function handleClick(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery("");
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  // Foco automático en el buscador al abrir
  useEffect(() => {
    if (open) requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  function selectOption(option: SearchableSelectOption) {
    onChange(option.value);
    setOpen(false);
    setQuery("");
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      const option = filtered[highlight];
      if (option) selectOption(option);
    } else if (event.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  }

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => {
          if (open) return setOpen(false);
          if (disabled) return;
          setHighlight(0);
          setOpen(true);
        }}
        disabled={disabled}
        className={cn(
          "flex h-11 w-full items-center justify-between gap-2 rounded-xl bg-slate-50 px-4 text-left text-sm outline-none ring-1 ring-slate-200 transition focus:bg-white focus:ring-2 focus:ring-brand-400 dark:bg-slate-950 dark:ring-slate-800 dark:focus:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-50",
          className,
        )}
      >
        <span className={cn("truncate", selected ? "text-slate-900 dark:text-white" : "text-slate-400 dark:text-slate-500")}>
          {selected ? selected.label : placeholder}
        </span>
        <svg
          className={cn("h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200", open && "rotate-180")}
          viewBox="0 0 24 24"
          fill="none"
        >
          <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute z-30 mt-1.5 w-full overflow-hidden rounded-xl bg-white shadow-lg ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700">
          <div className="border-b border-slate-100 p-2 dark:border-slate-800">
            <input
              ref={inputRef}
              value={query}
              onChange={(event) => { setQuery(event.target.value); setHighlight(0); }}
              onKeyDown={handleKeyDown}
              placeholder={searchPlaceholder}
              className="h-9 w-full rounded-lg bg-slate-50 px-3 text-sm text-slate-900 outline-none ring-1 ring-slate-200 focus:ring-2 focus:ring-brand-400 dark:bg-slate-950 dark:text-white dark:ring-slate-800"
            />
          </div>
          <ul className="max-h-56 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <li className="px-4 py-3 text-xs text-slate-400">{emptyMessage}</li>
            ) : (
              filtered.map((option, index) => (
                <li key={option.value}>
                  <button
                    type="button"
                    onClick={() => selectOption(option)}
                    onMouseEnter={() => setHighlight(index)}
                    className={cn(
                      "flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left text-sm transition",
                      index === highlight ? "bg-brand-50 dark:bg-slate-800" : "hover:bg-slate-50 dark:hover:bg-slate-800",
                      option.value === value ? "font-bold text-brand-600 dark:text-brand-500" : "text-slate-700 dark:text-slate-200",
                    )}
                  >
                    <span className="truncate">{option.label}</span>
                    {option.sublabel && <span className="text-[11px] font-normal text-slate-400">{option.sublabel}</span>}
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
