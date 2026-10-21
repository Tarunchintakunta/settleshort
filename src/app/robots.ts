import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://settleshort.vercel.app";

export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", allow: "/", disallow: ["/app", "/api", "/demo", "/onboarding"] }, sitemap: `${base}/sitemap.xml` };
}
