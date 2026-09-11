import { Compass, Home, Search } from "lucide-react";
import { LogoMark } from "@/components/shared/Logo";
import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return (
    <section className="bg-navy-900 relative isolate flex min-h-[70svh] items-center overflow-hidden py-20">
      <div className="grid-blueprint absolute inset-0 opacity-25" aria-hidden />
      <div
        className="bg-accent-600/12 absolute top-1/2 left-1/2 size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[130px]"
        aria-hidden
      />

      <div className="container-brand relative text-center">
        <LogoMark className="mx-auto size-16" id="notfound" />
        <p className="eyebrow text-accent-400 mt-8">Error 404</p>
        <h1 className="mt-5 text-4xl font-bold text-white sm:text-5xl">
          Out of focus.
        </h1>
        <p className="text-silver-400 mx-auto mt-5 max-w-md leading-relaxed">
          That page is not in our catalogue. It may have been moved, or the
          address may have a typo in it.
        </p>

        <div className="mt-9 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/" variant="inverted" size="lg">
            <Home className="size-4" aria-hidden />
            Back to home
          </ButtonLink>
          <ButtonLink href="/catalogue" variant="outlineInverted" size="lg">
            <Search className="size-4" aria-hidden />
            Browse the catalogue
          </ButtonLink>
          <ButtonLink href="/contact" variant="outlineInverted" size="lg">
            <Compass className="size-4" aria-hidden />
            Contact us
          </ButtonLink>
        </div>
      </div>
    </section>
  );
}
