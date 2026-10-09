import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * The brand mark as a data URL, shared by every back-office PDF.
 *
 * Read once per process. A missing file must not stop a document going out, so
 * failure is cached as `null` and the document simply renders without the mark.
 */

const LOGO_PATH = path.join(process.cwd(), "public", "brand", "logo.png");

let logoPromise: Promise<string | null> | undefined;

export function loadBrandLogo(): Promise<string | null> {
  logoPromise ??= readFile(LOGO_PATH)
    .then((file) => `data:image/png;base64,${file.toString("base64")}`)
    .catch(() => null);
  return logoPromise;
}
