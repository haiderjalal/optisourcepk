import { ArrowRight } from "lucide-react";
import { ProductCard } from "@/components/shared/ProductCard";
import { Stagger, StaggerItem } from "@/components/shared/Reveal";
import { ButtonLink } from "@/components/ui/button";
import { SectionHeading } from "@/components/ui/section-heading";
import { getFeaturedProducts } from "@/data/products";

export function FeaturedProducts() {
  const products = getFeaturedProducts();

  return (
    <section className="container-brand py-20 lg:py-28">
      <div className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
        <SectionHeading
          eyebrow="Moving fastest"
          title="The lines practices reorder."
          lede="Held deep because they turn over weekly — not because they look good in a catalogue."
        />
        <ButtonLink href="/catalogue" variant="outline" className="shrink-0">
          View full catalogue
          <ArrowRight
            className="size-4 transition-transform group-hover/btn:translate-x-0.5"
            aria-hidden
          />
        </ButtonLink>
      </div>

      <Stagger
        as="ul"
        className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        {products.map((product) => (
          <StaggerItem as="li" key={product.id}>
            <ProductCard product={product} />
          </StaggerItem>
        ))}
      </Stagger>

      <p className="text-navy-400 mt-8 text-xs">
        Trade pricing and order quantities are confirmed on a written quotation.
        This site does not take payment.
      </p>
    </section>
  );
}
