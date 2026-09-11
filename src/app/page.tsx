import type { Metadata } from "next";
import { CategoryGrid } from "@/components/sections/CategoryGrid";
import { FeaturedProducts } from "@/components/sections/FeaturedProducts";
import { Hero } from "@/components/sections/Hero";
import { StatementMarquee } from "@/components/sections/StatementMarquee";
import { SupplyFlow } from "@/components/sections/SupplyFlow";
import { WhySection } from "@/components/sections/WhySection";
import { SITE } from "@/lib/site";

export const metadata: Metadata = {
  title: `${SITE.name} — Wholesale Optical Supply in Pakistan`,
  description: SITE.description,
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <>
      <Hero />
      <StatementMarquee />
      <CategoryGrid />
      <SupplyFlow />
      <FeaturedProducts />
      <WhySection />
    </>
  );
}
