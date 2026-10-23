import { beforeEach, describe, it, expect, vi } from "vitest";
import { truncateAll, createUser, createProfileFor } from "../helpers/db";
import { setSession, clearSession } from "@/lib/session";
import { UnauthorizedError, ForbiddenError } from "@/lib/errors";

/**
 * iron-cookie session is per-request. The requireOwner function relies on
 * Next.js's cookie API. We test the pure behavior here by stubbing cookies.
 */

const cookieStore = new Map<string, string>();
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (k: string) => (cookieStore.has(k) ? { name: k, value: cookieStore.get(k)! } : undefined),
    set: (name: string, value: string) => {
      if (value === "") cookieStore.delete(name);
      else cookieStore.set(name, value);
    },
  }),
}));

beforeEach(async () => {
  cookieStore.clear();
  await truncateAll();
});

describe("authorization boundaries", () => {
  it("requireOwner throws UnauthorizedError when there is no session", async () => {
    const { requireOwner } = await import("@/domain/auth");
    await expect(requireOwner()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("requireOwner clears the session when the user vanished", async () => {
    const { requireOwner } = await import("@/domain/auth");
    await setSession({ userId: "00000000-0000-0000-0000-000000000000", email: "ghost@example.com" });
    await expect(requireOwner()).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("requireOwner returns owner and profile when matched", async () => {
    const { requireOwner } = await import("@/domain/auth");
    const user = await createUser("owner@example.com");
    await createProfileFor(user.id);
    await setSession({ userId: user.id, email: user.email });
    const ctx = await requireOwner();
    expect(ctx.user.id).toBe(user.id);
    expect(ctx.profile?.userId).toBe(user.id);
  });

  it("requireOwnerWithProfile throws ForbiddenError when there is no profile", async () => {
    const { requireOwnerWithProfile } = await import("@/domain/auth");
    const user = await createUser();
    await setSession({ userId: user.id, email: user.email });
    await expect(requireOwnerWithProfile()).rejects.toBeInstanceOf(ForbiddenError);
  });

  it("allowSignUp is true only when the users table is empty", async () => {
    const { allowSignUp } = await import("@/domain/auth");
    expect(await allowSignUp()).toBe(true);
    await createUser();
    expect(await allowSignUp()).toBe(false);
  });

  it("clearSession removes the cookie", async () => {
    await setSession({ userId: "u", email: "e" });
    expect(cookieStore.size).toBe(1);
    await clearSession();
    expect(cookieStore.size).toBe(0);
  });
});
