import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { LoginForm } from "@/features/shop/auth/LoginForm";

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false, follow: false },
};

export default async function LoginPage({
  searchParams,
}: PageProps<"/shop/login">) {
  const { next } = await searchParams;
  const target = typeof next === "string" ? next : undefined;

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

        <div className="shadow-lift-lg rounded-2xl bg-white p-6">
          <LoginForm next={target} />
        </div>

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
