import { beforeEach, describe, it, expect } from "vitest";
import { truncateAll, createUser, createProfileFor } from "../helpers/db";
import { createLink } from "@/domain/links";
import { publishProfile } from "@/domain/publish";
import { recordClick, resolveLinkForRedirect, analyticsSummary } from "@/domain/clicks";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

beforeEach(async () => {
  await truncateAll();
});

describe("clicks", () => {
  it("recordClick upserts a daily count by referrer category", async () => {
    const user = await createUser();
    const profile = await createProfileFor(user.id);
    const link = await createLink(profile.id, { label: "Shop", href: "https://shop.example.com" });

    await recordClick(link.id, "https://instagram.com/alex");
    await recordClick(link.id, "https://instagram.com/alex");
    await recordClick(link.id, null);

    const rows = await db.select().from(schema.clickCounts).where(eq(schema.clickCounts.linkId, link.id));
    const bySrc = new Map(rows.map((r) => [r.referrerCategory, r.count]));
    expect(bySrc.get("social")).toBe(2);
    expect(bySrc.get("direct")).toBe(1);
  });

  it("resolveLinkForRedirect refuses an unpublished link", async () => {
    const user = await createUser();
    const profile = await createProfileFor(user.id);
    const link = await createLink(profile.id, { label: "x", href: "https://x.com" });
    const [row] = await db.select().from(schema.profiles).where(eq(schema.profiles.id, profile.id));
    const r = resolveLinkForRedirect(row, link.id);
    expect(r.ok).toBe(false);
  });

  it("resolveLinkForRedirect succeeds after publish and 404s a retired link", async () => {
    const user = await createUser();
    const profile = await createProfileFor(user.id);
    const link = await createLink(profile.id, { label: "x", href: "https://x.com" });
    await publishProfile(profile.id);
    const [row] = await db.select().from(schema.profiles).where(eq(schema.profiles.id, profile.id));
    const r = resolveLinkForRedirect(row, link.id);
    expect(r.ok).toBe(true);
    const bad = resolveLinkForRedirect(row, "00000000-0000-0000-0000-000000000000");
    expect(bad.ok).toBe(false);
  });

  it("analyticsSummary totals and ranks correctly", async () => {
    const user = await createUser();
    const profile = await createProfileFor(user.id);
    const a = await createLink(profile.id, { label: "A", href: "https://a.com" });
    const b = await createLink(profile.id, { label: "B", href: "https://b.com" });
    await publishProfile(profile.id);
    const [row] = await db.select().from(schema.profiles).where(eq(schema.profiles.id, profile.id));

    const today = new Date().toISOString().slice(0, 10);
    await db.insert(schema.clickCounts).values({
      linkId: a.id,
      day: today,
      referrerCategory: "direct",
      count: 5,
    });
    await db.insert(schema.clickCounts).values({
      linkId: b.id,
      day: today,
      referrerCategory: "social",
      count: 2,
    });

    const summary = await analyticsSummary(row);
    expect(summary.total7).toBe(7);
    expect(summary.perLink[0].label).toBe("A");
    expect(summary.perLink[0].count7).toBe(5);
    expect(summary.perLink[1].count7).toBe(2);
  });
});
