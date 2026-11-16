import { beforeEach, describe, expect, it, vi } from "vitest";

/** A fake Supabase chain: from().update().eq().is(), resolving to `state.error`. */
const db = vi.hoisted(() => {
  const state: { error: unknown } = { error: null };
  const is = vi.fn(async () => ({ error: state.error }));
  const eq = vi.fn(() => ({ is }));
  const update = vi.fn(() => ({ eq }));
  const from = vi.fn(() => ({ update }));
  return { state, is, eq, update, from };
});

vi.mock("@/server/shop/dal", () => ({
  requireUser: async () => ({
    user: { id: "owner", email: null },
    supabase: { from: db.from },
  }),
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { deleteExpense } from "@/services/shop/expense.service";

describe("deleteExpense", () => {
  beforeEach(() => {
    db.state.error = null;
    db.from.mockClear();
    db.update.mockClear();
    db.eq.mockClear();
    db.is.mockClear();
  });

  it("hides only expenses that are not already hidden", async () => {
    await deleteExpense("expense-1");

    expect(db.from).toHaveBeenCalledWith("expenses");
    expect(db.update).toHaveBeenCalledWith({ deleted_at: expect.any(String) });
    expect(db.eq).toHaveBeenCalledWith("id", "expense-1");
    expect(db.is).toHaveBeenCalledWith("deleted_at", null);
  });

  it("reports a database failure as the mapped message, not the raw one", async () => {
    db.state.error = {
      code: "42501",
      message: "permission denied for table expenses",
    };

    const failure = await deleteExpense("expense-1").catch((e: unknown) => e);

    expect(failure).toBeInstanceOf(Error);
    expect((failure as Error).message).toBe(
      "You do not have permission to do that. Try signing in again.",
    );
  });
});
