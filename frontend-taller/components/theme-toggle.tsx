"use client";

import { useEffect, useState } from "react";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // Evitamos el error de hidratación de Next.js esperando a que el componente monte en el cliente
  useEffect(() => {
    setMounted(true);
    // Verificamos si el usuario ya tenía el modo oscuro guardado en su navegador o sistema
    const storedTheme = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    
    if (storedTheme === "dark" || (!storedTheme && prefersDark)) {
      setIsDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleTheme = (dark: boolean) => {
    setIsDark(dark);
    if (dark) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  // Skeleton sutil mientras carga para evitar saltos en la pantalla
  if (!mounted) {
    return <div className="h-9 w-[72px] animate-pulse rounded-full bg-slate-100 border border-slate-200" />;
  }

  return (
    <div className="flex items-center gap-1 rounded-full border border-slate-200 bg-slate-100 p-1 shadow-inner dark:border-slate-700 dark:bg-slate-900">
      
      {/* Botón MODO CLARO */}
      <button
        onClick={() => toggleTheme(false)}
        className={`flex h-7 w-7 items-center justify-center rounded-full transition-all duration-200 ${
          !isDark
            ? "bg-white text-brand-600 shadow-sm dark:bg-slate-800"
            : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
        }`}
        aria-label="Activar modo claro"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2" />
          <path d="M12 20v2" />
          <path d="M4.93 4.93l1.41 1.41" />
          <path d="M17.66 17.66l1.41 1.41" />
          <path d="M2 12h2" />
          <path d="M20 12h2" />
          <path d="M4.93 19.07l1.41-1.41" />
          <path d="M17.66 6.34l1.41-1.41" />
        </svg>
      </button>

      {/* Botón MODO OSCURO */}
      <button
        onClick={() => toggleTheme(true)}
        className={`flex h-7 w-7 items-center justify-center rounded-full transition-all duration-200 ${
          isDark
            ? "bg-slate-800 text-brand-400 shadow-sm"
            : "text-slate-400 hover:text-slate-600"
        }`}
        aria-label="Activar modo oscuro"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
        >
          <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      </button>
      
    </div>
  );
}