/**
 * Single source of truth for brand copy, contact details and navigation.
 * Everything here comes from the OptiSource PK brand book — swap the
 * contact block for live details before launch.
 */

export const SITE = {
  name: "OptiSource PK",
  legalName: "OptiSource PK — Wholesale Optics",
  /** The descriptor line in the logo lockup. */
  descriptor: "Wholesale Optics",
  tagline: "Your Partner in Clear Vision",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://optisource.pk",
  description:
    "Pakistan's wholesale optical supply partner. Lenses, frames, accessories, lab supplies and vision-care essentials — supplied in bulk to optical practices, labs and retailers nationwide.",
  locale: "en_PK",
} as const;

export const CONTACT = {
  phone: "+92 42 3456 7890",
  phoneHref: "tel:+924234567890",
  whatsapp: "+92 300 1234567",
  whatsappHref: "https://wa.me/923001234567",
  email: "info@optisource.pk",
  emailHref: "mailto:info@optisource.pk",
  address: {
    line1: "123 Optical Trade Centre",
    city: "Lahore",
    country: "Pakistan",
  },
  hours: "Mon – Sat · 09:00 – 18:00 PKT",
} as const;

/** The four-word pillars printed on the brand book signage. */
export const PILLARS = [
  "Focus",
  "Support",
  "People",
  "Progress",
  "Quality",
  "Partnership",
  "Clear Vision",
  "Precision",
] as const;

/** Headline statements lifted straight from the brand collateral. */
export const BRAND_STATEMENTS = [
  "Better Optics · Brighter Businesses",
  "Clear Products · Brighter Practices",
  "Clearer Tomorrow · Together",
  "Better Vision · Stronger Business",
  "Quality Frames · Brighter Perspectives",
] as const;

export interface NavLink {
  label: string;
  href: string;
  description?: string;
}

export const PRIMARY_NAV: NavLink[] = [
  { label: "Catalogue", href: "/catalogue" },
  { label: "Bulk Supply", href: "/bulk-supply" },
  { label: "Capabilities", href: "/capabilities" },
  { label: "About", href: "/about" },
  { label: "Contact", href: "/contact" },
];

export const FOOTER_NAV: { title: string; links: NavLink[] }[] = [
  {
    title: "Catalogue",
    links: [
      { label: "Ophthalmic Lenses", href: "/catalogue/lenses" },
      { label: "Optical Frames", href: "/catalogue/frames" },
      { label: "Accessories", href: "/catalogue/accessories" },
      { label: "Lab Supplies", href: "/catalogue/lab-supplies" },
      { label: "Frame Parts & Tools", href: "/catalogue/frame-parts-tools" },
    ],
  },
  {
    title: "Trade",
    links: [
      { label: "Bulk Supply", href: "/bulk-supply" },
      { label: "Open a Trade Account", href: "/inquiry" },
      { label: "Capabilities", href: "/capabilities" },
      { label: "Request a Quotation", href: "/inquiry" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About OptiSource", href: "/about" },
      { label: "Contact", href: "/contact" },
      { label: "Quality Standards", href: "/capabilities#quality" },
    ],
  },
];
