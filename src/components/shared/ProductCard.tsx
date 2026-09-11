import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { ProductGlyph } from "@/components/shared/ProductGlyph";
import { AddToQuoteButton } from "@/features/inquiry/AddToQuoteButton";
import { formatPKR } from "@/lib/utils";
import type { Product } from "@/types/catalogue";

export function ProductCard({ product }: { product: Product }) {
  const exStock = product.leadTime.startsWith("Ex-stock");

  return (
    <article className="group rounded-card border-navy-100 shadow-lift hover:border-accent-600/25 hover:shadow-lift-lg relative flex h-full flex-col overflow-hidden border bg-white transition-[border-color,box-shadow,transform] duration-300 hover:-translate-y-0.5">
      <div className="relative p-3 pb-0">
        <ProductGlyph
          category={product.category}
          className="aspect-[10/7] w-full transition-transform duration-500 group-hover:scale-[1.015]"
        />
        <div className="absolute top-5 left-5 flex gap-1.5">
          <Badge variant={exStock ? "stock" : "inverted"}>
            {exStock ? "Ex-stock" : "Indent"}
          </Badge>
        </div>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="eyebrow text-accent-600 text-[0.625rem]">
          {product.range}
        </p>

        <h3 className="mt-2 text-base leading-snug font-semibold">
          <Link
            href={`/catalogue/${product.category}/${product.slug}`}
            className="hover:text-accent-700 after:absolute after:inset-0"
          >
            {product.name}
          </Link>
        </h3>

        <p className="text-navy-500 mt-2 flex-1 text-sm leading-relaxed">
          {product.tagline}
        </p>

        <dl className="border-navy-100 mt-4 grid grid-cols-2 gap-3 border-t pt-4 text-xs">
          <div>
            <dt className="text-navy-300">Indicative</dt>
            <dd className="font-display text-navy-700 mt-0.5 text-sm font-semibold">
              {formatPKR(product.indicativePrice)}
              <span className="text-navy-400 ml-1 text-[0.6875rem] font-normal">
                / unit
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-navy-300">Min. order</dt>
            <dd className="font-display text-navy-700 mt-0.5 text-sm font-semibold">
              {product.moq}{" "}
              <span className="text-navy-400 text-[0.6875rem] font-normal">
                {product.unit}
              </span>
            </dd>
          </div>
        </dl>

        {/* Sits above the card-wide link overlay so the click still lands here. */}
        <div className="relative z-10 mt-4">
          <AddToQuoteButton product={product} className="w-full" />
        </div>
      </div>
    </article>
  );
}
