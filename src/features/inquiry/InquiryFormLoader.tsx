"use client";

import dynamic from "next/dynamic";

/**
 * Splits the inquiry form out of the page bundle.
 *
 * The form pulls in React Hook Form and the Zod schema — around 150 KB
 * gzipped that nothing above it needs. Loading it after first paint lets the
 * masthead and request list render immediately; the skeleton below reserves
 * the exact height so nothing shifts when it arrives.
 */
const InquiryForm = dynamic(
  () => import("./InquiryForm").then((m) => m.InquiryForm),
  { ssr: false, loading: () => <FormSkeleton /> },
);

function FormSkeleton() {
  return (
    <div
      className="rounded-card border-navy-100 animate-pulse border bg-white p-6 sm:p-8"
      aria-busy
      aria-label="Loading the inquiry form"
    >
      <div className="bg-navy-100 h-6 w-32 rounded" />
      <div className="bg-navy-50 mt-3 h-4 w-full max-w-md rounded" />
      <div className="mt-7 grid gap-5 sm:grid-cols-2">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index}>
            <div className="bg-navy-50 h-3.5 w-24 rounded" />
            <div className="border-navy-100 mt-1.5 h-11 rounded-xl border bg-white" />
          </div>
        ))}
      </div>
      <div className="mt-5">
        <div className="bg-navy-50 h-3.5 w-32 rounded" />
        <div className="border-navy-100 mt-1.5 h-32 rounded-xl border bg-white" />
      </div>
      <div className="bg-navy-100 mt-7 h-13 w-52 rounded-full" />
    </div>
  );
}

export function InquiryFormLoader() {
  return <InquiryForm />;
}
