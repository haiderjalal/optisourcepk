/**
 * Back-office PDFs as HTTP responses.
 *
 * Shown inline by default; `?download` on the request asks for a save dialog,
 * which is how a document gets from here onto a phone to send on. Never cached:
 * these show live balances and can change while they are still drafts.
 */

export function wantsDownload(request: Request): boolean {
  return new URL(request.url).searchParams.has("download");
}

export function pdfResponse(
  pdf: Buffer,
  fileName: string,
  download: boolean,
): Response {
  const disposition = download ? "attachment" : "inline";

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `${disposition}; filename="${fileName}"`,
      "Cache-Control": "private, no-store",
    },
  });
}

/** `OptiSource-Ledger-Devartson-Optics.pdf` — safe on every filesystem. */
export function pdfFileName(kind: string, label: string): string {
  const slug = label
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `OptiSource-${kind}-${slug || "document"}.pdf`;
}
