/**
 * Shown the moment a back-office link is clicked, while the next page's data
 * loads. Without it the old page sat unchanged until the new one was ready,
 * which read as the app freezing.
 */
export default function ShopLoading() {
  return (
    <div className="mx-auto max-w-5xl" role="status" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <div className="animate-pulse motion-reduce:animate-none" aria-hidden>
        <div className="h-3 w-24 rounded bg-mist-200" />
        <div className="mt-3 h-7 w-56 rounded bg-mist-200" />
        <div className="shadow-lift mt-6 space-y-3 rounded-2xl bg-white p-5">
          <div className="h-4 w-1/3 rounded bg-mist-200" />
          <div className="h-4 w-full rounded bg-mist-100" />
          <div className="h-4 w-full rounded bg-mist-100" />
          <div className="h-4 w-5/6 rounded bg-mist-100" />
        </div>
        <div className="shadow-lift mt-5 space-y-3 rounded-2xl bg-white p-5">
          <div className="h-4 w-1/4 rounded bg-mist-200" />
          <div className="h-4 w-full rounded bg-mist-100" />
          <div className="h-4 w-2/3 rounded bg-mist-100" />
        </div>
      </div>
    </div>
  );
}
