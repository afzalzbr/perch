import { asc, eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { ValidationError } from "@/lib/errors";

export async function assembleSnapshot(profileId: string): Promise<schema.PublishedSnapshot> {
  return db.transaction(async (tx) => {
    const [profile] = await tx
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.id, profileId))
      .limit(1);
    if (!profile) throw new ValidationError("Profile not found.");

    const links = await tx
      .select()
      .from(schema.links)
      .where(eq(schema.links.profileId, profileId))
      .orderBy(asc(schema.links.position));
    const socials = await tx
      .select()
      .from(schema.socials)
      .where(eq(schema.socials.profileId, profileId))
      .orderBy(asc(schema.socials.position));

    const highlightCount = links.filter((l) => l.highlight).length;
    if (highlightCount > 1) {
      throw new ValidationError(
        "Only one featured link is allowed per page. Remove the extra before publishing."
      );
    }
    if (links.length === 0) {
      throw new ValidationError("Add at least one link before publishing.");
    }

    const nextVersion = profile.publishedVersion + 1;

    const snapshot: schema.PublishedSnapshot = {
      version: nextVersion,
      publishedAt: new Date().toISOString(),
      slug: profile.slug.toLowerCase(),
      displayName: profile.displayName,
      bio: profile.bio,
      theme: profile.theme,
      avatarKey: profile.draftAvatarKey,
      links: links.map((l) => ({
        id: l.id,
        label: l.label,
        href: l.href,
        description: l.description,
        highlight: l.highlight,
      })),
      socials: socials.map((s) => ({ kind: s.kind, handle: s.handle, href: s.href })),
    };
    return snapshot;
  });
}

export async function publishProfile(profileId: string): Promise<schema.PublishedSnapshot> {
  const snapshot = await assembleSnapshot(profileId);
  const publishedAt = new Date(snapshot.publishedAt);
  await db
    .update(schema.profiles)
    .set({
      publishedSnapshot: snapshot,
      publishedAt,
      publishedVersion: snapshot.version,
      updatedAt: publishedAt,
    })
    .where(eq(schema.profiles.id, profileId));
  return snapshot;
}

export function isDraftAhead(profile: schema.Profile): boolean {
  if (!profile.publishedSnapshot) return true;
  if (!profile.publishedAt) return true;
  return profile.draftUpdatedAt.getTime() > profile.publishedAt.getTime() + 500;
}

export async function discardDraft(profileId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [profile] = await tx
      .select()
      .from(schema.profiles)
      .where(eq(schema.profiles.id, profileId))
      .limit(1);
    if (!profile) throw new ValidationError("Profile not found.");
    if (!profile.publishedSnapshot) {
      throw new ValidationError("Nothing to revert to — your page has never been published.");
    }
    const snap = profile.publishedSnapshot;

    await tx
      .update(schema.profiles)
      .set({
        displayName: snap.displayName,
        bio: snap.bio,
        theme: snap.theme,
        draftAvatarKey: snap.avatarKey,
        draftUpdatedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(schema.profiles.id, profileId));

    await tx.delete(schema.links).where(eq(schema.links.profileId, profileId));
    for (let i = 0; i < snap.links.length; i++) {
      const l = snap.links[i];
      await tx.insert(schema.links).values({
        id: l.id,
        profileId,
        label: l.label,
        href: l.href,
        description: l.description,
        highlight: l.highlight,
        position: i,
      });
    }

    await tx.delete(schema.socials).where(eq(schema.socials.profileId, profileId));
    for (let i = 0; i < snap.socials.length; i++) {
      const s = snap.socials[i];
      await tx.insert(schema.socials).values({
        profileId,
        kind: s.kind,
        handle: s.handle,
        href: s.href,
        position: i,
      });
    }
  });
}
