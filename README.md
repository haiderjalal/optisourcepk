# OptiSource PK

Wholesale optical supply website for **OptiSource PK — Wholesale Optics**.
A lead-generation site: visitors browse the trade catalogue, build a request
list, and submit a trade inquiry. **No payment is taken anywhere on the site.**

> Your Partner in Clear Vision

---

## Stack

| Concern    | Choice                                        |
| ---------- | --------------------------------------------- |
| Framework  | Next.js 16 (App Router) · React 19            |
| Language   | TypeScript, strict                            |
| Styling    | Tailwind CSS v4 (`@theme` tokens)             |
| 3D         | React Three Fiber + drei (`three`)            |
| Motion     | Motion (`motion/react`) + Lenis smooth scroll |
| Forms      | React Hook Form + Zod                         |
| Icons      | Lucide React                                  |
| Email      | Resend (optional — see Environment)           |
| Deployment | Vercel                                        |

---

## Getting started

```bash
npm install
cp .env.example .env.local
npm run dev
```

| Script              | Does                          |
| ------------------- | ----------------------------- |
| `npm run dev`       | Dev server                    |
| `npm run build`     | Production build              |
| `npm run start`     | Serve the production build    |
| `npm run lint`      | ESLint (incl. React Compiler) |
| `npm run typecheck` | `tsc --noEmit`                |
| `npm run format`    | Prettier write                |

---

## Environment

See [`.env.example`](.env.example). Only `NEXT_PUBLIC_SITE_URL` is required
to run.

Inquiry notifications are **optional by design**: without `RESEND_API_KEY`
and `INQUIRY_FROM_EMAIL`, `POST /api/inquiries` still validates, accepts and
logs the submission with a reference — a missing key never silently loses a
lead. Set both before launch.

---

## Architecture

```
UI (app/, components/)
      ↓
Hooks / feature state (features/, hooks/)
      ↓
Services (services/)      ← business rules live here
      ↓
Data (data/)              ← swap for Supabase when live stock exists
```

Key directories:

| Path                   | Holds                                                  |
| ---------------------- | ------------------------------------------------------ |
| `src/app`              | Routes only — no business logic                        |
| `src/components/ui`    | Generic primitives (Button, Badge, SectionHeading)     |
| `src/components/three` | The WebGL hero — lens geometry, iris, backdrop shader  |
| `src/features/inquiry` | Request list store + inquiry form                      |
| `src/services`         | `inquiry.service.ts` — notification + business rules   |
| `src/lib`              | `site.ts` (copy & contact), validations, logger, utils |
| `src/data`             | Catalogue: categories + products                       |

Full notes in [`docs/architecture.md`](docs/architecture.md).

---

## Editing content

Almost all copy changes are one of two files:

- **Contact details, nav, brand statements** → `src/lib/site.ts`
- **Catalogue** → `src/data/categories.ts` and `src/data/products.ts`

Adding a product adds its page, sitemap entry and structured data
automatically — routes are generated from the data.

---

## Before launch

- [ ] Replace the placeholder contact block in `src/lib/site.ts` with live
      phone, WhatsApp, email and address
- [ ] Set `NEXT_PUBLIC_SITE_URL` to the production domain
- [ ] Configure `RESEND_API_KEY`, `INQUIRY_FROM_EMAIL`,
      `INQUIRY_NOTIFICATION_EMAIL`
- [ ] Add an Open Graph image at `public/og.png` and reference it in
      `src/app/layout.tsx`
- [ ] Confirm every statistic in `src/components/sections/WhySection.tsx` is
      accurate — they are currently illustrative

`robots.ts` already blocks indexing on any non-production Vercel
environment, so preview deployments stay out of search.

---

## Brand

Palette, typography and the logo reconstruction are documented in
[`docs/brand.md`](docs/brand.md). Source brand book imagery lives in
`brandbook/`.
