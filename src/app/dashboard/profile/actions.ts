"use server";

import { revalidatePath } from "next/cache";
import { requireOwnerWithProfile } from "@/domain/auth";
import {
  updateProfile,
  upsertSocial,
  deleteSocial,
  SUPPORTED_SOCIAL_KINDS,
} from "@/domain/profile";
import {
  createLink,
  updateLink,
  deleteLink,
  moveLink,
  reorderLinks,
} from "@/domain/links";
import { publishProfile, discardDraft } from "@/domain/publish";
import { getStorage, allowedAvatarType, buildAvatarKey, AVATAR_MAX_BYTES } from "@/lib/storage";
import { ValidationError } from "@/lib/errors";
import { setAvatarKey } from "@/domain/profile";
import { log } from "@/lib/logger";

export type ActionResult =
  | { ok: true; flash?: string }
  | { ok: false; message: string; fieldErrors?: Record<string, string>; flash?: string };

function fail(err: unknown): ActionResult {
  if (err instanceof ValidationError) {
    return { ok: false, message: err.message, fieldErrors: err.fieldErrors };
  }
  log("error", "action_failed", { error: String(err) });
  return { ok: false, message: "Something went wrong — try again." };
}

function invalidate(slug: string) {
  revalidatePath("/dashboard");
  revalidatePath("/dashboard/profile");
  revalidatePath("/dashboard/analytics");
  revalidatePath(`/${slug}`);
}

export async function updateProfileAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { profile } = await requireOwnerWithProfile();
  try {
    await updateProfile(profile.id, {
      displayName: String(formData.get("displayName") ?? ""),
      bio: String(formData.get("bio") ?? ""),
      theme: String(formData.get("theme") ?? "daylight"),
    });
  } catch (err) {
    return fail(err);
  }
  invalidate(profile.slug);
  return { ok: true, flash: "Saved to draft." };
}

export async function createLinkAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { profile } = await requireOwnerWithProfile();
  try {
    await createLink(profile.id, {
      label: String(formData.get("label") ?? ""),
      href: String(formData.get("href") ?? ""),
      description: String(formData.get("description") ?? "") || undefined,
      highlight: formData.get("highlight") === "on",
    });
  } catch (err) {
    return fail(err);
  }
  invalidate(profile.slug);
  return { ok: true, flash: "Link added to draft." };
}

export async function updateLinkAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { profile } = await requireOwnerWithProfile();
  const linkId = String(formData.get("linkId") ?? "");
  if (!linkId) return { ok: false, message: "Missing link." };
  try {
    await updateLink(profile.id, linkId, {
      label: String(formData.get("label") ?? ""),
      href: String(formData.get("href") ?? ""),
      description: String(formData.get("description") ?? "") || undefined,
      highlight: formData.get("highlight") === "on",
    });
  } catch (err) {
    return fail(err);
  }
  invalidate(profile.slug);
  return { ok: true, flash: "Link updated." };
}

export async function deleteLinkAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { profile } = await requireOwnerWithProfile();
  const linkId = String(formData.get("linkId") ?? "");
  if (!linkId) return { ok: false, message: "Missing link." };
  try {
    await deleteLink(profile.id, linkId);
  } catch (err) {
    return fail(err);
  }
  invalidate(profile.slug);
  return { ok: true, flash: "Link removed from draft." };
}

export async function moveLinkAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { profile } = await requireOwnerWithProfile();
  const linkId = String(formData.get("linkId") ?? "");
  const direction = String(formData.get("direction") ?? "down");
  if (!linkId) return { ok: false, message: "Missing link." };
  try {
    await moveLink(profile.id, linkId, direction === "up" ? "up" : "down");
  } catch (err) {
    return fail(err);
  }
  invalidate(profile.slug);
  return { ok: true };
}

export async function reorderLinksAction(ids: string[]): Promise<ActionResult> {
  const { profile } = await requireOwnerWithProfile();
  try {
    await reorderLinks(profile.id, ids);
  } catch (err) {
    return fail(err);
  }
  invalidate(profile.slug);
  return { ok: true };
}

export async function upsertSocialAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { profile } = await requireOwnerWithProfile();
  const kind = String(formData.get("kind") ?? "");
  if (!SUPPORTED_SOCIAL_KINDS.includes(kind as never)) {
    return { ok: false, message: "That platform isn't supported." };
  }
  try {
    await upsertSocial(profile.id, {
      kind,
      handle: String(formData.get("handle") ?? ""),
      href: String(formData.get("href") ?? ""),
    });
  } catch (err) {
    return fail(err);
  }
  invalidate(profile.slug);
  return { ok: true, flash: "Social link saved." };
}

export async function deleteSocialAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { profile } = await requireOwnerWithProfile();
  const id = String(formData.get("socialId") ?? "");
  if (!id) return { ok: false, message: "Missing social." };
  try {
    await deleteSocial(profile.id, id);
  } catch (err) {
    return fail(err);
  }
  invalidate(profile.slug);
  return { ok: true, flash: "Removed." };
}

export async function publishAction(_prev: ActionResult, _formData: FormData): Promise<ActionResult> {
  const { profile } = await requireOwnerWithProfile();
  try {
    const snap = await publishProfile(profile.id);
    log("info", "profile_published", { slug: snap.slug, version: snap.version });
  } catch (err) {
    return fail(err);
  }
  invalidate(profile.slug);
  return { ok: true, flash: "Published." };
}

export async function discardDraftAction(_prev: ActionResult, _formData: FormData): Promise<ActionResult> {
  const { profile } = await requireOwnerWithProfile();
  try {
    await discardDraft(profile.id);
  } catch (err) {
    return fail(err);
  }
  invalidate(profile.slug);
  return { ok: true, flash: "Reverted to the published version." };
}

export async function uploadAvatarAction(_prev: ActionResult, formData: FormData): Promise<ActionResult> {
  const { profile } = await requireOwnerWithProfile();
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Pick an image first." };
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { ok: false, message: `Images must be under ${Math.round(AVATAR_MAX_BYTES / 1024 / 1024)} MB.` };
  }
  if (!allowedAvatarType(file.type)) {
    return { ok: false, message: "Use a PNG, JPEG, WEBP, or GIF." };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const key = buildAvatarKey(profile.id, file.type);
  await getStorage().put(key, buffer, { contentType: file.type });
  await setAvatarKey(profile.id, key);
  invalidate(profile.slug);
  return { ok: true, flash: "Avatar updated in draft." };
}

export async function removeAvatarAction(_prev: ActionResult, _formData: FormData): Promise<ActionResult> {
  const { profile } = await requireOwnerWithProfile();
  if (profile.draftAvatarKey) {
    await getStorage().delete(profile.draftAvatarKey).catch(() => {});
  }
  await setAvatarKey(profile.id, null);
  invalidate(profile.slug);
  return { ok: true, flash: "Removed." };
}
