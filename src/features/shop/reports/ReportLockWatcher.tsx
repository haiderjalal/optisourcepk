"use client";

import { useEffect, useRef, startTransition } from "react";
import { usePathname } from "next/navigation";
import { reportKeyForPath } from "@/lib/validations/shop/reportUnlock";
import { lockReportsAction } from "./actions";

/**
 * Locks the reports again when the browser leaves them for any other page, so
 * coming back to a report asks for the passcode.
 *
 * Locking here rather than in `proxy.ts`: the sidebar prefetches every page it
 * links to, which would lock the report while it is still being read. Deleting
 * the cookie in a Server Action also clears the client's page cache, so Back
 * cannot show the report again without the passcode.
 */
export function ReportLockWatcher({
  reportOpen,
}: {
  /** An unlock is stored for this browser, read when the page was loaded. */
  reportOpen: boolean;
}) {
  const pathname = usePathname();
  const previous = useRef<string | null>(null);

  useEffect(() => {
    const from = previous.current;
    previous.current = pathname;
    if (reportKeyForPath(pathname) !== null) return;

    // Just left a report, or loaded another page while one was still open.
    const leftReport =
      from === null ? reportOpen : reportKeyForPath(from) !== null;
    if (leftReport) {
      startTransition(async () => {
        await lockReportsAction();
      });
    }
  }, [pathname, reportOpen]);

  return null;
}
