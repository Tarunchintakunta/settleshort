import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://settleshort.vercel.app";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["/", "/security", "/pricing", "/docs", "/login", "/signup"].map((path) => ({ url: `${base}${path}`, changeFrequency: "weekly", priority: path === "/" ? 1 : 0.6 }));
}
