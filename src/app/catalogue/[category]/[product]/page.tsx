import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronRight, Clock, Layers, ShieldCheck } from "lucide-react";
import { ProductCard } from "@/components/shared/ProductCard";
import { ProductGlyph } from "@/components/shared/ProductGlyph";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { QuantityAdd } from "@/features/inquiry/QuantityAdd";
import { getCategory } from "@/data/categories";
import {
  PRODUCTS,
  getProduct,
  getProductsByCategory,
  getRelatedProducts,
} from "@/data/products";
import { CONTACT, SITE } from "@/lib/site";
import { formatPKR } from "@/lib/utils";

export function generateStaticParams() {
  return PRODUCTS.map((product) => ({
    category: product.category,
    product: product.slug,
  }));
}

export async function generateMetadata({
  params,
}: PageProps<"/catalogue/[category]/[product]">): Promise<Metadata> {
  const { product: slug } = await params;
  const product = getProduct(slug);
  if (!product) return {};

  const url = `/catalogue/${product.category}/${product.slug}`;
  return {
    title: product.name,
    description: `${product.tagline} ${product.description}`.slice(0, 158),
    alternates: { canonical: url },
    openGraph: {
      title: `${product.name} · OptiSource PK`,
      description: product.tagline,
      url,
      type: "website",
    },
  };
}

export default async function ProductPage({
  params,
}: PageProps<"/catalogue/[category]/[product]">) {
  const { product: slug } = await params;
  const product = getProduct(slug);
  if (!product) notFound();

  const category = getCategory(product.category);
  if (!category) notFound();

  const related = getRelatedProducts(product);
  const categoryTotal = getProductsByCategory(category.slug).length;
  const exStock = product.leadTime.startsWith("Ex-stock");

  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.description,
    category: category.name,
    sku: product.id,
    brand: { "@type": "Brand", name: SITE.name },
    offers: {
      "@type": "Offer",
      priceCurrency: "PKR",
      price: product.indicativePrice,
      // Quotation-only: the site never transacts.
      availability: exStock
        ? "https://schema.org/InStock"
        : "https://schema.org/PreOrder",
      eligibleQuantity: {
        "@type": "QuantitativeValue",
        minValue: product.moq,
        unitText: product.unit,
      },
      seller: { "@type": "Organization", name: SITE.legalName },
      url: `${SITE.url}/catalogue/${product.category}/${product.slug}`,
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productSchema) }}
      />

      <div className="border-navy-100 border-b bg-white">
        <div className="container-brand py-4">
          <nav aria-label="Breadcrumb">
            <ol className="text-navy-400 flex flex-wrap items-center gap-1.5 text-xs">
              <li>
                <Link href="/" className="hover:text-navy-700">
                  Home
                </Link>
              </li>
              <ChevronRight className="text-navy-300 size-3.5" aria-hidden />
              <li>
                <Link href="/catalogue" className="hover:text-navy-700">
                  Catalogue
                </Link>
              </li>
              <ChevronRight className="text-navy-300 size-3.5" aria-hidden />
              <li>
                <Link
                  href={`/catalogue/${category.slug}`}
                  className="hover:text-navy-700"
                >
                  {category.name}
                </Link>
              </li>
              <ChevronRight className="text-navy-300 size-3.5" aria-hidden />
              <li className="text-navy-600" aria-current="page">
                {product.name}
              </li>
            </ol>
          </nav>
        </div>
      </div>

      <article className="container-brand py-12 lg:py-16">
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-16">
          {/* Visual */}
          <div className="lg:sticky lg:top-28 lg:self-start">
            <ProductGlyph
              category={product.category}
              className="aspect-[4/3] w-full"
            />
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant={exStock ? "stock" : "neutral"} size="md">
                {product.leadTime}
              </Badge>
              <Badge variant="accent" size="md">
                {category.name}
              </Badge>
              <Badge size="md">{product.range}</Badge>
            </div>
            <p className="text-navy-400 mt-4 text-xs leading-relaxed">
              Schematic shown for reference. Product photography and technical
              data sheets are supplied with every quotation.
            </p>
          </div>

          {/* Detail */}
          <div>
            <p className="eyebrow text-accent-600">{product.range}</p>
            <h1 className="mt-3 text-3xl leading-tight font-bold sm:text-4xl">
              {product.name}
            </h1>
            <p className="text-navy-500 mt-4 text-lg">{product.tagline}</p>
            <p className="text-navy-600 mt-5 leading-relaxed">
              {product.description}
            </p>

            <dl className="rounded-card border-navy-100 mt-8 grid grid-cols-3 gap-4 border bg-white p-5">
              <div>
                <dt className="text-navy-400 flex items-center gap-1.5 text-xs">
                  <Layers className="size-3.5" aria-hidden />
                  Indicative
                </dt>
                <dd className="font-display text-navy-700 mt-1.5 text-lg font-bold">
                  {formatPKR(product.indicativePrice)}
                </dd>
              </div>
              <div>
                <dt className="text-navy-400 flex items-center gap-1.5 text-xs">
                  <ShieldCheck className="size-3.5" aria-hidden />
                  Min. order
                </dt>
                <dd className="font-display text-navy-700 mt-1.5 text-lg font-bold">
                  {product.moq}{" "}
                  <span className="text-navy-400 text-sm font-normal">
                    {product.unit}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-navy-400 flex items-center gap-1.5 text-xs">
                  <Clock className="size-3.5" aria-hidden />
                  Lead time
                </dt>
                <dd className="text-navy-700 mt-1.5 text-sm font-semibold">
                  {product.leadTime}
                </dd>
              </div>
            </dl>

            <div className="mt-8">
              <QuantityAdd product={product} />
            </div>

            <p className="text-navy-400 mt-5 text-xs leading-relaxed">
              Pricing shown is an indicative trade rate and is confirmed on a
              written quotation. Volume pricing applies above the minimum order.
              Need something not listed?{" "}
              <a
                href={CONTACT.emailHref}
                className="text-accent-700 font-medium underline underline-offset-2"
              >
                Email us
              </a>{" "}
              — we source to order.
            </p>

            {/* Specification */}
            <section className="mt-10">
              <h2 className="eyebrow text-navy-400">Specification</h2>
              <dl className="divide-navy-100 border-navy-100 mt-4 divide-y border-y">
                {product.specs.map((spec) => (
                  <div
                    key={spec.label}
                    className="grid grid-cols-[1fr_1.4fr] gap-4 py-3.5 text-sm"
                  >
                    <dt className="text-navy-400">{spec.label}</dt>
                    <dd className="text-navy-700 font-medium">{spec.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>
        </div>
      </article>

      {related.length > 0 && (
        <section className="border-navy-100 border-t bg-white py-16 lg:py-20">
          <div className="container-brand">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="eyebrow text-accent-600">Also in this range</p>
                <h2 className="mt-3 text-2xl font-bold sm:text-3xl">
                  More {category.name.toLowerCase()}
                </h2>
              </div>
              <ButtonLink
                href={`/catalogue/${category.slug}`}
                variant="outline"
                size="sm"
              >
                View all {categoryTotal} lines
              </ButtonLink>
            </div>

            <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((entry) => (
                <li key={entry.id}>
                  <ProductCard product={entry} />
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
