import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    if (process.env.NODE_ENV !== "production" && process.env.AUDIOBOOK_REMOTE_DEV === "true") {
      return [{ source: "/:path*", has: [{ type: "host" as const, value: "localhost" }], destination: "http://127.0.0.1:3001/:path*", permanent: false }];
    }
    return [];
  },
};

export default nextConfig;
