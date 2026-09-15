import type { CategorySlug, Product } from "@/types/catalogue";

/**
 * Trade catalogue.
 *
 * Deliberately carries no pricing and no minimum order quantity: the site
 * publishes what we supply, and the trade desk quotes both against the
 * customer's actual volume. Move this array behind a CMS or Supabase table
 * when live stock data becomes available; every consumer already reads it
 * through the accessors below.
 */
export const PRODUCTS: Product[] = [
  // ── Ophthalmic Lenses ───────────────────────────────────────────────
  {
    id: "lns-1561-sv-hc",
    slug: "single-vision-1-56-hard-coated",
    name: "Single Vision 1.56 Hard-Coated",
    category: "lenses",
    range: "Single Vision",
    tagline: "The everyday workhorse of the dispensing bench.",
    description:
      "Our highest-turnover stock lens. CR-39 based 1.56 index with a scratch-resistant hard coat, held in depth from -6.00 to +4.00 so the powers you dispense daily are always on the shelf.",
    specs: [
      { label: "Index", value: "1.56" },
      { label: "Power range", value: "-6.00 to +4.00 DS" },
      { label: "Cylinder", value: "up to -2.00 DC" },
      { label: "Coating", value: "Hard coat (HC)" },
      { label: "Diameter", value: "65 / 70 mm" },
      { label: "Abbe value", value: "38" },
    ],
    unit: "pairs",
    featured: true,
    leadTime: "Ex-stock · 24–48 hrs",
  },
  {
    id: "lns-1561-sv-arc",
    slug: "single-vision-1-56-anti-reflective",
    name: "Single Vision 1.56 Anti-Reflective",
    category: "lenses",
    range: "Coatings",
    tagline: "Green-tint AR with a hydrophobic top layer.",
    description:
      "Multi-layer anti-reflective stack over a 1.56 substrate. Adds the clarity and cosmetics patients notice immediately, at a price point that still works on a mid-tier dispense.",
    specs: [
      { label: "Index", value: "1.56" },
      { label: "Coating", value: "HMC + hydrophobic" },
      { label: "Residual reflex", value: "Green" },
      { label: "Power range", value: "-6.00 to +4.00 DS" },
      { label: "Warranty", value: "12 months against delamination" },
    ],
    unit: "pairs",
    leadTime: "Ex-stock · 24–48 hrs",
  },
  {
    id: "lns-160-prog",
    slug: "progressive-1-60-free-form",
    name: "Progressive 1.60 Free-Form",
    category: "lenses",
    range: "Progressive",
    tagline: "Wide corridor, short fitting height.",
    description:
      "Digitally surfaced free-form progressive with a soft-design corridor that tolerates the shorter fitting heights of current frame shapes. Supplied glazed or uncut.",
    specs: [
      { label: "Index", value: "1.60" },
      { label: "Design", value: "Free-form, soft corridor" },
      { label: "Min. fitting height", value: "14 mm" },
      { label: "Addition", value: "+0.75 to +3.50" },
      { label: "Coating", value: "HMC + hydrophobic" },
    ],
    unit: "pairs",
    featured: true,
    leadTime: "Rx lab · 4–6 working days",
  },
  {
    id: "lns-156-bifocal",
    slug: "bifocal-1-56-kryptok",
    name: "Bifocal 1.56 Kryptok",
    category: "lenses",
    range: "Bifocal",
    tagline: "Round-segment bifocal, still dispensed daily.",
    description:
      "A 22 mm round-segment bifocal that remains the practical choice across much of the market. Consistent segment placement carton to carton.",
    specs: [
      { label: "Index", value: "1.56" },
      { label: "Segment", value: "22 mm round" },
      { label: "Addition", value: "+0.75 to +3.00" },
      { label: "Coating", value: "Hard coat" },
    ],
    unit: "pairs",
    leadTime: "Ex-stock · 24–48 hrs",
  },
  {
    id: "lns-156-photo",
    slug: "photochromic-1-56-grey",
    name: "Photochromic 1.56 Grey",
    category: "lenses",
    range: "Photochromic",
    tagline: "Fades back fast in Islamabad heat.",
    description:
      "Grey photochromic with a fade-back profile tuned for high ambient temperature, where slower formulations stay dark indoors and frustrate patients.",
    specs: [
      { label: "Index", value: "1.56" },
      { label: "Activated transmission", value: "≈ 15%" },
      { label: "Clear transmission", value: "≈ 90%" },
      { label: "Fade-back", value: "~5 min to 70%" },
      { label: "UV", value: "UV400" },
    ],
    unit: "pairs",
    leadTime: "Ex-stock · 48 hrs",
  },
  {
    id: "lns-156-blue",
    slug: "blue-light-1-56-clear",
    name: "Blue Light 1.56 Clear",
    category: "lenses",
    range: "Blue Light",
    tagline: "Filter without the yellow cast.",
    description:
      "Blue-violet filtering built into the coating stack rather than the substrate, so the lens stays visually clear on the face — the objection that kills most blue-light dispenses.",
    specs: [
      { label: "Index", value: "1.56" },
      { label: "Filtration", value: "Blue-violet 415–455 nm" },
      { label: "Residual reflex", value: "Light blue" },
      { label: "Base tint", value: "Clear" },
    ],
    unit: "pairs",
    featured: true,
    leadTime: "Ex-stock · 24–48 hrs",
  },

  // ── Optical Frames ──────────────────────────────────────────────────
  {
    id: "frm-acetate-classic",
    slug: "acetate-optical-frame-assortment",
    name: "Acetate Optical Frame Assortment",
    category: "frames",
    range: "Acetate",
    tagline: "One carton fills a display board.",
    description:
      "Italian-style acetate in a mixed carton — six shapes across four colourways and two sizes. Built so a single order refreshes a whole board instead of deepening one SKU.",
    specs: [
      { label: "Material", value: "Cellulose acetate" },
      { label: "Hinge", value: "Riveted 5-barrel" },
      { label: "Sizes", value: "50-18 / 52-18 / 54-18" },
      { label: "Carton mix", value: "6 shapes × 4 colours" },
      { label: "Supplied with", value: "Demo lenses, hang tag" },
    ],
    unit: "pieces",
    featured: true,
    leadTime: "Ex-stock · 3–5 working days",
  },
  {
    id: "frm-metal-ss",
    slug: "stainless-steel-optical-frame",
    name: "Stainless Steel Optical Frame",
    category: "frames",
    range: "Metal",
    tagline: "Thin profile, nickel-free, spring hinged.",
    description:
      "Lightweight stainless frames with spring hinges and silicone pads. The default recommendation when a patient wants something that disappears on the face.",
    specs: [
      { label: "Material", value: "316L stainless steel" },
      { label: "Hinge", value: "Spring" },
      { label: "Weight", value: "18 g" },
      { label: "Finish", value: "IP plated, nickel-free" },
      { label: "Sizes", value: "52-18 / 54-18" },
    ],
    unit: "pieces",
    leadTime: "Ex-stock · 3–5 working days",
  },
  {
    id: "frm-rimless-ti",
    slug: "titanium-rimless-mount",
    name: "Titanium Rimless Mount",
    category: "frames",
    range: "Rimless",
    tagline: "Beta-titanium, drilled or notched.",
    description:
      "Beta-titanium three-piece mounts supplied with bushes and mounting hardware. Glazing tolerances documented on every carton so your lab drills once.",
    specs: [
      { label: "Material", value: "Beta-titanium" },
      { label: "Mount", value: "Drilled / notched" },
      { label: "Weight", value: "11 g" },
      { label: "Hardware", value: "Bushes + screws included" },
    ],
    unit: "pieces",
    leadTime: "Ex-stock · 5 working days",
  },
  {
    id: "frm-tr90-kids",
    slug: "tr90-flexible-kids-frame",
    name: "TR90 Flexible Kids Frame",
    category: "frames",
    range: "Kids",
    tagline: "Bends, doesn't break.",
    description:
      "TR90 memory polymer with a wrap-around cable temple option. Survives what children actually do to spectacles, which is the only specification that matters here.",
    specs: [
      { label: "Material", value: "TR90 memory polymer" },
      { label: "Ages", value: "4–12" },
      { label: "Temple", value: "Standard or cable" },
      { label: "Sizes", value: "44-16 / 46-16 / 48-17" },
      { label: "Strap", value: "Silicone head strap included" },
    ],
    unit: "pieces",
    leadTime: "Ex-stock · 3–5 working days",
  },
  {
    id: "frm-sun-polarised",
    slug: "polarised-sunwear-assortment",
    name: "Polarised Sunwear Assortment",
    category: "frames",
    range: "Sunwear",
    tagline: "Ready-glazed polarised, retail-tagged.",
    description:
      "Ready-to-sell polarised sunwear supplied glazed and tagged. Arrives shelf-ready — no glazing time, no counter prep.",
    specs: [
      { label: "Lens", value: "Polarised TAC, UV400" },
      { label: "Categories", value: "Cat. 3" },
      { label: "Carton mix", value: "5 shapes × 3 colours" },
      { label: "Supplied with", value: "Case, cloth, retail tag" },
    ],
    unit: "pieces",
    leadTime: "Ex-stock · 3–5 working days",
  },

  // ── Accessories ─────────────────────────────────────────────────────
  {
    id: "acc-case-clamshell",
    slug: "clamshell-spectacle-case",
    name: "Clamshell Spectacle Case",
    category: "accessories",
    range: "Cases",
    tagline: "Print your practice mark on the lid.",
    description:
      "Rigid clamshell case with a microfibre lining. Available plain in six colours, or foil-blocked with your practice mark from 250 units.",
    specs: [
      { label: "Shell", value: "Rigid PU over ABS" },
      { label: "Lining", value: "Microfibre" },
      { label: "Colours", value: "6 stock colours" },
      { label: "Branding", value: "Foil block from 250 units" },
    ],
    unit: "pieces",
    leadTime: "Ex-stock · 48 hrs",
  },
  {
    id: "acc-cleaner-spray",
    slug: "lens-cleaning-solution-100ml",
    name: "Lens Cleaning Solution 100 ml",
    category: "accessories",
    range: "Cleaning",
    tagline: "Alcohol-free, coating-safe.",
    description:
      "Alcohol-free spray formulated not to lift AR coatings. Supplied in 100 ml retail bottles or 5 L refill drums for the dispensing counter.",
    specs: [
      { label: "Volume", value: "100 ml" },
      { label: "Formulation", value: "Alcohol-free, ammonia-free" },
      { label: "Coating safe", value: "AR, HMC, hydrophobic" },
      { label: "Refill", value: "5 L drum available" },
    ],
    unit: "bottles",
    featured: true,
    leadTime: "Ex-stock · 48 hrs",
  },
  {
    id: "acc-microfibre",
    slug: "microfibre-cleaning-cloth",
    name: "Microfibre Cleaning Cloth",
    category: "accessories",
    range: "Cleaning",
    tagline: "Pinked edge, 180 gsm, printable.",
    description:
      "180 gsm microfibre with a pinked edge that will not fray through the first wash. Full-colour print available across the whole face.",
    specs: [
      { label: "Size", value: "150 × 175 mm" },
      { label: "Weight", value: "180 gsm" },
      { label: "Edge", value: "Pinked" },
      { label: "Print", value: "Full-colour, from 500 units" },
    ],
    unit: "pieces",
    leadTime: "Ex-stock · 48 hrs",
  },
  {
    id: "acc-cord-silicone",
    slug: "silicone-spectacle-cord",
    name: "Silicone Spectacle Cord",
    category: "accessories",
    range: "Cords & Chains",
    tagline: "Grip that survives a Karachi summer.",
    description:
      "Silicone cord with adjustable toggle and moulded temple grips sized for both metal and acetate ends.",
    specs: [
      { label: "Length", value: "650 mm adjustable" },
      { label: "Material", value: "Medical-grade silicone" },
      { label: "Colours", value: "8 stock colours" },
    ],
    unit: "pieces",
    leadTime: "Ex-stock · 48 hrs",
  },
  {
    id: "acc-readers",
    slug: "ready-readers-display-pack",
    name: "Ready Readers Display Pack",
    category: "accessories",
    range: "Readers",
    tagline: "48 readers, one counter spinner.",
    description:
      "Pre-merchandised reader pack with a counter spinner. Powers weighted to the way readers actually sell: heavier through +1.50 to +2.50.",
    specs: [
      { label: "Pack", value: "48 pieces + spinner" },
      { label: "Powers", value: "+1.00 to +3.50" },
      { label: "Weighting", value: "Bias to +1.50 – +2.50" },
      { label: "Supplied with", value: "Spinner, price tags" },
    ],
    unit: "packs",
    leadTime: "Ex-stock · 3 working days",
  },

  // ── Lab Supplies ────────────────────────────────────────────────────
  {
    id: "lab-blocking-pads",
    slug: "edging-blocking-pads",
    name: "Edging Blocking Pads",
    category: "lab-supplies",
    range: "Blocking",
    tagline: "Consistent tack, no axis slip.",
    description:
      "Adhesive blocking pads with consistent tack across the roll. Slip during edging is a re-cut, and re-cuts are the most expensive minutes in a glazing lab.",
    specs: [
      { label: "Diameter", value: "24 mm" },
      { label: "Pack", value: "1,000 pads" },
      { label: "Adhesive", value: "High-tack, residue-free" },
      { label: "Compatible", value: "Most automatic edgers" },
    ],
    unit: "packs",
    leadTime: "Ex-stock · 3 working days",
  },
  {
    id: "lab-edging-wheel",
    slug: "diamond-edging-wheel",
    name: "Diamond Edging Wheel",
    category: "lab-supplies",
    range: "Edging",
    tagline: "Roughing, finishing and bevel in one stack.",
    description:
      "Three-stage diamond wheel for glass and resin. Supplied with the grit and bond specification printed on the hub so replacements match without a phone call.",
    specs: [
      { label: "Stages", value: "Rough / finish / bevel" },
      { label: "Bore", value: "Specify on order" },
      { label: "Substrate", value: "Resin, poly, glass" },
      { label: "Expected life", value: "≈ 12,000 lenses" },
    ],
    unit: "pieces",
    leadTime: "Indent · 2–3 weeks",
  },
  {
    id: "lab-tint-dye",
    slug: "lens-tinting-dye-set",
    name: "Lens Tinting Dye Set",
    category: "lab-supplies",
    range: "Tinting & Chemistry",
    tagline: "Repeatable shade, batch to batch.",
    description:
      "Concentrated tinting dyes with documented dwell-time curves, so the grey you mixed last month is the grey you mix today.",
    specs: [
      { label: "Set", value: "8 × 1 L concentrates" },
      { label: "Shades", value: "Grey, brown, green, blue +4" },
      { label: "Substrate", value: "CR-39, 1.56, 1.60" },
      { label: "Documentation", value: "Dwell-time chart included" },
    ],
    unit: "sets",
    leadTime: "Ex-stock · 5 working days",
  },
  {
    id: "lab-neutraliser",
    slug: "tint-neutraliser-5l",
    name: "Tint Neutraliser 5 L",
    category: "lab-supplies",
    range: "Tinting & Chemistry",
    tagline: "Strip and re-tint without hazing.",
    description:
      "Neutralising solution for stripping tint from resin lenses prior to re-tinting, without the surface haze that forces a scrap.",
    specs: [
      { label: "Volume", value: "5 L" },
      { label: "Working temp", value: "85–92 °C" },
      { label: "Substrate", value: "CR-39, 1.56" },
      { label: "Handling", value: "SDS supplied with every drum" },
    ],
    unit: "drums",
    leadTime: "Ex-stock · 5 working days",
  },
  {
    id: "lab-polish",
    slug: "lens-polishing-compound",
    name: "Lens Polishing Compound",
    category: "lab-supplies",
    range: "Surfacing",
    tagline: "Fine-grade slurry for surfacing.",
    description:
      "Fine-grade polishing slurry for the surfacing line, supplied with particle-size certification per batch.",
    specs: [
      { label: "Volume", value: "20 L" },
      { label: "Particle size", value: "1.0 µm ±0.2" },
      { label: "Certification", value: "Per-batch particle-size report" },
    ],
    unit: "drums",
    leadTime: "Indent · 2 weeks",
  },

  // ── Frame Parts & Tools ─────────────────────────────────────────────
  {
    id: "prt-nosepads-sil",
    slug: "silicone-nose-pads-assortment",
    name: "Silicone Nose Pads Assortment",
    category: "frame-parts-tools",
    range: "Nose Pads",
    tagline: "Sorted by size, not tipped in a tray.",
    description:
      "Push-in and screw-in silicone pads from 11 to 15 mm, compartment-boxed by size and fitting. The difference between a two-minute repair and a rummage.",
    specs: [
      { label: "Sizes", value: "11 / 12 / 13 / 14 / 15 mm" },
      { label: "Fitting", value: "Push-in and screw-in" },
      { label: "Pack", value: "500 pairs, compartment box" },
      { label: "Material", value: "Medical-grade silicone" },
    ],
    unit: "boxes",
    featured: true,
    leadTime: "Ex-stock · 48 hrs",
  },
  {
    id: "prt-screws",
    slug: "optical-screw-assortment",
    name: "Optical Screw Assortment",
    category: "frame-parts-tools",
    range: "Screws & Hardware",
    tagline: "1.2 to 1.6 mm, stainless, labelled.",
    description:
      "Stainless screws across the diameters and lengths that actually turn up on the bench, in a labelled compartment case with a spare-lid index.",
    specs: [
      { label: "Diameters", value: "1.2 / 1.4 / 1.6 mm" },
      { label: "Lengths", value: "3–8 mm" },
      { label: "Material", value: "Stainless, nickel-free" },
      { label: "Pack", value: "1,000 pcs, indexed case" },
    ],
    unit: "cases",
    leadTime: "Ex-stock · 48 hrs",
  },
  {
    id: "prt-temple-tips",
    slug: "temple-tip-assortment",
    name: "Temple Tip Assortment",
    category: "frame-parts-tools",
    range: "Temple Tips",
    tagline: "Slip-on tips for metal and wire temples.",
    description:
      "Slip-on acetate and silicone tips across the common bore sizes, boxed by bore so the fit is found by eye rather than by trial.",
    specs: [
      { label: "Bore sizes", value: "1.2 / 1.4 mm" },
      { label: "Materials", value: "Acetate, silicone" },
      { label: "Pack", value: "200 pairs" },
    ],
    unit: "boxes",
    leadTime: "Ex-stock · 48 hrs",
  },
  {
    id: "prt-toolkit",
    slug: "optician-workshop-tool-kit",
    name: "Optician Workshop Tool Kit",
    category: "frame-parts-tools",
    range: "Tools",
    tagline: "Everything the bench needs, in one roll.",
    description:
      "Angling, snipe-nose and rimless pliers with screwdrivers and a pad spanner, in a roll that keeps the set together. Tools walk; rolls do not.",
    specs: [
      { label: "Contents", value: "5 pliers, 4 drivers, pad spanner" },
      { label: "Pliers", value: "Nylon-jaw, box-joint" },
      { label: "Case", value: "Canvas roll" },
    ],
    unit: "kits",
    leadTime: "Ex-stock · 5 working days",
  },

  // ── Optometric Equipment ────────────────────────────────────────────
  {
    id: "opt-trial-set",
    slug: "trial-lens-set-266",
    name: "Trial Lens Set — 266 Piece",
    category: "optometric",
    range: "Trial Sets",
    tagline: "Metal-rim, calibrated, cased.",
    description:
      "A 266-piece metal-rim trial set with calibration certificate, in a fitted case. The reference point every refraction in the room depends on.",
    specs: [
      { label: "Pieces", value: "266" },
      { label: "Rim", value: "Metal, colour-coded" },
      { label: "Sphere", value: "±0.25 to ±20.00 D" },
      { label: "Cylinder", value: "±0.25 to ±6.00 D" },
      { label: "Certification", value: "Calibration certificate" },
    ],
    unit: "sets",
    featured: true,
    leadTime: "Indent · 3–4 weeks",
  },
  {
    id: "opt-chart-led",
    slug: "led-vision-chart",
    name: "LED Vision Chart",
    category: "optometric",
    range: "Charts & Occluders",
    tagline: "Snellen, LogMAR and paediatric optotypes.",
    description:
      "Wall-mounted LED chart with remote, covering Snellen, LogMAR, paediatric optotypes and contrast sensitivity, calibrated for a 6 m room.",
    specs: [
      { label: "Distance", value: "6 m (3 m mirrored)" },
      { label: "Charts", value: "Snellen, LogMAR, paediatric" },
      { label: "Control", value: "IR remote" },
      { label: "Power", value: "220 V AC" },
    ],
    unit: "pieces",
    leadTime: "Indent · 2–3 weeks",
  },
  {
    id: "opt-occluder",
    slug: "handheld-occluder-set",
    name: "Handheld Occluder Set",
    category: "optometric",
    range: "Charts & Occluders",
    tagline: "Multi-pinhole, Maddox and plain.",
    description:
      "Plain, multi-pinhole and Maddox-rod occluders in a single set, matched in handle weight so the change between tests is not felt by the patient.",
    specs: [
      { label: "Set", value: "3 occluders" },
      { label: "Types", value: "Plain, multi-pinhole, Maddox" },
      { label: "Material", value: "ABS with matte finish" },
    ],
    unit: "sets",
    leadTime: "Ex-stock · 5 working days",
  },
  {
    id: "opt-cl-cases",
    slug: "contact-lens-case-bulk",
    name: "Contact Lens Cases — Bulk",
    category: "optometric",
    range: "Vision Care",
    tagline: "L/R marked, leak-tested, printable.",
    description:
      "Leak-tested contact lens cases with clear L/R marking, supplied loose or individually bagged, plain or printed.",
    specs: [
      { label: "Pack", value: "500 pieces" },
      { label: "Marking", value: "Moulded L / R" },
      { label: "Testing", value: "Leak-tested per batch" },
      { label: "Branding", value: "Pad print from 1,000 units" },
    ],
    unit: "cartons",
    leadTime: "Ex-stock · 48 hrs",
  },
  {
    id: "opt-eye-shields",
    slug: "post-operative-eye-shields",
    name: "Post-Operative Eye Shields",
    category: "optometric",
    range: "Vision Care",
    tagline: "Perforated, sterile-packed.",
    description:
      "Perforated clear shields in individual sterile packs, with hypoallergenic tape supplied alongside.",
    specs: [
      { label: "Pack", value: "100 individually sealed" },
      { label: "Material", value: "Perforated clear PVC" },
      { label: "Supplied with", value: "Hypoallergenic tape" },
    ],
    unit: "packs",
    leadTime: "Ex-stock · 5 working days",
  },
];

export function getProductsByCategory(category: CategorySlug): Product[] {
  return PRODUCTS.filter((product) => product.category === category);
}

export function getProduct(slug: string): Product | undefined {
  return PRODUCTS.find((product) => product.slug === slug);
}

export function getProductById(id: string): Product | undefined {
  return PRODUCTS.find((product) => product.id === id);
}

export function getFeaturedProducts(): Product[] {
  return PRODUCTS.filter((product) => product.featured);
}

/** Other products in the same category, excluding the current one. */
export function getRelatedProducts(product: Product, limit = 3): Product[] {
  return PRODUCTS.filter(
    (candidate) =>
      candidate.category === product.category && candidate.id !== product.id,
  ).slice(0, limit);
}
