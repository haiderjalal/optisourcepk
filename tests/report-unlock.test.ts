import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  /** Thrown by the mocked `redirect`, as Next does, so the action stops there. */
  class Redirect extends Error {
    constructor(readonly target: string) {
      super("NEXT_REDIRECT");
    }
  }

  return {
    Redirect,
    passcodeMatches: vi.fn<(entered: string) => boolean>(() => false),
    unlockReports: vi.fn<(report: string) => Promise<void>>(async () => {}),
    requireUser: vi.fn(async () => ({ user: { id: "owner", email: null } })),
  };
});

vi.mock("next/navigation", () => ({
  redirect: (target: string): never => {
    throw new mocks.Redirect(target);
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/server/shop/dal", () => ({ requireUser: mocks.requireUser }));

vi.mock("@/server/shop/reportLock", () => ({
  REPORTS_UNLOCK_PATH: "/shop/reports/unlock",
  lockReports: vi.fn(async () => {}),
  passcodeMatches: mocks.passcodeMatches,
  reportsPasscodeConfigured: () => true,
  unlockReports: mocks.unlockReports,
}));

import { unlockReportsAction } from "@/features/shop/reports/actions";

let ownerCount = 0;

/** Each test signs in as a new owner, so throttle state never carries over. */
function signInAsNewOwner(): string {
  ownerCount += 1;
  const id = `owner-${ownerCount}`;
  mocks.requireUser.mockResolvedValue({ user: { id, email: null } });
  return id;
}

/** Submits the unlock form and returns where the action redirected. */
async function submitPasscode(passcode: string): Promise<URL> {
  const form = new FormData();
  form.set("report", "sales");
  form.set("passcode", passcode);
  form.set("next", "/shop/sales");

  try {
    await unlockReportsAction(form);
  } catch (error) {
    if (error instanceof mocks.Redirect) {
      return new URL(error.target, "https://back-office.test");
    }
    throw error;
  }
  throw new Error("The unlock action did not redirect.");
}

const refusedWith = (url: URL): string | null => url.searchParams.get("error");

describe("report passcode unlock throttle", () => {
  beforeEach(() => {
    mocks.passcodeMatches.mockReset().mockReturnValue(false);
    mocks.unlockReports.mockClear();
  });

  it("refuses six wrong passcodes, then stops checking at all", async () => {
    signInAsNewOwner();

    for (let attempt = 0; attempt < 6; attempt += 1) {
      expect(refusedWith(await submitPasscode("0000"))).toBe("wrong");
    }

    expect(refusedWith(await submitPasscode("0001"))).toBe("throttled");
    expect(mocks.passcodeMatches).toHaveBeenCalledTimes(6);
  });

  it("keeps refusing the correct passcode while throttled", async () => {
    signInAsNewOwner();
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await submitPasscode("0000");
    }

    mocks.passcodeMatches.mockReturnValue(true);

    expect(refusedWith(await submitPasscode("1234"))).toBe("throttled");
    expect(mocks.unlockReports).not.toHaveBeenCalled();
  });

  it("does not count successful unlocks, so switching reports never locks the owner out", async () => {
    signInAsNewOwner();
    mocks.passcodeMatches.mockReturnValue(true);

    for (let attempt = 0; attempt < 10; attempt += 1) {
      const url = await submitPasscode("1234");
      expect(url.pathname).toBe("/shop/sales");
      expect(refusedWith(url)).toBeNull();
    }

    expect(mocks.unlockReports).toHaveBeenCalledTimes(10);
  });

  it("throttles each signed-in user on their own", async () => {
    signInAsNewOwner();
    for (let attempt = 0; attempt < 6; attempt += 1) {
      await submitPasscode("0000");
    }

    signInAsNewOwner();

    expect(refusedWith(await submitPasscode("0000"))).toBe("wrong");
  });
});
