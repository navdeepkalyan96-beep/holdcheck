import type { NextConfig } from "next";

const BACKEND = process.env.NEXT_PUBLIC_API_URL || "https://holdcheck.onrender.com";

const nextConfig: NextConfig = {
  async rewrites() {
    return [{ source: "/pricing-api/:path*", destination: `${BACKEND}/:path*` }];
  },
};

export default nextConfig;
