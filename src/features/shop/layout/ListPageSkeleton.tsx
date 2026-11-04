/**
 * The shape of a back-office list while its rows load: the heading, the search
 * or filter row, and a table of placeholder rows. A list page shows this the
 * moment it is opened, so the page is there before its data arrives.
 */
export function ListPageSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="mx-auto max-w-5xl" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="animate-pulse motion-reduce:animate-none" aria-hidden>
        <div className="h-3 w-24 rounded bg-mist-200" />
        <div className="mt-3 h-7 w-56 rounded bg-mist-200" />
        <div className="mt-3 h-4 w-80 max-w-full rounded bg-mist-100" />

        <div className="mt-6 flex gap-2">
          <div className="shadow-lift h-10 flex-1 rounded-xl bg-white" />
          <div className="h-10 w-24 rounded-xl bg-mist-200" />
        </div>

        <div className="shadow-lift mt-5 overflow-hidden rounded-2xl bg-white">
          <div className="h-10 bg-mist-100" />
          {Array.from({ length: rows }, (_, index) => (
            <div
              key={index}
              className="flex gap-4 border-t border-mist-200 px-4 py-3"
            >
              <div className="h-4 w-1/5 rounded bg-mist-200" />
              <div className="h-4 w-1/4 rounded bg-mist-100" />
              <div className="h-4 flex-1 rounded bg-mist-100" />
              <div className="h-4 w-16 rounded bg-mist-200" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
