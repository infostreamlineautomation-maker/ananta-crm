import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: false,
  async rewrites() {
    const backend = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
    const cleanBackend = backend.replace(/\/+$/, "");
    return [
      {
        source: "/media/:path*",
        destination: `${cleanBackend}/media/:path*`,
      },
      {
        source: "/uploads/:path*",
        destination: `${cleanBackend}/uploads/:path*`,
      },
    ];
  },
};

export default nextConfig;

