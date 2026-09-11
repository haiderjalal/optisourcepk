import type { Category } from "@/types/catalogue";

export const CATEGORIES: Category[] = [
  {
    slug: "lenses",
    name: "Ophthalmic Lenses",
    summary: "Single vision, progressive, photochromic and blue-light stock.",
    intro:
      "Stock and Rx lenses held in depth across the powers Pakistani practices actually dispense. Every batch is power-verified and coating-inspected before it leaves the floor.",
    icon: "Eye",
    ranges: [
      "Single Vision",
      "Progressive",
      "Bifocal",
      "Photochromic",
      "Blue Light",
      "Coatings",
    ],
  },
  {
    slug: "frames",
    name: "Optical Frames",
    summary: "Acetate, metal, rimless and TR90 in retail-ready assortments.",
    intro:
      "Curated frame assortments built for turnover, not for warehouse shelves. Mixed-size, mixed-colour cartons so a single order fills a full display board.",
    icon: "Glasses",
    ranges: ["Acetate", "Metal", "Rimless", "TR90", "Kids", "Sunwear"],
  },
  {
    slug: "accessories",
    name: "Accessories",
    summary: "Cases, cleaning, cords, readers and counter display.",
    intro:
      "The margin-rich counter lines that finish a dispense — cases, cloths, sprays, cords and readers, available plain or printed with your practice mark.",
    icon: "SprayCan",
    ranges: ["Cases", "Cleaning", "Cords & Chains", "Readers", "Display"],
  },
  {
    slug: "lab-supplies",
    name: "Lab Supplies",
    summary: "Edging, tinting, surfacing and chemistry consumables.",
    intro:
      "Consumables that keep a glazing lab running — blocking pads, edging wheels, polish, tints, neutralisers and UV solutions, supplied on standing order.",
    icon: "FlaskConical",
    ranges: ["Edging", "Blocking", "Tinting & Chemistry", "Surfacing"],
  },
  {
    slug: "frame-parts-tools",
    name: "Frame Parts & Tools",
    summary: "Nose pads, screws, temple tips and workshop tools.",
    intro:
      "The small parts that decide whether a repair takes two minutes or two weeks. Sorted, labelled and boxed by size so your bench never guesses.",
    icon: "Wrench",
    ranges: ["Nose Pads", "Screws & Hardware", "Temple Tips", "Tools"],
  },
  {
    slug: "optometric",
    name: "Optometric Equipment",
    summary: "Exam room essentials, charts, occluders and trial sets.",
    intro:
      "Exam-room equipment and consumables for optometrists and vision-care clinics, from trial lens sets and charts through to patches, shields and contact-lens handling supplies.",
    icon: "Stethoscope",
    ranges: ["Exam Room", "Charts & Occluders", "Trial Sets", "Vision Care"],
  },
];

export function getCategory(slug: string): Category | undefined {
  return CATEGORIES.find((category) => category.slug === slug);
}
