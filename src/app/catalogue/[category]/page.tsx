import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { CatalogueBrowser } from "@/components/sections/CatalogueBrowser";
import { CategoryIcon } from "@/components/shared/CategoryIcon";
import { CATEGORIES, getCategory } from "@/data/categories";
import { getProductsByCategory } from "@/data/products";

export function generateStaticParams() {
  return CATEGORIES.map((category) => ({ category: category.slug }));
}

export async function generateMetadata({
  params,
}: PageProps<"/catalogue/[category]">): Promise<Metadata> {
  const { category: slug } = await params;
  const category = getCategory(slug);
  if (!category) return {};

  return {
    title: category.name,
    description: category.intro,
    alternates: { canonical: `/catalogue/${category.slug}` },
    openGraph: {
      title: `${category.name} · OptiSource PK`,
      description: category.intro,
      url: `/catalogue/${category.slug}`,
    },
  };
}

export default async function CategoryPage({
  params,
}: PageProps<"/catalogue/[category]">) {
  const { category: slug } = await params;
  const category = getCategory(slug);
  if (!category) notFound();

  const products = getProductsByCategory(category.slug);
  const others = CATEGORIES.filter((entry) => entry.slug !== category.slug);

  return (
    <>
      <PageHeader
        eyebrow="Trade Catalogue"
        title={category.name}
        lede={category.intro}
        crumbs={[
          { label: "Catalogue", href: "/catalogue" },
          { label: category.name },
        ]}
      >
        <div className="flex items-center gap-4">
          <span className="grid size-12 place-items-center rounded-2xl bg-white/8 ring-1 ring-white/12 ring-inset">
            <CategoryIcon
              name={category.icon}
              className="text-accent-400 size-5"
            />
          </span>
          <p className="text-silver-400 text-sm">
            {products.length} lines listed · {category.ranges.length} sub-ranges
          </p>
        </div>
      </PageHeader>

      <section className="container-brand pt-4 pb-20 lg:pb-24">
        <CatalogueBrowser
          products={products}
          showCategoryFilter={false}
          ranges={category.ranges}
        />
      </section>

      {/* Sideways navigation to the rest of the catalogue */}
      <section className="border-navy-100 border-t bg-white py-14">
        <div className="container-brand">
          <h2 className="eyebrow text-navy-400">Other ranges</h2>
          <ul className="mt-6 flex flex-wrap gap-2.5">
            {others.map((entry) => (
              <li key={entry.slug}>
                <Link
                  href={`/catalogue/${entry.slug}`}
                  className="group border-navy-200 text-navy-600 hover:border-accent-600/40 hover:text-accent-700 flex items-center gap-2.5 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors"
                >
                  <CategoryIcon name={entry.icon} className="size-4" />
                  {entry.name}
                  <ArrowRight
                    className="text-navy-300 size-3.5 transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </>
  );
}
