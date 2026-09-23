# Back-office setup

One-time steps to bring `/shop` online. Takes about ten minutes.

---

## 1. Create the Supabase project

A **new, separate** project — not the one already connected to this machine,
which belongs to a different business. Sharing a project would mean sharing a
database, a set of auth users and a backup boundary.

1. <https://supabase.com/dashboard> → **New project**
2. Name: `optisource-pk`
3. Region: **Singapore** (`ap-southeast-1`) — the closest to Pakistan, so every
   query saves roughly 150–200 ms round trip versus a US region.
4. Set a strong database password and save it in your password manager. You will
   not need it for the app, only for direct database access.

---

## 2. Run the migration

1. In the project, open **SQL Editor** → **New query**.
2. Paste the whole of [`supabase/migrations/0001_backoffice.sql`](../supabase/migrations/0001_backoffice.sql).
3. **Run**.

Then run every later file in `supabase/migrations/` the same way, one at a
time, in number order (`0002_…` through the highest number). A database that
is already set up only needs the files it has not had yet — for example
`0012_alerts_lens_sign_optional_sku.sql` (range-wide stock alerts, plus/minus
lens type, SKU optional) and `0013_purchase_invoices.sql` (suppliers and
purchase invoices).

It should report success with no rows. If anything errors, stop and send me the
message — do not run it twice. The script is not re-runnable: it creates enum
types and tables that will already exist on a second run, so a partial failure
needs the error, not a retry.

**Sanity check.** Run this afterwards; it should return 8 tables, all with RLS on:

```sql
select tablename, rowsecurity
from pg_tables
where schemaname = 'public'
order by tablename;
```

And this should return 3 functions:

```sql
select proname from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and proname in ('adjust_stock','issue_invoice','void_invoice');
```

---

## 3. Create your login

The back office has no public sign-up — accounts are created by you, deliberately.

1. **Authentication** → **Users** → **Add user** → *Create new user*.
2. Use a real email and a strong password.
3. Tick **Auto Confirm User**, otherwise the account cannot sign in until the
   confirmation email is clicked.

---

## 4. Point the app at it

**Project Settings** → **API**, then copy two values into `.env.local`:

```
NEXT_PUBLIC_SUPABASE_URL=https://<your-project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<the anon / publishable key>
```

Use the **anon / publishable** key. Never the `service_role` key — it bypasses
every row-level security policy, and anything prefixed `NEXT_PUBLIC_` is shipped
to the browser.

Restart `npm run dev`, then go to <http://localhost:3000/shop> and sign in.

Without these two variables the back office **fails closed**: every `/shop`
route redirects to the login page, which reports that it is not configured.

---

## 5. Before deploying

Add the same two variables in **Vercel** → Project → Settings → Environment
Variables, for Production and Preview.

`/shop` is excluded from `robots.txt` and from the sitemap, and every page under
it sends `noindex`.

---

## Notes

- **What protects the data** is row-level security, not the anon key. Every
  table allows only `authenticated` users; `anon` is revoked explicitly. The
  ledger and stock history have no `UPDATE` or `DELETE` policy at all, so they
  are append-only at the database level, not merely by convention.
- **Invoice numbering** starts at 1. To continue an existing series, set the
  counter *before* raising the first invoice:
  ```sql
  update public.counters set next_value = 292056 where name = 'invoice_no';
  ```
- **GST and Additional Tax default to 0**, matching the reference invoice. They
  can be set per invoice when one needs sales tax.
- **Backups** are automatic on Supabase, but check the retention on your plan.
  A backup is only useful if it can be restored, so try a restore once.
