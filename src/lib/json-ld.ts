import { SITE } from "@/lib/site";

/**
 * Serialise structured data for an inline `<script type="application/ld+json">`.
 *
 * `JSON.stringify` does not escape `<`, so a string containing `</script>`
 * would end the tag early and run whatever follows it. Escaping the character
 * keeps the payload inert whatever text it carries.
 */
export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

export interface BreadcrumbItem {
  label: string;
  href?: string;
}

/**
 * BreadcrumbList for a visible trail. The last item carries no `item` URL when
 * it is the current page, matching what the breadcrumb renders.
 */
export function breadcrumbSchema(trail: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: trail.map((crumb, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: crumb.label,
      ...(crumb.href ? { item: `${SITE.url}${crumb.href}` } : {}),
    })),
  };
}
