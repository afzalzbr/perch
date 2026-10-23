import { beforeEach, describe, it, expect } from "vitest";
import { truncateAll, createUser, createProfileFor } from "../helpers/db";
import { createLink } from "@/domain/links";
import { publishProfile, assembleSnapshot, isDraftAhead } from "@/domain/publish";
import { ValidationError } from "@/lib/errors";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

beforeEach(async () => {
  await truncateAll();
});

describe("publish", () => {
  it("refuses to publish with zero links", async () => {
    const user = await createUser();
    const profile = await createProfileFor(user.id);
    await expect(publishProfile(profile.id)).rejects.toBeInstanceOf(ValidationError);
  });

  it("refuses to publish with more than one featured link", async () => {
    const user = await createUser();
    const profile = await createProfileFor(user.id);
    await createLink(profile.id, { label: "A", href: "https://a.com", highlight: true });
    // Direct DB insert to bypass the per-link guard — reproduces the server-side gate.
    await db.insert(schema.links).values({
      profileId: profile.id,
      label: "B",
      href: "https://b.com",
      highlight: true,
      position: 1,
    });
    await expect(assembleSnapshot(profile.id)).rejects.toBeInstanceOf(ValidationError);
  });

  it("publishes a draft and bumps the version", async () => {
    const user = await createUser();
    const profile = await createProfileFor(user.id);
    await createLink(profile.id, { label: "Site", href: "https://example.com" });
    const snap = await publishProfile(profile.id);
    expect(snap.version).toBe(1);
    expect(snap.links.length).toBe(1);

    const [row] = await db.select().from(schema.profiles).where(eq(schema.profiles.id, profile.id));
    expect(row.publishedVersion).toBe(1);
    expect(row.publishedSnapshot?.slug).toBe("alex");
  });

  it("isDraftAhead returns true when draft was edited after publish", async () => {
    const user = await createUser();
    const profile = await createProfileFor(user.id);
    await createLink(profile.id, { label: "A", href: "https://a.com" });
    await publishProfile(profile.id);
    const [row] = await db.select().from(schema.profiles).where(eq(schema.profiles.id, profile.id));
    expect(isDraftAhead(row)).toBe(false);

    await db
      .update(schema.profiles)
      .set({ draftUpdatedAt: new Date(Date.now() + 10_000) })
      .where(eq(schema.profiles.id, profile.id));
    const [row2] = await db.select().from(schema.profiles).where(eq(schema.profiles.id, profile.id));
    expect(isDraftAhead(row2)).toBe(true);
  });

  it("published public page is unaffected by draft edits until re-publish", async () => {
    const user = await createUser();
    const profile = await createProfileFor(user.id);
    const link = await createLink(profile.id, { label: "Shop", href: "https://shop.example.com" });
    const first = await publishProfile(profile.id);
    expect(first.links[0].href).toBe("https://shop.example.com/");

    // Edit the draft row directly: the published snapshot must not change.
    await db
      .update(schema.links)
      .set({ href: "https://new.example.com/" })
      .where(eq(schema.links.id, link.id));

    const [row] = await db.select().from(schema.profiles).where(eq(schema.profiles.id, profile.id));
    expect(row.publishedSnapshot!.links[0].href).toBe("https://shop.example.com/");
  });
});
