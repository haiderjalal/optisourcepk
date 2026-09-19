import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Settings2 } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { LoginForm } from "@/features/shop/auth/LoginForm";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: PageProps<"/shop/login">) {
  const { next } = await searchParams;
  const target = typeof next === "string" ? next : undefined;

  // Say so before the form is filled in, rather than after a sign-in that
  // could never have succeeded. Names the variables, because the fix is
  // always the same two.
  const configured = isSupabaseConfigured();

  return (
    <div className="bg-navy-900 relative isolate flex min-h-svh items-center justify-center overflow-hidden px-5 py-16">
      <div className="grid-blueprint absolute inset-0 opacity-20" aria-hidden />
      <div
        className="bg-accent-600/12 absolute top-1/2 left-1/2 size-[520px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[130px]"
        aria-hidden
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-8 text-center">
          <Logo inverted orientation="stacked" className="mx-auto" />
          <p className="eyebrow text-accent-400 mt-6">Back office</p>
          <h1 className="mt-2 text-2xl font-bold text-white">
            Sign in to continue
          </h1>
        </div>

        {configured ? (
          <div className="shadow-lift-lg rounded-2xl bg-white p-6">
            <LoginForm next={target} />
          </div>
        ) : (
          <div className="shadow-lift-lg rounded-2xl bg-white p-6">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-amber-50 ring-1 ring-amber-200 ring-inset">
                <Settings2 className="size-4 text-amber-700" aria-hidden />
              </span>
              <div className="min-w-0">
                <h2 className="text-sm font-semibold">Not connected yet</h2>
                <p className="text-navy-500 mt-1.5 text-sm leading-relaxed">
                  No sign-in can work until the Supabase project is linked. Add
                  both of these to <code className="text-xs">.env.local</code>{" "}
                  and restart the dev server:
                </p>
                <ul className="text-navy-600 mt-3 space-y-1 rounded-lg bg-mist-100 p-3 font-mono text-[11px]">
                  <li>NEXT_PUBLIC_SUPABASE_URL</li>
                  <li>NEXT_PUBLIC_SUPABASE_ANON_KEY</li>
                </ul>
                <p className="text-navy-400 mt-3 text-xs leading-relaxed">
                  Both are in the Supabase dashboard under Project Settings →
                  API. Full steps are in{" "}
                  <code className="text-[11px]">docs/backoffice-setup.md</code>.
                </p>
              </div>
            </div>
          </div>
        )}

        <Link
          href="/"
          className="text-silver-400 hover:text-accent-400 mt-6 flex items-center justify-center gap-2 text-sm transition-colors"
        >
          <ArrowLeft className="size-4" aria-hidden />
          Back to the website
        </Link>
      </div>
    </div>
  );
}
