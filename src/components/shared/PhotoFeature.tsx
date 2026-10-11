import Image, { type StaticImageData } from "next/image";
import { ArrowRight } from "lucide-react";
import { Reveal } from "@/components/shared/Reveal";
import { ButtonLink } from "@/components/ui/button";

export interface PhotoFeatureLink {
  label: string;
  href: string;
}

/**
 * A brand photograph beside a short statement and up to two calls to action.
 *
 * The first link is the primary action; any further links are outlined. The
 * image is decorative context for the copy, so its alt text describes what is
 * shown rather than repeating the heading.
 */
export function PhotoFeature({
  image,
  alt,
  eyebrow,
  title,
  body,
  links,
}: {
  image: StaticImageData;
  alt: string;
  eyebrow: string;
  title: string;
  body: string;
  links: [PhotoFeatureLink, ...PhotoFeatureLink[]];
}) {
  const [primary, ...secondary] = links;

  return (
    <section className="container-brand py-20 lg:py-28">
      <div className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:gap-20">
        <Reveal>
          <figure className="ring-navy-100 shadow-lift-lg relative overflow-hidden rounded-[1.75rem] bg-white ring-1">
            <Image
              src={image}
              alt={alt}
              placeholder="blur"
              sizes="(min-width: 1024px) 40rem, 100vw"
              className="aspect-[4/3] h-auto w-full object-cover"
            />
          </figure>
        </Reveal>

        <Reveal>
          <span className="brand-rule" />
          <p className="eyebrow text-accent-600 mt-6">{eyebrow}</p>
          <h2 className="mt-4 text-3xl leading-[1.1] font-bold sm:text-4xl">
            {title}
          </h2>
          <p className="text-navy-500 mt-5 text-base leading-relaxed sm:text-lg">
            {body}
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <ButtonLink href={primary.href} size="lg">
              {primary.label}
              <ArrowRight
                className="size-4 transition-transform group-hover/btn:translate-x-0.5"
                aria-hidden
              />
            </ButtonLink>
            {secondary.map((link) => (
              <ButtonLink
                key={link.href}
                href={link.href}
                variant="outline"
                size="lg"
              >
                {link.label}
              </ButtonLink>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
