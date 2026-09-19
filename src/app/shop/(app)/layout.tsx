import Link from "next/link";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/shared/Logo";
import { requireUser } from "@/server/shop/dal";
import { signOut } from "@/features/shop/auth/actions";
import { ShopSidebar } from "@/features/shop/layout/ShopSidebar";

/**
 * Signed-in back-office shell.
 *
 * `requireUser()` here gives the redirect, not the security — `proxy.ts` has
 * already sent signed-out visitors to the login page, and every action and
 * query checks the session again for itself.
 */
export default async function ShopAppLayout({
  children,
}: LayoutProps<"/shop">) {
  const { user } = await requireUser();

  return (
    <div className="bg-mist-50 flex min-h-svh">
      <aside className="bg-navy-900 sticky top-0 hidden h-svh w-60 shrink-0 flex-col lg:flex">
        <div className="border-navy-800 border-b px-5 py-5">
          <Link href="/shop" className="block">
            <Logo inverted compact />
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto">
          <ShopSidebar />
        </div>

        <div className="border-navy-800 border-t p-3">
          <p className="text-silver-500 truncate px-3 pb-2 text-xs">
            {user.email}
          </p>
          <form action={signOut}>
            <button
              type="submit"
              className="text-silver-400 hover:bg-navy-800 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:text-white"
            >
              <LogOut className="size-4 shrink-0" aria-hidden />
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* Mobile: the sidebar collapses to a scrolling strip above the content. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="border-mist-200 bg-navy-900 flex items-center justify-between gap-4 border-b px-5 py-3 lg:hidden">
          <Link href="/shop">
            <Logo inverted compact />
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="text-silver-400 flex items-center gap-2 text-sm hover:text-white"
            >
              <LogOut className="size-4" aria-hidden />
              <span className="sr-only sm:not-sr-only">Sign out</span>
            </button>
          </form>
        </header>

        <div className="bg-navy-900 overflow-x-auto lg:hidden">
          <ShopSidebar orientation="horizontal" />
        </div>

        <main className="min-w-0 flex-1 p-5 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
