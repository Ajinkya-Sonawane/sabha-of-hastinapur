import path from "node:path";
import type { NextConfig } from "next";

const root = path.join(__dirname, "../..");

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
        ],
      },
    ];
  },
};

export default nextConfig;
