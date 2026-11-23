import type { MetadataRoute } from "next";

import { PUBLIC_PAGES, SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PAGES.map(({ path, priority }) => ({
    url: path === "/" ? SITE_URL : `${SITE_URL}${path}`,
    // Fecha del despliegue: le avisa a Google y Bing que hay algo nuevo para leer.
    lastModified: new Date(),
    changeFrequency: "monthly",
    priority,
  }));
}
