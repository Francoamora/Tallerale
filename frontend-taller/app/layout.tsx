import type { Metadata } from "next";
import "./globals.css";

const themeBootScript = `
  (() => {
    try {
      const storedTheme = localStorage.getItem("theme");
      const systemPrefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const isDark = storedTheme === "dark" || (!storedTheme && systemPrefersDark);
      document.documentElement.classList.toggle("dark", isDark);
      document.documentElement.style.colorScheme = isDark ? "dark" : "light";
    } catch {
      // Si el almacenamiento no está disponible, se conserva el tema claro.
    }
  })();
`;

export const metadata: Metadata = {
  title: {
    default: "Tallerista · Panel de Control",
    template: "%s | Tallerista",
  },
  description: "Cabina operativa y panel de control del taller mecánico.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // El script aplica la preferencia antes del primer pintado del navegador.
    <html lang="es" className="antialiased" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-50 font-sans selection:bg-brand-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}
