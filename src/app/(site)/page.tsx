import type { Metadata } from "next";
import frameRange from "../../../brandbook/image6.jpeg";
import { CategoryGrid } from "@/components/sections/CategoryGrid";
import { FeaturedProducts } from "@/components/sections/FeaturedProducts";
import { Hero } from "@/components/sections/Hero";
import { StatementMarquee } from "@/components/sections/StatementMarquee";
import { SupplyFlow } from "@/components/sections/SupplyFlow";
import { WhySection } from "@/components/sections/WhySection";
import { PhotoFeature } from "@/components/shared/PhotoFeature";
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
      <PhotoFeature
        image={frameRange}
        alt="Optical frames, a navy cleaning cloth and branded cases laid out on a white surface"
        eyebrow="Frames & counter lines"
        title="The lines that finish a dispense."
        body="Cases, cloths, sprays, cords and readers — the margin-rich counter lines that finish a dispense, available plain or printed with your practice mark."
        links={[
          { label: "Browse accessories", href: "/catalogue/accessories" },
          { label: "Browse frames", href: "/catalogue/frames" },
        ]}
      />
      <SupplyFlow />
      <FeaturedProducts />
      <WhySection />
    </>
  );
}
