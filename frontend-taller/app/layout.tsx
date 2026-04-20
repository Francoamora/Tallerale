import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ 
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "TallerOS · Panel de Control",
    template: "%s | TallerOS",
  },
  description: "Cabina operativa y panel de control del taller mecánico.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // suppressHydrationWarning evita errores cuando carga el modo oscuro guardado
    <html lang="es" className={`${inter.variable} antialiased`} suppressHydrationWarning>
      {/* Acá está la clave: 
        De día -> Fondo slate-50, texto slate-900
        De noche -> Fondo slate-950, texto slate-50
      */}
      <body className="min-h-screen bg-slate-50 text-slate-900 transition-colors duration-200 dark:bg-slate-950 dark:text-slate-50 font-sans selection:bg-brand-500 selection:text-white">
        {children}
      </body>
    </html>
  );
}