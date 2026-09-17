import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** One page, so far. Add entries here as routes are added. */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: SITE_URL,
      changeFrequency: "monthly",
      priority: 1,
    },
  ];
}
