export type CategorySlug =
  | "lenses"
  | "frames"
  | "accessories"
  | "lab-supplies"
  | "frame-parts-tools"
  | "optometric";

/** Lucide icon name, resolved at render time by the icon registry. */
export type IconName =
  "Eye" | "Glasses" | "SprayCan" | "FlaskConical" | "Wrench" | "Stethoscope";

export interface Category {
  slug: CategorySlug;
  name: string;
  /** Short line used on cards and in navigation. */
  summary: string;
  /** Longer intro used at the top of the category page. */
  intro: string;
  icon: IconName;
  /** Sub-ranges shown as filter chips on the category page. */
  ranges: string[];
}

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: CategorySlug;
  range: string;
  /** One-line positioning shown under the product name. */
  tagline: string;
  description: string;
  /** Spec sheet rows — label/value pairs. */
  specs: { label: string; value: string }[];
  /** What the line is counted in, e.g. "pairs", "pieces", "litres". */
  unit: string;
  featured?: boolean;
  leadTime: string;
}

export interface QuoteLine {
  productId: string;
  quantity: number;
}
