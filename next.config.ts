import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // ws, @neondatabase/serverless and the proxy agent use Node built-ins and
  // optional native addons that Next's server bundler mangles. Keeping them
  // external makes the runtime use the installed copy as-is.
  serverExternalPackages: [
    "@neondatabase/serverless",
    "ws",
    "https-proxy-agent",
    "pg",
    "pg-native",
    "bcryptjs",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "3mb",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
        ],
      },
    ];
  },
};

export default config;
