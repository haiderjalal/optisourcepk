/**
 * Getting a shop PDF onto the phone's share sheet, or onto the disk.
 *
 * Browsers only let a page open the share sheet while the click that started
 * it is still fresh. A PDF takes a moment to render on the server, so the
 * share call must not wait for the download: `createPdfLoader` starts it on
 * hover or focus, and `sharePdfFile` falls back to a download whenever the
 * browser refuses the share. A document is then never lost to a timing issue.
 *
 * Client-only: it touches `navigator` and `document`.
 */

/** A PDF that could not be fetched, with a sentence the operator can act on. */
export class PdfUnavailableError extends Error {}

const sessionEnded =
  "Your shop session has ended. Sign in again, then try once more.";

/**
 * Fetch a shop PDF and confirm it really is one. A session that has expired
 * is redirected to the login page, which answers 200 with HTML, so the content
 * type is checked as well as the status.
 */
export async function fetchPdf(url: string, fileName: string): Promise<File> {
  let response: Response;
  try {
    response = await fetch(url, { cache: "no-store" });
  } catch {
    throw new PdfUnavailableError(
      "No connection to the shop server. Check the connection and try again.",
    );
  }

  if (response.status === 401 || response.status === 403) {
    throw new PdfUnavailableError(sessionEnded);
  }
  if (!response.ok) {
    throw new PdfUnavailableError(
      response.status === 404
        ? "That document could not be found. Refresh the page and try again."
        : `The server could not build the PDF (error ${response.status}). Try again.`,
    );
  }

  const type = response.headers.get("content-type") ?? "";
  if (!type.startsWith("application/pdf")) {
    throw new PdfUnavailableError(sessionEnded);
  }

  return new File([await response.blob()], fileName, {
    type: "application/pdf",
  });
}

/**
 * A PDF loader that fetches once and reuses the result. Call `prefetch` on
 * hover or focus so the file is ready by the time the button is clicked. A
 * failed fetch is not cached, so the next attempt tries again.
 */
export function createPdfLoader(url: string, fileName: string) {
  let pending: Promise<File> | null = null;

  function load(): Promise<File> {
    if (!pending) {
      pending = fetchPdf(url, fileName).catch((error: unknown) => {
        pending = null;
        throw error;
      });
    }
    return pending;
  }

  return {
    prefetch(): void {
      // The failure is reported by `load`, when the user asks for the file.
      load().catch(() => undefined);
    },
    load,
  };
}

export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** Save the file to the device, the way a link to a download would. */
export function downloadFile(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  // Give the browser a moment to start the save before releasing the URL.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/**
 * Print the PDF from a hidden frame, so the operator stays on this page. The
 * browser's PDF viewer in the frame owns the print dialog. A browser that
 * refuses to print a framed PDF opens it in the tab instead.
 */
export function printPdfFile(file: File, frameId: string): void {
  const url = URL.createObjectURL(file);
  document.getElementById(frameId)?.remove();

  const frame = document.createElement("iframe");
  frame.id = frameId;
  frame.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  frame.src = url;
  frame.onload = () => {
    try {
      frame.contentWindow?.focus();
      frame.contentWindow?.print();
    } catch {
      // Some mobile browsers refuse to print a framed PDF.
      window.location.assign(url);
    }
  };
  document.body.appendChild(frame);
}

/**
 * Share the PDF through the browser's share sheet where the browser can share
 * files; otherwise download it.
 *
 * Resolves "shared" or "downloaded". Closing the share sheet rejects with an
 * AbortError, which the caller should treat as a choice, not a failure. A share
 * the browser refuses (it no longer counts as a click) also falls back to the
 * download, so the operator still gets the document.
 */
export async function sharePdfFile(
  file: File,
  { title, text }: { title: string; text: string },
): Promise<"shared" | "downloaded"> {
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text });
      return "shared";
    } catch (error) {
      if (isAbortError(error)) throw error;
      // Refused for timing, not because the file cannot be shared: download.
    }
  }

  downloadFile(file);
  return "downloaded";
}
