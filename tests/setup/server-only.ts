// Stand-in for the `server-only` package in tests. The real one throws on import
// outside a Server Component; the modules under test are server code and are
// exercised directly, so the guard itself is not what is being checked.
export {};
