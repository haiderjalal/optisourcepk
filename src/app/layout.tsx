import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";
import { SmoothScroll } from "@/components/layout/SmoothScroll";
import { CONTACT, SITE } from "@/lib/site";
import "./globals.css";

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
    "optical lab supplies Lahore",
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

/** Organisation graph — one copy, emitted from the root layout. */
const organisationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: SITE.legalName,
  alternateName: SITE.name,
  url: SITE.url,
  slogan: SITE.tagline,
  description: SITE.description,
  address: {
    "@type": "PostalAddress",
    streetAddress: CONTACT.address.line1,
    addressLocality: CONTACT.address.city,
    addressCountry: "PK",
  },
  contactPoint: {
    "@type": "ContactPoint",
    telephone: CONTACT.phone,
    email: CONTACT.email,
    contactType: "sales",
    areaServed: "PK",
    availableLanguage: ["en", "ur"],
  },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en-PK"
      className={`${outfit.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-mist-100">
        <script
          type="application/ld+json"
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(organisationSchema),
          }}
        />
        <a
          href="#main"
          className="bg-navy-700 sr-only rounded-full px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-100"
        >
          Skip to content
        </a>
        <SmoothScroll>
          <Header />
          <main id="main" className="flex-1">
            {children}
          </main>
          <Footer />
        </SmoothScroll>
      </body>
    </html>
  );
}
