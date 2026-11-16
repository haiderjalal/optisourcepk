# Security hardening report

Date: 2026-11-16
Branch: `chore/security-hardening`, cut from `chore/performance-quick-wins` at
`6707a18`. Worktree: `D:/Projects/optisourcepk-security`. Nothing is pushed.

## Summary

The audit read every route handler, server action and service under `src/app`,
`src/features`, `src/services` and `src/server`, plus the migrations, the git
history, the npm advisories and the public folder. Two read-only review passes
covered the shop actions and services; their findings are triaged below.

Fixed in this branch, each with a regression test:

- Sign-in throttling read the first `X-Forwarded-For` hop, which the caller
  sets. Now it reads the hop the platform appended.
- The report passcode had no limit on guesses. Now six wrong guesses per signed-in
  user in 15 minutes lock further attempts.
- The development invoice preview was blocked only in production. Now it is served
  only when `NODE_ENV` is `development`.
- The WhatsApp webhook read any body size before checking its signature. Now it
  refuses bodies over 256 KB while streaming.
- Next.js 16.0.0–16.4.0 had a critical advisory and zod below 4.6.6 a high one. Both
  are fixed by the upgrade.
- Expense re-delete could move the restore deadline forward. Now only live rows are hidden.
- Stock receive stored a mistyped power or cost as "none". Now it is refused.
- Failed report unlocks, throttled sign-ins and throttled inquiries are logged,
  without credentials or addresses.
- Two headers were added (`X-Permitted-Cross-Domain-Policies`, `Cross-Origin-Opener-Policy`).

Not fixed here, and needing the owner: row level security is open to any
signed-in account (see "Owner must do"), prices are not checked on the server, and
several items need a database migration or an environment change.

## Verification

| Check                                         | Result                                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `npx tsc --noEmit`                            | exit 0                                                                                           |
| `npx eslint`                                  | exit 0, no warnings                                                                              |
| `npx vitest run`                              | 11 files, 45 tests, all pass                                                                     |
| `npx next build`                              | exit 0 (Next 16.4.6)                                                                             |
| Production server, live headers               | all headers present on `/`; `/shop/login` is `no-store`; no `X-Powered-By`                       |
| Production server, `/api/dev/invoice-preview` | 404                                                                                              |
| Tests against pre-fix code                    | 10 of the new tests fail when the old behaviour files are swapped back in                        |
| Prettier, changed files                       | pass                                                                                             |
| Prettier, whole repo                          | 55 files already drift from the style; none is a file changed here, and they are not reformatted |

The 10 failing-on-old-code tests cover the sign-in throttle, the unlock throttle,
the dev route, the webhook size limit, expense re-delete and the stock numeric
guard. The other 5 new tests guard behaviour that already held.

### Dependencies

| Advisory                                                                        | Before                   | After                                      |
| ------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------ |
| next 16.0.0–16.4.0 (critical, RCE in image optimisation, DoS in Server Actions) | present                  | cleared, pinned to 16.4.6                  |
| zod < 4.6.6 (high, memory exhaustion)                                           | present                  | cleared, `^4.6.7` resolved                 |
| vitest 3.2.7 added during this work (critical)                                  | introduced, then avoided | vitest 5.1.0 is used                       |
| typescript-eslint ≤ 8.72.2, minimatch (moderate)                                | present                  | still present, dev tooling only; see below |

- Vitest 5 needs `@types/node` 22 or newer. `@types/node` moved from `^20` to `^24`,
  the Node version the project runs under locally. Typecheck and tests pass.
- The seven remaining moderate advisories are in ESLint's TypeScript packages
  (`typescript-eslint` and `@typescript-eslint/*`) and `minimatch`. They are
  development-only. `npm audit fix` moved `typescript-eslint` from 8.70.0 to 8.72.2,
  which is still inside the advisory range, so I reverted it. Clearing them needs
  an ESLint major upgrade. That is a decision for the owner.
- Unused packages: every direct dependency is imported somewhere, and
  `babel-plugin-react-compiler` is required by `reactCompiler: true`. None removed.

### Git history scan

- No private keys, service-role keys, Resend keys, WhatsApp secrets or
  `REPORTS_PASSCODE` values in any commit.
- Commit `1861b15` (`.env.example`) once contained the real Supabase project URL
  and the publishable and anon keys. Both keys are public by design. The live
  database is still protected by RLS and by Auth settings (see below). Rotation is
  not required for that reason alone; it is the owner's call.
- The working tree is clean of secrets. `.env.example` now holds only placeholders,
  and a test checks that.

## Fixed in this branch

| Area              | Change                                                                                                                                                            | Test                                                           |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Sign-in throttle  | Reads the platform-appended address, not the caller's leftmost hop                                                                                                | `tests/login-throttle.test.ts`, `tests/rate-limit.test.ts`     |
| Report passcode   | Six wrong guesses per user per 15 minutes; successful unlocks are not counted                                                                                     | `tests/report-unlock.test.ts`                                  |
| Dev route         | 404 unless `NODE_ENV` is `development`; marked dynamic                                                                                                            | `tests/dev-route.test.ts`                                      |
| Webhook body      | 256 KB cap, streamed; refused before the signature check                                                                                                          | `tests/whatsapp-webhook.test.ts`, `tests/request-body.test.ts` |
| Headers           | `X-Permitted-Cross-Domain-Policies: none`, `Cross-Origin-Opener-Policy: same-origin-allow-popups`                                                                 | `tests/security-headers.test.ts`                               |
| Expense delete    | Hides only live rows, so re-delete no longer extends the restore window                                                                                           | `tests/expense-delete.test.ts`                                 |
| Stock receive     | Refuses a non-numeric power or cost instead of storing it as none                                                                                                 | `tests/stock-receive-numbers.test.ts`                          |
| Logging           | Warns on sign-in throttle, unlock refusal and throttle, inquiry throttle                                                                                          | Code only                                                      |
| Dependencies      | next 16.4.6, eslint-config-next 16.4.6, zod ^4.6.7, vitest ^5.1.0, @types/node ^24                                                                                | Build, tsc, eslint, tests                                      |
| Env documentation | Every variable the code reads is in `.env.example`; no secret-shaped values; no `NEXT_PUBLIC_` secrets                                                            | `tests/env-documentation.test.ts`                              |
| Migrations        | Every table has RLS; every view is `security_invoker`; every policy is `to authenticated`; no grant to `anon`; every security definer function pins `search_path` | `tests/rls-migrations.test.ts`                                 |

## Verified with no change needed

| Item                  | Evidence                                                                                                                                      |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin routes locked   | `src/proxy.ts` gates `/shop`; `requireUser()` re-checks every action, service and route; report pages call `requireReportsUnlocked`           |
| Passwords hashed      | The app stores no passwords; Supabase Auth hashes them                                                                                        |
| Session cookies       | `httpOnly`, `sameSite: lax`, `secure` in production (`src/lib/supabase/cookies.ts`)                                                           |
| CSRF                  | Server Actions reject foreign origins; cookies are `SameSite=Lax`; no state-changing GET route                                                |
| CORS                  | No `Access-Control-Allow-Origin` anywhere; the label printer helper binds to `127.0.0.1`, checks the Host header and uses an origin allowlist |
| HTTPS                 | HSTS (two years, no subdomains) on every response                                                                                             |
| Debug mode            | Production build; `X-Powered-By` off; dev-only route gated                                                                                    |
| Parameterised queries | Supabase client and PostgREST only; no raw SQL; filters are built per value; the one dynamic SQL uses `%I` and is revoked from client roles   |
| XSS                   | React escaping throughout; the one `dangerouslySetInnerHTML` (`JsonLd`) escapes `<`                                                           |
| Email injection       | Inquiry values are validated by Zod and cleaned before reaching headers or HTML                                                               |
| File uploads          | None exist in the app (no file inputs, no `File` handling)                                                                                    |
| Exposed files         | `docs/`, `brandbook/`, `graphify-out/` are not served. `public/` holds only the default SVGs and `brand/logo.png`                             |
| Honeypot              | `company` field accepted and dropped silently                                                                                                 |
| Inquiry body          | 32 KB cap; the rate limit reads the rightmost hop                                                                                             |
| Backup download       | Requires a session; `no-store`; `attachment`                                                                                                  |
| PDFs                  | Filenames reduced to `[A-Za-z0-9-]`; responses `private, no-store`; the four report PDFs check the report unlock                              |

## Owner must do (dashboard or Vercel; not changed here)

1. **Supabase Auth: turn off anonymous sign-ins and public sign-up.** Most important.
   The RLS policies (`owner_all … to authenticated using (true)`) let every
   signed-in account read and write all business data, and anonymous sessions use
   the `authenticated` role. The app's own `requireUser()` does not stop a direct
   PostgREST call with such a token. Then confirm the only accounts are the owner's.
2. **Run the live grant checks** and confirm the results:
   ```sql
   select routine_name, grantee from information_schema.routine_privileges
     where routine_schema = 'public' and grantee in ('PUBLIC', 'anon');
   select table_name, privilege_type from information_schema.role_table_grants
     where table_schema = 'public' and grantee = 'anon';
   ```
3. **Supabase Auth settings:** password minimum length; OTP/reset expiry (the default
   is one hour); the reset email template. The app has no reset page of its own,
   so these hosted settings are what expire reset links.
4. **Vercel:** confirm the HTTP-to-HTTPS redirect is on, and that `REPORTS_PASSCODE`
   is set. Consider a longer passcode than four digits.
5. **Repository visibility:** confirm whether the GitHub repo is public. If it is,
   the history note above matters more.
6. **Decide whether to rotate the publishable key.** It is public by design. Rotation
   needs a matching update to Vercel. Not done without your approval.
7. **Branch:** review `chore/security-hardening` and decide how to merge it. The
   sales-return PDF commit (`6aef605`) lives only on `feature/edit-purchase`, and
   that branch lacks the passcode-lock work, so the two were not combined here.

## Owner must decide (behaviour or design)

1. **Server-side prices (Medium–High).** The server does not verify unit prices. The
   order builder pre-fills `unitPrice` from the product list price on the client, and
   the server writes whatever arrives (`src/services/shop/invoice.service.ts`, the
   `replaceLines` path). Discount, quantity and RX costs follow the same path.
   Recommendation: recompute non-RX unit prices from `products.list_price` on the
   server, and reject a different price unless the user has an explicit override. The
   owner asked that pricing not change without approval, so this is not done.
2. **Report unlock cookie.** The signature key is the passcode itself, so anyone who
   copies the cookie can test the four-digit passcode offline
   (`src/server/shop/reportLock.ts`). Fix: sign with a separate server secret. That is
   a new environment variable, so it needs approval.
3. **Backup export.** `/shop/backup` downloads all 17 tables as one plain JSON file,
   including purchase costs, archived rows and tax numbers. It is behind the session.
   Decide whether it should also need the reports passcode or a fresh sign-in.
4. **Per-customer statement is not passcode-gated.** `customers/[id]/statement` shows
   the same ledger rows as the locked Ledger report. Confirm that is intended.
5. **Content-Security-Policy.** Not set, by the decision in `docs/architecture.md`. A
   nonce-based CSP for `/shop` only (set in `proxy.ts`) is feasible, since those pages
   are already dynamic. Needs your go-ahead and a browser test.
6. **Rate limits are per instance.** They live in process memory, so a determined
   attacker can spread attempts across instances. A shared store (Upstash or Vercel
   KV) would enforce them globally.

## Findings from the review passes, not yet fixed

Both review passes were read-only and reported "verified by reading". I re-checked
the items marked (checked) below; the rest are as reported.

| Severity | Finding                                                                                                                                                                            | Where                                                    |
| -------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| High     | Any signed-in account has full CRUD on customers, products, stock bins, orders and suppliers, and can insert ledger rows (see owner action 1)                                      | `0001_backoffice.sql:575–590`, `0013`, `0016`, `0037`    |
| Medium   | `delete_invoice(uuid)` is still granted to `authenticated` and hard-deletes an issued invoice with no trash record. No app code calls it (checked)                                 | `0026_invoice_edit_delete.sql:133–161`                   |
| Medium   | Freight, GST and additional-tax rates are checked only by Zod, not in `issue_invoice`. A direct RPC call can post a negative amount                                                | `0034_edit_keeps_invoice_number.sql`                     |
| Medium   | Replacing a draft's lines deletes them before the checks that can fail (daily-service lines, missing products), and the header is already written. A failed edit can empty a draft | `invoice.service.ts`, `replaceLines`                     |
| Medium   | Four security definer RPCs have no `REVOKE … FROM PUBLIC` (see proposed SQL)                                                                                                       | `0044`, `0045`, `0046`, `0047`                           |
| Low      | `isRx` is trusted on update, so a crafted post can rewrite an RX order's lines                                                                                                     | `invoice.service.ts`, `orders/actions.ts`                |
| Low      | `updateDelivery` has no state check, so a voided invoice can change status                                                                                                         | `invoice.service.ts:870–918`                             |
| Low      | `post_daily_outgoing` and `reverse_daily_outgoing` do not check invoice state                                                                                                      | `0036_daily_lines_self_record.sql`                       |
| Low      | Void, dispatch and delivery actions have no Zod schema and unbounded text fields                                                                                                   | `orders/actions.ts:268–290, 364–396`                     |
| Low      | Missing numeric fields coerce to 0 (`Number(null)`) on some paths                                                                                                                  | `purchases/actions.ts`, `invoice.ts:113`                 |
| Low      | Receive quantity has no upper bound; reorder level has no bound (checked)                                                                                                          | `products/actions.ts:172–216`                            |
| Low      | Stock receive JSON `entries` has no shape check, and its `.filter` runs outside the `try`                                                                                          | `products/actions.ts:277–282`                            |
| Low      | Ids are not UUID-checked before `.eq("id", …)`; a bad id returns a Postgres error code in the message                                                                              | `customers`, `products`, `suppliers`, `expenses` actions |
| Info     | Error mapping passes SQLSTATE `23001` messages to the browser; they may name constraints (not verified against Postgres)                                                           | `services/shop/errors.ts:25–28, 71`                      |
| Info     | "Append-only ledger" comment is inaccurate: reversal, trash and remove functions update or delete rows                                                                             | `ledger.service.ts:18`                                   |

## Proposed SQL (not applied, not tested)

Review in staging before running. These need a migration file, and the owner
applies them. Each keeps the `authenticated` grant the app uses.

```sql
-- Stop PUBLIC and anon executing functions that only signed-in users should call.
revoke all on function public.remove_rx_from_invoice(uuid) from public, anon;
revoke all on function public.trash_ledger_entry(uuid) from public, anon;
revoke all on function public.delete_invoice(uuid) from public, anon;
revoke all on function public.post_daily_outgoing(uuid) from public, anon;
revoke all on function public.reverse_daily_outgoing(uuid) from public, anon;
-- update_purchase and update_ledger_entry: add the same revoke with the argument
-- list from supabase/migrations/0046_edit_purchase.sql and 0047_edit_ledger_entry.sql.

-- delete_invoice is hard-delete with no trash record, and no app code calls it.
drop function if exists public.delete_invoice(uuid);
```

Further recommended changes, not written as SQL here: check constraints on
freight, GST and additional-tax rates inside `issue_invoice`; invoice-state
guards inside the daily outgoing functions; and tightening the `owner_all`
policies once the owner has confirmed who should have access.

## Limitations

- Supabase Auth settings, live grants and the production `REPORTS_PASSCODE` were
  not checked. The database was not reachable from here.
- Rate limits are per instance, as above.
- The two review passes were read-only. Their claims were checked only where this
  report says so.
- The production check ran for a few seconds, so `/shop` redirect behaviour was
  checked by reading and tests, not live.
- Prettier reports 55 files already out of style. They are untouched by this work
  and were left alone.
