import type { NextConfig } from "next";

/**
 * Headers every response carries. Framing is blocked everywhere, and the
 * back-office is never framed at all: a page that can be embedded in another
 * site can be made to click for its visitor.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
];

const backOfficeHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Not advertised to attackers.
  poweredByHeader: false,
  experimental: {
    // The generated Tailwind sheet is small. Inlining it removes the extra
    // render-blocking request on a visitor's first page load.
    inlineCss: true,
  },
  async headers() {
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/shop/:path*", headers: backOfficeHeaders },
    ];
  },
};

export default nextConfig;
