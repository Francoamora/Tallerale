import type { MetadataRoute } from "next";

import { PRIVATE_PREFIXES, SITE_URL } from "@/lib/seo";

/** Google rastrea la landing (en la raíz) y el registro; el sistema con cuenta queda afuera. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: PRIVATE_PREFIXES },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
