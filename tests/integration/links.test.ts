import { beforeEach, describe, it, expect } from "vitest";
import { truncateAll, createUser, createProfileFor } from "../helpers/db";
import {
  createLink,
  deleteLink,
  listLinks,
  moveLink,
  reorderLinks,
  updateLink,
} from "@/domain/links";
import { ValidationError } from "@/lib/errors";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

beforeEach(async () => {
  await truncateAll();
});

async function seed() {
  const user = await createUser();
  const profile = await createProfileFor(user.id);
  const a = await createLink(profile.id, { label: "A", href: "https://a.com" });
  const b = await createLink(profile.id, { label: "B", href: "https://b.com" });
  const c = await createLink(profile.id, { label: "C", href: "https://c.com" });
  return { profile, a, b, c };
}

describe("links", () => {
  it("creates links in order", async () => {
    const { profile } = await seed();
    const got = await listLinks(profile.id);
    expect(got.map((l) => l.label)).toEqual(["A", "B", "C"]);
    expect(got.map((l) => l.position)).toEqual([0, 1, 2]);
  });

  it("reorderLinks is atomic — all positions update together", async () => {
    const { profile, a, b, c } = await seed();
    await reorderLinks(profile.id, [c.id, a.id, b.id]);
    const got = await listLinks(profile.id);
    expect(got.map((l) => l.label)).toEqual(["C", "A", "B"]);
    expect(new Set(got.map((l) => l.position))).toEqual(new Set([0, 1, 2]));
  });

  it("moveLink moves a link up without a gap", async () => {
    const { profile, c } = await seed();
    await moveLink(profile.id, c.id, "up");
    const got = await listLinks(profile.id);
    expect(got.map((l) => l.label)).toEqual(["A", "C", "B"]);
  });

  it("deleteLink compacts remaining positions", async () => {
    const { profile, b } = await seed();
    await deleteLink(profile.id, b.id);
    const got = await listLinks(profile.id);
    expect(got.map((l) => l.label)).toEqual(["A", "C"]);
    expect(got.map((l) => l.position)).toEqual([0, 1]);
  });

  it("duplicate hrefs are allowed but normalized consistently", async () => {
    const user = await createUser("other@example.com");
    const profile = await createProfileFor(user.id);
    const a = await createLink(profile.id, { label: "a", href: "https://example.com" });
    const b = await createLink(profile.id, { label: "b", href: "https://example.com/" });
    expect(a.href).toBe(b.href);
  });

  it("rejects a second featured link", async () => {
    const user = await createUser();
    const profile = await createProfileFor(user.id);
    await createLink(profile.id, { label: "A", href: "https://a.com", highlight: true });
    await expect(
      createLink(profile.id, { label: "B", href: "https://b.com", highlight: true })
    ).rejects.toBeInstanceOf(ValidationError);
  });

  it("updateLink validates URLs and persists", async () => {
    const { profile, a } = await seed();
    const updated = await updateLink(profile.id, a.id, {
      label: "A2",
      href: "https://a2.com",
    });
    expect(updated.label).toBe("A2");
    expect(updated.href).toBe("https://a2.com/");
    await expect(
      updateLink(profile.id, a.id, { label: "A", href: "javascript:alert(1)" })
    ).rejects.toThrow();
  });

  it("deleting a link leaves click_counts rows alone", async () => {
    const { profile, a } = await seed();
    await db.insert(schema.clickCounts).values({
      linkId: a.id,
      day: new Date().toISOString().slice(0, 10),
      referrerCategory: "direct",
      count: 7,
    });
    await deleteLink(profile.id, a.id);
    const rows = await db.select().from(schema.clickCounts).where(eq(schema.clickCounts.linkId, a.id));
    expect(rows.length).toBe(1);
    expect(rows[0].count).toBe(7);
  });
});
