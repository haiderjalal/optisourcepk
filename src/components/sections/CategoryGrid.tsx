import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { CategoryIcon } from "@/components/shared/CategoryIcon";
import { Stagger, StaggerItem } from "@/components/shared/Reveal";
import { TiltCard } from "@/components/shared/TiltCard";
import { SectionHeading } from "@/components/ui/section-heading";
import { CATEGORIES } from "@/data/categories";
import { getProductsByCategory } from "@/data/products";
import { cn } from "@/lib/utils";

export function CategoryGrid({
  eyebrow = "The Catalogue",
  title = "Six ranges, one delivery note.",
  lede = "Everything a practice, lab or optical retailer restocks — held under one roof so you are not chasing six suppliers for one week's orders.",
  className,
}: {
  eyebrow?: string;
  title?: string;
  lede?: string;
  className?: string;
}) {
  return (
    <section className={cn("container-brand py-20 lg:py-28", className)}>
      <SectionHeading eyebrow={eyebrow} title={title} lede={lede} />

      <Stagger
        as="ul"
        className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        {CATEGORIES.map((category) => (
          <StaggerItem as="li" key={category.slug}>
            <TiltCard className="group rounded-card h-full">
              <Link
                href={`/catalogue/${category.slug}`}
                className="rounded-card border-navy-100 shadow-lift hover:border-accent-600/30 hover:shadow-lift-lg flex h-full flex-col border bg-white p-7 transition-[border-color,box-shadow] duration-300"
              >
                <div className="flex items-start justify-between">
                  <span className="bg-navy-50 ring-navy-100 group-hover:bg-accent-600 group-hover:ring-accent-600 grid size-12 place-items-center rounded-2xl ring-1 transition-colors duration-300 ring-inset">
                    <CategoryIcon
                      name={category.icon}
                      className="text-navy-600 size-5 transition-colors duration-300 group-hover:text-white"
                    />
                  </span>
                  <ArrowUpRight
                    className="text-navy-300 group-hover:text-accent-600 size-5 transition-[color,transform] duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                    aria-hidden
                  />
                </div>

                <h3 className="mt-6 text-xl font-semibold">{category.name}</h3>
                <p className="text-navy-500 mt-2.5 flex-1 text-sm leading-relaxed">
                  {category.summary}
                </p>

                <div className="border-navy-100 mt-6 flex flex-wrap gap-1.5 border-t pt-5">
                  {category.ranges.slice(0, 3).map((range) => (
                    <span
                      key={range}
                      className="text-navy-500 rounded-full bg-mist-100 px-2.5 py-1 text-[0.6875rem] font-medium"
                    >
                      {range}
                    </span>
                  ))}
                  {category.ranges.length > 3 && (
                    <span className="text-navy-300 rounded-full px-2 py-1 text-[0.6875rem] font-medium">
                      +{category.ranges.length - 3}
                    </span>
                  )}
                </div>

                <p className="text-navy-300 mt-3 text-[0.6875rem] font-medium tracking-[0.08em] uppercase">
                  {getProductsByCategory(category.slug).length} lines listed
                </p>
              </Link>
            </TiltCard>
          </StaggerItem>
        ))}
      </Stagger>
    </section>
  );
}
