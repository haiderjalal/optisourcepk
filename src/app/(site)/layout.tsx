import { CONTACT, SITE } from "@/lib/site";
import { Header } from "@/components/layout/Header";
import { Footer } from "@/components/layout/Footer";

/**
 * Chrome for the public marketing site.
 *
 * Lives in a route group so `/shop` — which shares the root layout's fonts and
 * `<html>` shell but none of its navigation — can opt out simply by sitting
 * outside this group. Keeping one root layout means crossing between the two
 * is a client navigation rather than a full page reload.
 */

/** Organisation graph — public pages only; the back-office is not indexable. */
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

export default function SiteLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex min-h-full flex-col">
      <script
        type="application/ld+json"
        suppressHydrationWarning
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organisationSchema) }}
      />
      <a
        href="#main"
        className="bg-navy-700 sr-only rounded-full px-4 py-2 text-sm font-medium text-white focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-100"
      >
        Skip to content
      </a>
      <Header />
      <main id="main" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
