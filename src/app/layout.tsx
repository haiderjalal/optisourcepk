import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import { SITE } from "@/lib/site";
import "./globals.css";

/**
 * Root shell only: `<html>`, `<body>`, fonts and site-wide metadata.
 *
 * Navigation chrome lives in `(site)/layout.tsx`; the back-office brings its
 * own in `shop/layout.tsx`. Keeping a single root layout means moving between
 * the public site and `/shop` is a client navigation, not a full reload.
 */

// Both are served as variable fonts (~79 KB total, preloaded and immutable).
// Pinning `weight` does not shrink them — Google returns the variable file
// regardless — and would risk synthetic bold, so the full axis is kept.
const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — Wholesale Optical Supply in Pakistan`,
    template: `%s · ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  keywords: [
    "wholesale optical supply Pakistan",
    "ophthalmic lenses wholesale",
    "optical frames bulk supplier",
    "optical lab supplies Islamabad",
    "optometric equipment Pakistan",
    "frame parts and tools",
    "B2B optical distributor",
  ],
  authors: [{ name: SITE.legalName }],
  openGraph: {
    type: "website",
    locale: SITE.locale,
    url: SITE.url,
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large" },
  },
  alternates: { canonical: "/" },
};

export const viewport: Viewport = {
  themeColor: "#16294a",
  colorScheme: "light",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-PK"
      className={`${outfit.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="min-h-full bg-mist-100">{children}</body>
    </html>
  );
}
