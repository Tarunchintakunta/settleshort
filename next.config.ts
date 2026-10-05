import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["tesseract.js"],
  // tesseract.js loads its worker and wasm core by path at runtime, which file tracing can't see.
  outputFileTracingIncludes: {
    "/api/**": ["./node_modules/.pnpm/tesseract.js@*/node_modules/tesseract.js/**", "./node_modules/.pnpm/tesseract.js-core@*/node_modules/tesseract.js-core/**"],
  },
  devIndicators: false,
};

export default nextConfig;
