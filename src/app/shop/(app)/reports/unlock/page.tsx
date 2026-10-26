import type { Metadata } from "next";
import { requireUser } from "@/server/shop/dal";
import { unlockReportsAction } from "@/features/shop/reports/actions";
import { ShopPageHeader } from "@/features/shop/layout/ShopPageHeader";
import { inputClass } from "@/components/ui/field";

export const metadata: Metadata = { title: "Reports locked" };

const ERROR_MESSAGES: Record<string, string> = {
  wrong: "That passcode is not right. Try again.",
  unset:
    "The reports cannot be opened yet. Ask the owner to set the reports passcode.",
};

export default async function ReportsUnlockPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  await requireUser();
  const { next, error } = await searchParams;
  const message = error ? ERROR_MESSAGES[error] : undefined;

  return (
    <div className="mx-auto max-w-md">
      <ShopPageHeader
        eyebrow="Reports"
        title="Reports are locked"
        description="Enter the passcode to open monthly sales, the ledger, the RX lab report and the stock report."
      />

      <form
        action={unlockReportsAction}
        className="shadow-lift mt-6 space-y-4 rounded-2xl bg-white p-6"
      >
        <input type="hidden" name="next" value={next ?? ""} />

        <label className="flex flex-col gap-1 text-sm">
          <span className="text-navy-500 text-xs">Passcode</span>
          <input
            type="password"
            name="passcode"
            inputMode="numeric"
            autoComplete="off"
            required
            className={inputClass}
            aria-describedby={message ? "unlock-error" : undefined}
          />
        </label>

        {message && (
          <p id="unlock-error" role="alert" className="text-sm text-red-700">
            {message}
          </p>
        )}

        <button
          type="submit"
          className="bg-navy-500 w-full rounded-xl px-4 py-2 text-sm font-medium text-white"
        >
          Unlock reports
        </button>
      </form>
    </div>
  );
}
