import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  compress: true,
  async rewrites() {
    return {
      beforeFiles: [{ source: "/logo.png", destination: "/logo.webp" }],
    };
  },
};

export default nextConfig;
