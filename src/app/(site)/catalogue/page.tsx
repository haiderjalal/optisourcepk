import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/PageHeader";
import { CatalogueBrowser } from "@/components/sections/CatalogueBrowser";
import { PRODUCTS } from "@/data/products";
import { CATEGORIES } from "@/data/categories";

export const metadata: Metadata = {
  title: "Trade Catalogue",
  description:
    "Browse OptiSource PK's wholesale optical catalogue — ophthalmic lenses, optical frames, accessories, lab supplies, frame parts and optometric equipment. Build a request list and we quote in writing.",
  alternates: { canonical: "/catalogue" },
  openGraph: {
    title: "Trade Catalogue · OptiSource PK",
    description:
      "Lenses, frames, accessories, lab supplies and optometric equipment — supplied wholesale across Pakistan.",
    url: "/catalogue",
  },
};

export default function CataloguePage() {
  return (
    <>
      <PageHeader
        eyebrow="Trade Catalogue"
        title="Everything a practice restocks."
        lede={`${PRODUCTS.length} listed lines across ${CATEGORIES.length} ranges, with lead times marked ex-stock or indent. Build a request list and we will come back with a written quotation.`}
        crumbs={[{ label: "Catalogue" }]}
      />

      <section className="container-brand pt-4 pb-20 lg:pb-28">
        <CatalogueBrowser products={PRODUCTS} />
      </section>
    </>
  );
}
