/**
 * Supabase connection details.
 *
 * Read through accessors rather than inline `process.env` so a missing value
 * fails loudly at the call site with a message that says what to set, instead
 * of surfacing later as an opaque "Invalid API key" from the network layer.
 */

function required(name: string, value: string | undefined): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throw new Error(
      `${name} is not set. Copy .env.example to .env.local and fill in the Supabase project details.`,
    );
  }
  return trimmed;
}

export function supabaseUrl(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
}

/** The publishable (anon) key. Safe in the browser; RLS is what protects data. */
export function supabaseAnonKey(): string {
  return required(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );
}
