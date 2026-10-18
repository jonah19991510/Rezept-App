import type { MetadataRoute } from "next";

// Die App ist privat: alle Bots aussperren.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", disallow: "/" }],
  };
}
