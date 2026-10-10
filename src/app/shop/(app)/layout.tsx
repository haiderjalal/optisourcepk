import Link from "next/link";
import { DatabaseBackup, LogOut, Plus } from "lucide-react";
import { Logo, LogoMark } from "@/components/shared/Logo";
import { ButtonLink } from "@/components/ui/button";
import { requireUser } from "@/server/shop/dal";
import { signOut } from "@/features/shop/auth/actions";
import { ShopSidebar } from "@/features/shop/layout/ShopSidebar";
import { ShopFinder } from "@/features/shop/layout/ShopFinder";
import { MobileTabBar } from "@/features/shop/layout/MobileTabBar";

/**
 * Signed-in back-office shell.
 *
 * One sticky bar carries the shop finder on every screen size, so finding a
 * shop is the same gesture on a phone and a desktop. The sidebar appears from
 * `lg`; below that the tab bar takes over.
 *
 * `requireUser()` here gives the redirect, not the security — `proxy.ts` has
 * already sent signed-out visitors to the login page, and every action and
 * query checks the session again for itself.
 */
export default async function ShopAppLayout({
  children,
}: LayoutProps<"/shop">) {
  const { user } = await requireUser();

  const account = (
    <div className="space-y-1">
      <p className="text-silver-500 truncate px-3 pb-2 text-xs">{user.email}</p>
      <Link
        href="/shop/backup"
        prefetch={false}
        className="text-silver-400 hover:bg-navy-800 flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors hover:text-white"
      >
        <DatabaseBackup className="size-4 shrink-0" aria-hidden />
        Download backup
      </Link>
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
  );

  return (
    <div className="flex min-h-svh bg-mist-50">
      <aside className="bg-navy-900 sticky top-0 hidden h-svh w-64 shrink-0 flex-col lg:flex">
        <div className="border-navy-800 border-b px-5 py-5">
          <Link href="/shop" className="block">
            <Logo inverted compact />
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto">
          <ShopSidebar />
        </div>

        <div className="border-navy-800 border-t p-3">{account}</div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 border-b border-mist-200 bg-white/90 backdrop-blur-md">
          <div className="flex items-center gap-3 px-4 py-3 lg:px-8">
            <Link href="/shop" className="shrink-0 lg:hidden" aria-label="Home">
              <LogoMark className="w-9" />
            </Link>
            <div className="min-w-0 flex-1 lg:max-w-xl">
              <ShopFinder />
            </div>
            <ButtonLink href="/shop/orders/new" size="sm" className="shrink-0">
              <Plus className="size-4" aria-hidden />
              <span className="sr-only sm:not-sr-only">New order</span>
            </ButtonLink>
          </div>
        </header>

        <main className="min-w-0 flex-1 px-4 pt-6 pb-28 lg:px-8 lg:pt-8 lg:pb-12">
          {children}
        </main>
      </div>

      <MobileTabBar account={account} />
    </div>
  );
}
