import type { ReactNode } from "react";

/**
 * The title block every back-office screen opens with, so each page states
 * where it is and what it is for in the same place, at the same size.
 */
export function ShopPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  /** The screen's main action(s). Sits right on desktop, below on a phone. */
  actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow text-accent-600">{eyebrow}</p>}
        <h1 className="mt-2 text-2xl font-bold tracking-tight">{title}</h1>
        {description && (
          <p className="text-navy-500 mt-2 max-w-prose text-sm">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
