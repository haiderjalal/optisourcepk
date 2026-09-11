# Architecture

## Shape

This is a lead-generation site, not a shop. There is no checkout, no payment
integration and no customer account. The conversion event is a **trade
inquiry**: the visitor builds a request list from the catalogue, submits
their details, and the trade desk replies with a written quotation.

```
Browser
   │
   ▼
Server Components (app/)            ← default; almost all of the site
   │
   ├── Client islands ("use client")
   │     · Header (nav state, request-list badge)
   │     · HeroCanvas → HeroScene (WebGL, lazy + gated)
   │     · CatalogueBrowser (filter/sort)
   │     · Request list + inquiry form
   │
   ▼
Route handlers (app/api/)           ← thin: parse → rate limit → validate → service
   │
   ▼
Services (services/)                ← business rules, notification
   │
   ▼
Data (data/)                        ← typed static catalogue
```

## Rendering

49 routes prerender at build time. Only `/api/health` and `/api/inquiries`
are dynamic. Category and product pages come from `generateStaticParams` over
`data/`, so adding a product adds its page, its sitemap entry and its
`Product` structured data with no further work.

### Why there is no `loading.tsx`

Deliberate. A root `loading.tsx` wraps every page in a Suspense boundary,
and React then streams the shell first and the real page inside a
`<div hidden>` that client script swaps in. On a site where nothing awaits
data that buys nothing and costs real content in the initial HTML, plus a
skeleton flash on pages that were already prerendered.

Add one back the moment a route genuinely awaits something — a live stock
lookup, a CMS fetch — and scope it to that route rather than the root.

## Client boundary

Server Components are the default. Client components exist only where
interaction requires them, and the WebGL scene is pushed as far out as
possible:

- `HeroCanvas` (client) renders a complete CSS fallback composition
  immediately.
- It probes for WebGL, checks the viewport is at least 768px wide, and waits
  for `requestIdleCallback` before dynamically importing `HeroScene`.
- `HeroScene` is `ssr: false`, so `three` never reaches the server bundle and
  never blocks first paint.
- `PerformanceMonitor` downgrades the expensive transmission material to a
  cheaper physical material if the device cannot hold frame rate.
- `prefers-reduced-motion` disables floating, parallax and Lenis entirely.

## The request list

`features/inquiry/quoteStore.ts` is a module-level external store read
through `useSyncExternalStore`.

Why not `useState` plus a mount effect: the store gives a stable **server**
snapshot (so hydration cannot mismatch), reads `localStorage` exactly once on
first subscribe, and syncs across browser tabs through the `storage` event —
without a mount effect that writes state. Any client component can call
`useQuote()` directly; there is no provider to wrap.

The store itself is catalogue-free (see _Payload budget_), so a saved line is
shape-validated on read and resolved later: `useQuoteItems` drops anything
that no longer matches a product and prunes it from storage, because the
catalogue changes more often than a visitor's saved list.

## Validation

`src/lib/validations/inquiry.ts` is the single schema. The form and the route
handler both run it, so client rules can only ever be a faster copy of the
server's — never a different set.

## Inquiry pipeline

```
POST /api/inquiries
   │
   ├─ rate limit          fixed window, 5 per 10 min per IP
   ├─ parse JSON          400 on malformed body
   ├─ Zod validate        422 with field errors
   ├─ honeypot            accepted silently, never processed
   │
   ▼
submitInquiry()  (services/inquiry.service.ts)
   ├─ mint a reference (OSP-YYYYMM-XXXXX)
   ├─ resolve lines against the catalogue
   ├─ log the event (structured, no personal data)
   └─ notify via Resend — failure does NOT fail the inquiry
```

Notification failure is deliberately non-fatal. The inquiry is logged with
its reference so it can be recovered, and the visitor is told to call if they
do not hear back — rather than being asked to retype everything.

### Known ceilings

- **Rate limiting** is a process-local `Map`. It holds for a single Vercel
  instance. Swap `src/lib/rateLimit.ts` for Upstash or Vercel KV if inquiry
  volume spreads across regions.
- **Catalogue** is a static TypeScript array. Every consumer already reads it
  through accessors (`getProduct`, `getProductsByCategory`, and friends), so
  moving it behind Supabase means rewriting those functions and nothing else.
- **Filtering** happens in the browser. Correct for a few dozen lines; move
  to `searchParams` plus a server query once the catalogue needs pagination.

## Payload budget

Measured against a production build, gzipped, as served.

| Route          | Initial JS | HTML  |
| -------------- | ---------- | ----- |
| `/`            | 203 KB     | 37 KB |
| `/about`       | 199 KB     | 15 KB |
| `/catalogue`   | 245 KB     | 27 KB |
| `/inquiry`     | 249 KB     | 13 KB |
| product detail | 241 KB     | 20 KB |

Roughly **152 KB of that is React plus the App Router client runtime** — the
floor for this stack. The application's own code is the remaining ~50 KB.
Fonts add 79 KB once (two preloaded variable faces, immutable and cached).

Three rules keep it there:

1. **Nothing heavy in the root layout or the header.** The header renders on
   every page, so anything it imports is site-wide. It therefore uses a
   passive scroll listener rather than a motion value, CSS rather than a
   presence library for the mobile sheet, and `useQuote` rather than
   `useQuoteItems`.

2. **The catalogue never reaches the client as JavaScript.** It used to: the
   header's badge count pulled `useQuote` → `quoteStore` → `data/products`,
   shipping all 23 KB of product data to every visitor to render a number.
   `quoteStore` now imports nothing from `@/data`, and each saved line carries
   its own MOQ so quantities can still be clamped. Catalogue pages pass
   products to client components as props, which travel in the RSC payload —
   not the bundle.

3. **Animation libraries are opt-in per page.** `Reveal`, `Stagger`,
   `TiltCard`, `CountUp`, `SupplyFlow` and `AddToQuoteButton` are
   IntersectionObserver plus CSS. `motion` now loads only on `/catalogue`
   (filter layout animations) and `/inquiry`. The homepage, about,
   capabilities, contact and bulk-supply ship none of it.

Also split out: `three` and `@react-three/drei` (a 972 KB chunk that loads
only when the hero scene passes its gates), and the inquiry form with its
Zod schema and React Hook Form (~100 KB, loaded after the inquiry page
paints).

## SEO

- Metadata on every route, with a title template and canonical URLs
- `Organization` in the root layout; `BreadcrumbList` from `PageHeader`;
  `Product` on detail pages; `FAQPage` on `/contact`
- `sitemap.ts` generated from the catalogue data
- `robots.ts` blocks indexing on any non-production Vercel environment

## Accessibility

- Skip link, one `h1` per page, hierarchical headings
- A single focus-visible ring defined once in `globals.css`
- Form fields wire `aria-invalid` and `aria-describedby` through a render
  prop, so every validation message is reachable by a screen reader
- Live regions on filter results, submission status and add-to-list feedback
- `prefers-reduced-motion` honoured globally and per component
- All decorative layers — grids, glows, schematics, the whole canvas — are
  `aria-hidden`
