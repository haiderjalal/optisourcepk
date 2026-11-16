import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Static checks on the Supabase migrations. They do not talk to a database;
 * they stop a new migration from quietly adding an unprotected table, a view
 * that runs as its owner, a function that skips its search path, or a grant to
 * the anonymous role. Run against a live database as well before a release.
 */

const MIGRATIONS = path.resolve(__dirname, "../supabase/migrations");

function migrationSql(): string {
  return readdirSync(MIGRATIONS)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => readFileSync(path.join(MIGRATIONS, file), "utf8"))
    .join("\n");
}

/** Names captured by a pattern, as a set. */
function names(sql: string, pattern: RegExp): Set<string> {
  return new Set([...sql.matchAll(pattern)].map((match) => match[1]));
}

describe("row level security", () => {
  const sql = migrationSql();

  it("enables RLS on every table the migrations create", () => {
    const created = names(
      sql,
      /^\s*create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)/gim,
    );
    const protectedTables = names(
      sql,
      /alter\s+table\s+public\.(\w+)\s+enable\s+row\s+level\s+security/gi,
    );

    expect(created.size).toBeGreaterThan(0);
    expect([...created].filter((table) => !protectedTables.has(table))).toEqual(
      [],
    );
  });

  it("creates every policy for the signed-in role only, never for anon or public", () => {
    const policies = [...sql.matchAll(/create\s+policy[\s\S]*?;/gi)].map(
      (match) => match[0],
    );

    expect(policies.length).toBeGreaterThan(0);
    expect(
      policies.filter((policy) => !/\bto\s+authenticated\b/i.test(policy)),
    ).toEqual([]);
  });

  it("grants nothing to the anonymous role", () => {
    const anonGrants = [...sql.matchAll(/grant\s[^;]*;/gi)]
      .map((match) => match[0])
      .filter((grant) => /\bto\s+[^;]*\banon\b/i.test(grant));

    expect(anonGrants).toEqual([]);
  });

  it("makes every view run as the caller, so RLS applies to it", () => {
    const views = [
      ...sql.matchAll(/create\s+(?:or\s+replace\s+)?view\s+public\.\w+/gi),
    ];
    const invoker = [
      ...sql.matchAll(
        /create\s+(?:or\s+replace\s+)?view\s+public\.\w+\s+with\s*\(\s*security_invoker\s*=\s*true\s*\)/gi,
      ),
    ];

    expect(views.length).toBeGreaterThan(0);
    expect(invoker.length).toBe(views.length);
  });

  it("gives every security definer function a fixed search path", () => {
    const definers = [...sql.matchAll(/security\s+definer/gi)];
    const pinned = [
      ...sql.matchAll(/security\s+definer\s+set\s+search_path\s*=/gi),
    ];

    expect(definers.length).toBeGreaterThan(0);
    expect(pinned.length).toBe(definers.length);
  });
});
