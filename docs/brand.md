# Brand

Everything here was derived from the OptiSource PK brand book imagery in
`brandbook/` — signage, stationery, packaging and the warehouse collateral.

## Logotype

`OPTISOURCE` in bold with `PK` set in the logo silver, with the descriptor
`THE OPTICAL SUPPLY` beneath in wide-tracked uppercase, and the electric-blue
rule under the lockup.

Implemented in `src/components/shared/Logo.tsx` as two components:

- `LogoMark` — the eye/aperture symbol alone
- `Logo` — the full lockup (`inverted` for navy grounds, `compact` to drop
  the descriptor)

### The mark

Two interlocking crescents spiralling around a central iris, tilted -28°.
Drawn as vector geometry on a 100×100 grid rather than shipped as a raster,
so it stays crisp at every size and inherits `currentColor` in `mono` tone.

## Palette

Tokens are defined in `src/app/globals.css` under `@theme`.

| Role                | Token        | Hex       |
| ------------------- | ------------ | --------- |
| Brand navy          | `navy-700`   | `#16294a` |
| Deep navy (grounds) | `navy-900`   | `#0b1626` |
| Section ground      | `navy-800`   | `#10203a` |
| Accent (the rule)   | `accent-600` | `#2563eb` |
| Accent hover        | `accent-700` | `#1d4ed8` |
| Logo silver         | `silver-400` | `#8fa0bc` |
| Light silver        | `silver-300` | `#b8c4d6` |
| Page ground         | `mist-100`   | `#f1f4f8` |

Use the token, never a literal hex, in components.

## Typography

| Use     | Family | Notes                           |
| ------- | ------ | ------------------------------- |
| Display | Outfit | Headings, figures, the logotype |
| Body    | Inter  | Everything else                 |

Both are loaded through `next/font/google` in `src/app/layout.tsx` and
exposed as `--font-display` / `--font-sans`.

The `eyebrow` utility reproduces the brand's wide-tracked uppercase label
(0.22em tracking, 600 weight, 11px).

## The rule

A 44×3px electric-blue rounded rule appears beneath every lockup and section
heading across the brand book. It is the `brand-rule` utility, and
`SectionHeading` places it automatically.

## Voice

Statements taken verbatim from the collateral and used across the site:

- Better Optics · Brighter Businesses
- Clear Products · Brighter Practices
- Clearer Tomorrow · Together
- Better Vision · Stronger Business
- Quality Frames · Brighter Perspectives

Values on the warehouse signage: **Focus · Support · People · Progress** and
**Quality · People · Partnership · Clear Vision**.

## Imagery

The catalogue ships with no product photography. Rather than dress the site
in stock imagery that misrepresents what is actually in the carton, each
category renders a technical schematic (`src/components/shared/ProductGlyph.tsx`)
— lens ray diagram, frame front, bottle, flask, hardware, Snellen chart — on
the blueprint ground used throughout the brand.

Replace these with real photography when it exists; `ProductGlyph` is the
single swap point.
