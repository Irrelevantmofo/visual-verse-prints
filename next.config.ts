import type { NextConfig } from "next";

// Catalog photos are served from this project's Supabase Storage bucket; allow next/image to optimize only those.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const nextConfig: NextConfig = {
  images: {
    remotePatterns: supabaseUrl ? [new URL(`${supabaseUrl}/storage/v1/object/public/product-images/**`)] : [],
  },
};

export default nextConfig;
