import { and, asc, eq, sql, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { ValidationError } from "@/lib/errors";
import { normalizeLink } from "./profile";

export async function listLinks(profileId: string): Promise<schema.Link[]> {
  return db
    .select()
    .from(schema.links)
    .where(eq(schema.links.profileId, profileId))
    .orderBy(asc(schema.links.position));
}

export async function createLink(
  profileId: string,
  input: { label: string; href: string; description?: string; highlight?: boolean }
): Promise<schema.Link> {
  const norm = normalizeLink(input);
  const highlight = !!input.highlight;
  if (highlight) {
    await assertAtMostOneHighlight(profileId, null);
  }
  const nextPos = await nextPosition(profileId);
  const [created] = await db
    .insert(schema.links)
    .values({
      profileId,
      label: norm.label,
      href: norm.href,
      description: norm.description,
      highlight,
      position: nextPos,
    })
    .returning();
  await bumpDraftTs(profileId);
  return created;
}

export async function updateLink(
  profileId: string,
  linkId: string,
  input: { label: string; href: string; description?: string; highlight?: boolean }
): Promise<schema.Link> {
  const norm = normalizeLink(input);
  const highlight = !!input.highlight;
  if (highlight) {
    await assertAtMostOneHighlight(profileId, linkId);
  }
  const [row] = await db
    .update(schema.links)
    .set({
      label: norm.label,
      href: norm.href,
      description: norm.description,
      highlight,
      updatedAt: new Date(),
    })
    .where(and(eq(schema.links.id, linkId), eq(schema.links.profileId, profileId)))
    .returning();
  if (!row) throw new ValidationError("Link not found.");
  await bumpDraftTs(profileId);
  return row;
}

export async function deleteLink(profileId: string, linkId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [removed] = await tx
      .delete(schema.links)
      .where(and(eq(schema.links.id, linkId), eq(schema.links.profileId, profileId)))
      .returning({ position: schema.links.position });
    if (!removed) return;
    // Compact positions after the hole.
    await tx.execute(sql`
      UPDATE links
      SET position = position - 1
      WHERE profile_id = ${profileId} AND position > ${removed.position}
    `);
  });
  await bumpDraftTs(profileId);
}

export async function reorderLinks(profileId: string, orderedIds: string[]): Promise<void> {
  if (!Array.isArray(orderedIds) || orderedIds.length === 0) return;
  if (new Set(orderedIds).size !== orderedIds.length) {
    throw new ValidationError("Duplicate link in reorder.");
  }
  await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: schema.links.id })
      .from(schema.links)
      .where(and(eq(schema.links.profileId, profileId), inArray(schema.links.id, orderedIds)));
    if (existing.length !== orderedIds.length) {
      throw new ValidationError("Reorder refers to a link that isn't in this draft.");
    }

    // Defer the (profile_id, position) uniqueness constraint until commit so
    // in-flight swaps don't collide.
    await tx.execute(sql`SET CONSTRAINTS links_profile_position_uniq DEFERRED`);

    for (let i = 0; i < orderedIds.length; i++) {
      await tx
        .update(schema.links)
        .set({ position: i, updatedAt: new Date() })
        .where(and(eq(schema.links.id, orderedIds[i]), eq(schema.links.profileId, profileId)));
    }
  });
  await bumpDraftTs(profileId);
}

export async function moveLink(
  profileId: string,
  linkId: string,
  direction: "up" | "down"
): Promise<void> {
  const links = await listLinks(profileId);
  const idx = links.findIndex((l) => l.id === linkId);
  if (idx < 0) throw new ValidationError("Link not found.");
  const target = direction === "up" ? idx - 1 : idx + 1;
  if (target < 0 || target >= links.length) return;
  const reordered = links.map((l) => l.id);
  [reordered[idx], reordered[target]] = [reordered[target], reordered[idx]];
  await reorderLinks(profileId, reordered);
}

async function nextPosition(profileId: string): Promise<number> {
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${schema.links.position}), -1)` })
    .from(schema.links)
    .where(eq(schema.links.profileId, profileId));
  return (max ?? -1) + 1;
}

async function assertAtMostOneHighlight(profileId: string, excludeLinkId: string | null): Promise<void> {
  const rows = await db
    .select({ id: schema.links.id })
    .from(schema.links)
    .where(and(eq(schema.links.profileId, profileId), eq(schema.links.highlight, true)));
  const others = excludeLinkId ? rows.filter((r) => r.id !== excludeLinkId) : rows;
  if (others.length >= 1) {
    throw new ValidationError(
      "Only one featured link is allowed per page. Remove the other featured link first.",
      { highlight: "Only one featured link allowed." }
    );
  }
}

async function bumpDraftTs(profileId: string): Promise<void> {
  await db
    .update(schema.profiles)
    .set({ draftUpdatedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.profiles.id, profileId));
}
