import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { JsonLd } from "@/components/shared/JsonLd";
import { breadcrumbSchema, type BreadcrumbItem } from "@/lib/json-ld";
import { cn } from "@/lib/utils";

export type Crumb = BreadcrumbItem;

/**
 * Navy masthead used at the top of every inner page. Emits BreadcrumbList
 * structured data that matches the visible trail exactly.
 */
export function PageHeader({
  eyebrow,
  title,
  lede,
  crumbs = [],
  children,
  className,
}: {
  eyebrow?: string;
  title: string;
  lede?: string;
  crumbs?: Crumb[];
  children?: React.ReactNode;
  className?: string;
}) {
  const trail: Crumb[] = [{ label: "Home", href: "/" }, ...crumbs];

  return (
    <section
      className={cn(
        "bg-navy-900 relative isolate overflow-hidden pt-12 pb-16 lg:pt-16 lg:pb-20",
        className,
      )}
    >
      <JsonLd data={breadcrumbSchema(trail)} />
      <div className="grid-blueprint absolute inset-0 opacity-25" aria-hidden />
      <div
        className="bg-accent-600/14 absolute -top-40 right-0 h-96 w-96 rounded-full blur-[120px]"
        aria-hidden
      />

      <div className="container-brand relative">
        <nav aria-label="Breadcrumb">
          <ol className="text-silver-500 flex flex-wrap items-center gap-1.5 text-xs">
            {trail.map((crumb, index) => (
              <li key={crumb.label} className="flex items-center gap-1.5">
                {index > 0 && (
                  <ChevronRight
                    className="text-navy-500 size-3.5"
                    aria-hidden
                  />
                )}
                {crumb.href ? (
                  <Link
                    href={crumb.href}
                    className="hover:text-silver-200 transition-colors"
                  >
                    {crumb.label}
                  </Link>
                ) : (
                  <span className="text-silver-300" aria-current="page">
                    {crumb.label}
                  </span>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-8 max-w-3xl">
          {eyebrow && (
            <p className="eyebrow text-accent-400 motion-safe:animate-rise">
              {eyebrow}
            </p>
          )}
          <span className="brand-rule mt-4" />
          <h1
            className="motion-safe:animate-rise mt-5 text-3xl leading-[1.05] font-bold text-white sm:text-4xl lg:text-[3.25rem]"
            style={{ animationDelay: "120ms" }}
          >
            {title}
          </h1>
          {lede && (
            <p
              className="text-silver-400 motion-safe:animate-rise mt-5 max-w-2xl text-base leading-relaxed sm:text-lg"
              style={{ animationDelay: "240ms" }}
            >
              {lede}
            </p>
          )}
          {children && <div className="mt-8">{children}</div>}
        </div>
      </div>
    </section>
  );
}
