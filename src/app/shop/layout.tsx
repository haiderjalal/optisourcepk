import type { Metadata } from "next";

/**
 * Wrapper for everything under /shop.
 *
 * Deliberately thin: the sidebar and the session check live in `(app)/layout.tsx`
 * so that `/shop/login` can sit outside them and not redirect to itself.
 */
export const metadata: Metadata = {
  title: { default: "Back office", template: "%s · OptiSource Back Office" },
  robots: { index: false, follow: false, nocache: true },
};

export default function ShopLayout({ children }: LayoutProps<"/shop">) {
  return children;
}
