import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    // The generated Tailwind sheet is small. Inlining it removes the extra
    // render-blocking request on a visitor's first page load.
    inlineCss: true,
  },
};

export default nextConfig;
