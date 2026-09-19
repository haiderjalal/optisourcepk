import type { MetadataRoute } from "next";
import { SITE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  // Keep preview deployments out of the index entirely. /shop is the
  // back office: never indexable, in any environment.
  const isProduction = process.env.VERCEL_ENV === "production";

  return {
    rules: isProduction
      ? [{ userAgent: "*", allow: "/", disallow: ["/api/", "/shop"] }]
      : [{ userAgent: "*", disallow: "/" }],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
