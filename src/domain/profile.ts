import { and, asc, eq, sql } from "drizzle-orm";
import { db, schema } from "@/db";
import { normalizeLinkUrl, normalizeSocialUrl } from "@/lib/normalize-url";
import { validateSlug } from "@/lib/slug";
import { ValidationError } from "@/lib/errors";

export const SUPPORTED_THEMES: schema.Theme[] = ["daylight", "dusk", "paper"];
export const SUPPORTED_SOCIAL_KINDS: schema.SocialKind[] = [
  "instagram",
  "youtube",
  "tiktok",
  "x",
  "github",
  "linkedin",
  "website",
];

function requireString(value: unknown, field: string, { max }: { max: number }): string {
  if (typeof value !== "string") throw new ValidationError(`${field} is required.`, { [field]: "Required." });
  const trimmed = value.trim();
  if (!trimmed) throw new ValidationError(`${field} is required.`, { [field]: "Required." });
  if (trimmed.length > max) throw new ValidationError(`${field} is too long.`, { [field]: `${max} characters max.` });
  return trimmed;
}

function optionalString(value: unknown, max: number): string {
  if (value === null || value === undefined) return "";
  if (typeof value !== "string") return "";
  const t = value.trim();
  if (t.length > max) throw new ValidationError("Too long.");
  return t;
}

export async function createInitialProfile(
  userId: string,
  input: { slug: string; displayName: string }
): Promise<schema.Profile> {
  const slug = validateSlug(input.slug);
  const displayName = requireString(input.displayName, "Display name", { max: 60 });

  try {
    const [created] = await db
      .insert(schema.profiles)
      .values({
        userId,
        slug,
        displayName,
        theme: "daylight",
      })
      .returning();
    return created;
  } catch (err: unknown) {
    const message = (err as { message?: string }).message ?? "";
    if (message.includes("profiles_singleton")) {
      throw new ValidationError("A Perch profile already exists on this instance.");
    }
    if (message.includes("profiles_slug_lower_uniq")) {
      throw new ValidationError("That slug is already taken.", { slug: "Already taken." });
    }
    throw err;
  }
}

export async function updateProfile(
  profileId: string,
  input: { displayName: string; bio: string; theme: string; avatarKey?: string | null }
): Promise<void> {
  const displayName = requireString(input.displayName, "Display name", { max: 60 });
  const bio = optionalString(input.bio, 160);
  if (!SUPPORTED_THEMES.includes(input.theme as schema.Theme)) {
    throw new ValidationError("Pick a theme.", { theme: "Pick a theme." });
  }
  const update: Partial<schema.Profile> = {
    displayName,
    bio,
    theme: input.theme as schema.Theme,
    draftUpdatedAt: new Date(),
    updatedAt: new Date(),
  };
  if (input.avatarKey !== undefined) update.draftAvatarKey = input.avatarKey;
  await db.update(schema.profiles).set(update).where(eq(schema.profiles.id, profileId));
}

export async function setAvatarKey(profileId: string, key: string | null): Promise<void> {
  await db
    .update(schema.profiles)
    .set({ draftAvatarKey: key, draftUpdatedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.profiles.id, profileId));
}

/* ---- Socials ---- */

export async function listSocials(profileId: string): Promise<schema.Social[]> {
  return db
    .select()
    .from(schema.socials)
    .where(eq(schema.socials.profileId, profileId))
    .orderBy(asc(schema.socials.position));
}

export async function upsertSocial(
  profileId: string,
  input: { kind: string; handle: string; href: string }
): Promise<schema.Social> {
  if (!SUPPORTED_SOCIAL_KINDS.includes(input.kind as schema.SocialKind)) {
    throw new ValidationError("That platform isn't supported.", { kind: "Unsupported." });
  }
  const kind = input.kind as schema.SocialKind;
  const handle = requireString(input.handle, "Handle", { max: 60 });
  let normalized;
  try {
    normalized = normalizeSocialUrl(kind, input.href);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ValidationError(message, { href: message });
  }

  const existing = await db
    .select()
    .from(schema.socials)
    .where(and(eq(schema.socials.profileId, profileId), eq(schema.socials.kind, kind)))
    .limit(1);

  if (existing[0]) {
    const [row] = await db
      .update(schema.socials)
      .set({ handle, href: normalized.href })
      .where(eq(schema.socials.id, existing[0].id))
      .returning();
    await bumpDraftTs(profileId);
    return row;
  }
  const nextPos = await nextSocialPosition(profileId);
  const [row] = await db
    .insert(schema.socials)
    .values({ profileId, kind, handle, href: normalized.href, position: nextPos })
    .returning();
  await bumpDraftTs(profileId);
  return row;
}

export async function deleteSocial(profileId: string, socialId: string): Promise<void> {
  await db
    .delete(schema.socials)
    .where(and(eq(schema.socials.id, socialId), eq(schema.socials.profileId, profileId)));
  await bumpDraftTs(profileId);
}

async function nextSocialPosition(profileId: string): Promise<number> {
  const [{ max }] = await db
    .select({ max: sql<number>`coalesce(max(${schema.socials.position}), -1)` })
    .from(schema.socials)
    .where(eq(schema.socials.profileId, profileId));
  return (max ?? -1) + 1;
}

async function bumpDraftTs(profileId: string): Promise<void> {
  await db
    .update(schema.profiles)
    .set({ draftUpdatedAt: new Date(), updatedAt: new Date() })
    .where(eq(schema.profiles.id, profileId));
}

/* ---- Public URL ---- */

export function publicUrlFor(slug: string): string {
  const origin = process.env.PERCH_PUBLIC_ORIGIN ?? "http://localhost:3000";
  return `${origin.replace(/\/+$/, "")}/${slug}`;
}

/* ---- Normalization helper exposed to actions ---- */

export function normalizeLink(input: { label: string; href: string; description?: string }) {
  const label = requireString(input.label, "Label", { max: 60 });
  const description = optionalString(input.description, 120) || null;
  let url;
  try {
    url = normalizeLinkUrl(input.href);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new ValidationError(message, { href: message });
  }
  return { label, href: url.href, description };
}
