import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The feedback form is a POST endpoint, so there is nothing to crawl.
      // /download is a redirect that counts clicks, and crawlers following it
      // would inflate the count.
      disallow: ["/api/", "/download"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
