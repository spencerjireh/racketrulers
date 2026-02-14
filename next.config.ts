import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  async redirects() {
    return [
      {
        source: "/events",
        destination: "/tournaments",
        permanent: true,
      },
      {
        source: "/events/:path*",
        destination: "/tournaments/:path*",
        permanent: true,
      },
      {
        source: "/dashboard/events",
        destination: "/dashboard/tournaments",
        permanent: true,
      },
      {
        source: "/dashboard/events/:path*",
        destination: "/dashboard/tournaments/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
