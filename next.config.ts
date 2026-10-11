import type { NextConfig } from "next";

/**
 * Headers every response carries.
 *
 * Framing is blocked on every route, not only the back-office: the public
 * inquiry form is a page a visitor can be tricked into submitting if another
 * site embeds it. A full Content-Security-Policy is deliberately not set here —
 * it needs a per-request nonce, which would stop the marketing pages from being
 * prerendered. See docs/architecture.md.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), payment=()",
  },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // HTTPS only for two years. No includeSubDomains: that would pin every
  // subdomain too, and this change should not reach beyond the site itself.
  { key: "Strict-Transport-Security", value: "max-age=63072000" },
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
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
