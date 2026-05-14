import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cho phép Server Action nhận payload lớn hơn (avatar upload 2 MB + overhead)
  experimental: {
    serverActions: {
      bodySizeLimit: "4mb",
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/array/:path*",
        destination: "https://us-assets.i.posthog.com/array/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
    ];
  },
  // Bắt buộc để hỗ trợ các yêu cầu API của PostHog có trailing slash
  skipTrailingSlashRedirect: true,
};

export default nextConfig;
