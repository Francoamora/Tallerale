import type { Metadata, Viewport } from "next";
import { SITE_URL } from "@/lib/seo";
import { GeistMono } from "geist/font/mono";
// Archivo variable (peso y ancho) empaquetada: una sola familia para toda
// la app. Angosta y pesada en títulos y números, normal en el resto.
import "@fontsource-variable/archivo/wdth.css";
import "./globals.css";
import { RegistrarServiceWorker } from "@/components/instalar-app";

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
  // Base para las URLs absolutas de canonical, Open Graph y la imagen al compartir.
  metadataBase: new URL(SITE_URL),
  openGraph: { type: "website", siteName: "Tallerista", locale: "es_AR" },
  twitter: { card: "summary_large_image" },
  title: {
    default: "Tallerista · Panel de Control",
    template: "%s | Tallerista",
  },
  description: "Cabina operativa y panel de control del taller mecánico.",
  applicationName: "Tallerista",
  // iPhone: "Agregar a inicio" la abre como app, con su nombre y la barra de
  // arriba oscura como el encabezado del sistema.
  appleWebApp: { capable: true, title: "Tallerista", statusBarStyle: "black" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#0f1113",
  // Ocupa toda la pantalla en celulares con muesca; la barra de abajo deja
  // lugar para la raya de inicio del iPhone.
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // El script aplica la preferencia antes del primer pintado del navegador.
    <html lang="es-AR" className={`${GeistMono.variable} antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootScript }} />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-50 font-sans selection:bg-brand-500 selection:text-white">
        {children}
        <RegistrarServiceWorker />
      </body>
    </html>
  );
}
