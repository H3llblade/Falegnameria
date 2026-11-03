import type { NextConfig } from "next";

const appUrl = process.env.APP_URL ? new URL(process.env.APP_URL) : null;

/**
 * Content Security Policy: solo risorse dello stesso dominio.
 * Eccezione: i dizionari OCR di Tesseract (lingua ita/eng) scaricati da jsDelivr, salvo
 * NEXT_PUBLIC_OCR_LANG_PATH che punti a una copia locale.
 */
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self' https://cdn.jsdelivr.net",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const nextConfig: NextConfig = {
  // Il deploy compila in una cartella separata e poi la scambia con .next (nessun fermo durante la build)
  distDir: process.env.NEXT_DIST_DIR || ".next",
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
      ...(appUrl ? { allowedOrigins: [appUrl.host] } : {}),
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "same-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
          { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
        ],
      },
      {
        source: "/tesseract/:path*",
        headers: [{ key: "Cache-Control", value: "public, max-age=604800" }],
      },
    ];
  },
};

export default nextConfig;
