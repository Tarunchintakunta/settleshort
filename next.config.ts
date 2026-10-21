import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["tesseract.js"],
  // tesseract.js loads its worker and wasm core by path at runtime, which file tracing can't see.
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/.pnpm/tesseract.js@*/node_modules/tesseract.js/**", "./node_modules/.pnpm/tesseract.js-core@*/node_modules/tesseract.js-core/**"],
  },
  devIndicators: false,
  poweredByHeader: false,
  // Clickjacking, sniffing, referrer leaks and browser features nobody asked for.
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
