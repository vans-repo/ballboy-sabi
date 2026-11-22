import type { MetadataRoute } from "next";

import { publicEnv } from "@/lib/env";

/** Public pages are open to search engines; accounts, admin and APIs are not. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/api/",
        "/me",
        "/pick-all",
        "/login",
        "/signup",
        "/reset-password",
        "/update-password",
        "/auth/",
        "/unsubscribe",
      ],
    },
    sitemap: `${publicEnv.siteUrl}/sitemap.xml`,
  };
}
