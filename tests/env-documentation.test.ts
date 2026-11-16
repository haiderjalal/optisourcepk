import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

/** Platform-provided variables the app reads but nobody sets by hand. */
const PLATFORM_VARIABLES = new Set(["NODE_ENV", "VERCEL_ENV"]);

/** Values that look like a real key, whatever the variable is called. */
const KEY_SHAPED =
  /eyJ[A-Za-z0-9_-]{10,}|sb_(secret|publishable)_|re_[A-Za-z0-9]{12,}/;

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = path.join(directory, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx|mjs)$/.test(entry) ? [full] : [];
  });
}

function environmentNamesInCode(): Set<string> {
  const names = new Set<string>();
  for (const file of sourceFiles(path.join(ROOT, "src"))) {
    const text = readFileSync(file, "utf8");
    for (const match of text.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)) {
      names.add(match[1]);
    }
  }
  return names;
}

/** Name → value for every assignment in .env.example. */
function documentedVariables(): Map<string, string> {
  const text = readFileSync(path.join(ROOT, ".env.example"), "utf8");
  const documented = new Map<string, string>();
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (match) documented.set(match[1], match[2]);
  }
  return documented;
}

describe(".env.example and the environment the app reads", () => {
  it("documents every variable the code reads", () => {
    const documented = documentedVariables();
    const undocumented = [...environmentNamesInCode()].filter(
      (name) => !PLATFORM_VARIABLES.has(name) && !documented.has(name),
    );

    expect(undocumented).toEqual([]);
  });

  it("holds no real secret, only empty values or placeholders", () => {
    const leaked = [...documentedVariables()]
      .filter(([, value]) => KEY_SHAPED.test(value))
      .map(([name]) => name);

    expect(leaked).toEqual([]);
  });

  it("keeps server-only secrets out of the browser namespace", () => {
    const publicSecrets = [...documentedVariables().keys()].filter(
      (name) =>
        name.startsWith("NEXT_PUBLIC_") &&
        /SECRET|PASSCODE|SERVICE_ROLE|PRIVATE|API_KEY_/.test(name),
    );

    expect(publicSecrets).toEqual([]);
  });
});
