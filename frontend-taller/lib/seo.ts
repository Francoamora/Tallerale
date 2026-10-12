/**
 * Lo que Google lee de Tallerista. Un solo lugar para el título, la
 * descripción y las rutas, así la landing, el sitemap, el robots y el proxy no
 * se contradicen.
 *
 * El título lleva lo que escribe un dueño de taller en el buscador ("sistema
 * para taller mecánico", "órdenes de trabajo", "presupuestos"): la marca sola
 * no la busca nadie que todavía no nos conoce.
 */
export const SITE_URL = "https://tallerista.famdesarrollos.com.ar";

export const SEO = {
  title: "Sistema para talleres mecánicos | Tallerista",
  description:
    "Tallerista es el sistema de gestión para talleres mecánicos: órdenes de trabajo, presupuestos por WhatsApp, historial por vehículo y caja. 7 días gratis.",
  tagline: "Sistema de gestión para talleres mecánicos",
};

/** Archivos que lee un buscador: tienen que responder siempre, con o sin sesión. */
export const SEO_FILES = ["/robots.txt", "/sitemap.xml", "/llms.txt", "/opengraph-image", "/twitter-image"];

/** Páginas que tienen que estar en Google. La landing se sirve en la raíz. */
export const PUBLIC_PAGES = [
  { path: "/", priority: 1 },
  { path: "/registro", priority: 0.8 },
] as const;

/**
 * El sistema con cuenta y el portal del cliente (/p/, con datos de cada
 * presupuesto) no tienen nada que hacer en un buscador.
 */
export const PRIVATE_PREFIXES = [
  "/api/", "/p/", "/login", "/recuperar", "/invitacion", "/onboarding", "/caja", "/ceo", "/clientes",
  "/compras", "/configuracion", "/equipo", "/gastos", "/pagos", "/presupuestos", "/trabajos",
  "/turnos", "/vehiculos",
];
