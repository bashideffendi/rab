import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output: lebih predictable di Vercel/Docker, skip beberapa
  // prerender step yang bermasalah di Next 16 (mis. _global-error bug)
  output: "standalone",

  // Allow Supabase Storage public URL untuk Image component (kalau dipakai)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
};

export default nextConfig;
