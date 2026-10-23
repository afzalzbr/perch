"use server";

import { redirect } from "next/navigation";
import { requireOwner } from "@/domain/auth";
import { createInitialProfile } from "@/domain/profile";
import { ValidationError } from "@/lib/errors";

export type SetupState = { fieldErrors?: Record<string, string>; message?: string };

export async function createProfileAction(_prev: SetupState, formData: FormData): Promise<SetupState> {
  const ctx = await requireOwner();
  if (ctx.profile) redirect("/dashboard");
  try {
    await createInitialProfile(ctx.user.id, {
      slug: String(formData.get("slug") ?? ""),
      displayName: String(formData.get("displayName") ?? ""),
    });
  } catch (err) {
    if (err instanceof ValidationError) {
      const slug = err.fieldErrors.slug ?? (err.message.toLowerCase().includes("slug") ? err.message : undefined);
      const name =
        err.fieldErrors["Display name"] ??
        err.fieldErrors.displayName ??
        (err.message.toLowerCase().includes("display name") ? err.message : undefined);
      return { fieldErrors: { ...(slug ? { slug } : {}), ...(name ? { displayName: name } : {}) }, message: err.message };
    }
    throw err;
  }
  redirect("/dashboard/profile");
}
