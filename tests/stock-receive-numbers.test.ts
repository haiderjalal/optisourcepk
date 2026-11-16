import { describe, expect, it, vi } from "vitest";

vi.mock("@/server/shop/dal", () => ({
  requireUser: async () => ({
    user: { id: "owner", email: null },
    supabase: {},
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/navigation", () => ({
  redirect: (): never => {
    throw new Error("NEXT_REDIRECT");
  },
}));
vi.mock("@/services/shop/product.service", () => ({
  archiveProduct: vi.fn(),
  createProduct: vi.fn(),
  updateProduct: vi.fn(),
}));
vi.mock("@/services/shop/stock.service", () => ({
  adjustStock: vi.fn(),
  deleteStockMovement: vi.fn(),
  receivePowers: vi.fn(),
  receiveRange: vi.fn(),
  setReorderLevel: vi.fn(),
}));
vi.mock("@/services/shop/purchase.service", () => ({
  recordPurchase: vi.fn(),
}));

import { receivePowersAction } from "@/features/shop/products/actions";

const PRODUCT_ID = "11111111-1111-4111-8111-111111111111";

function receiveForm(fields: Record<string, string>): FormData {
  const form = new FormData();
  form.set("productId", PRODUCT_ID);
  form.set("entries", JSON.stringify([{ sph: -1, qty: 2 }]));
  for (const [name, value] of Object.entries(fields)) form.set(name, value);
  return form;
}

describe("receivePowersAction numeric fields", () => {
  it("refuses a typed power that is not a number instead of filing it as none", async () => {
    const result = await receivePowersAction(
      {},
      receiveForm({ addPower: "abc" }),
    );

    expect(result.error).toMatch(/must be numbers/);
  });

  it("refuses a non-numeric unit cost the same way", async () => {
    const result = await receivePowersAction(
      {},
      receiveForm({ unitCost: "12,5x" }),
    );

    expect(result.error).toMatch(/must be numbers/);
  });
});
