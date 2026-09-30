import path from "node:path";
import type { NextConfig } from "next";

const root = path.join(__dirname, "../..");
const dev = process.env.NODE_ENV !== "production";

// Everything is served from one origin; Next.js still needs inline scripts and styles.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${dev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join("; ");

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The browser bundle may import the shared protocol — never the game engine.
  transpilePackages: ["@sabha/protocol"],
  outputFileTracingRoot: root,
  turbopack: { root },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: csp },
          ...(dev ? [] : [{ key: "Strict-Transport-Security", value: "max-age=15552000" }]),
        ],
      },
    ];
  },
};

export default nextConfig;
