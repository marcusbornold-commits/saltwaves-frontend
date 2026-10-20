import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Dev: tillåt studion över Tailscale (annars blockeras dev-resurser och sidan hydreras inte).
  allowedDevOrigins: ["100.125.138.87", "*.ts.net", "studio-preview.saltwaves.studio", "sjoberg.saltwaves.studio"],
  // proxy.ts (invite-skydd) buffrar request-kroppen; standard 10 MB kapade långa uppladdningar tyst (Samson#03 blev 72 s).
  experimental: { proxyClientMaxBodySize: "1000mb" },
  async redirects() {
    if (process.env.NODE_ENV !== "production" && process.env.AUDIOBOOK_REMOTE_DEV === "true") {
      return [{ source: "/:path*", has: [{ type: "host" as const, value: "localhost" }], destination: "http://127.0.0.1:3001/:path*", permanent: false }];
    }
    return [];
  },
};

export default nextConfig;
