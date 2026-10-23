"use server";

import { redirect } from "next/navigation";
import { ForbiddenError, ValidationError } from "@/lib/errors";
import { signInOwner, signUpOwner, signOutOwner, allowSignUp } from "@/domain/auth";
import { hitRateLimit } from "@/lib/rate-limit";
import { headers } from "next/headers";
import { log } from "@/lib/logger";

export type SignInState = { ok?: boolean; fieldErrors?: Record<string, string>; message?: string };

async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "local";
}

export async function signInAction(
  _prev: SignInState,
  formData: FormData
): Promise<SignInState> {
  const ip = await clientIp();
  const bucket = hitRateLimit(`signin:${ip}`, { capacity: 5, refillPerSecond: 0.1 });
  if (!bucket.ok) {
    return { message: `Too many attempts. Try again in ${bucket.retryAfter}s.` };
  }
  const email = formData.get("email");
  const password = formData.get("password");
  try {
    await signInOwner(String(email ?? ""), String(password ?? ""));
  } catch (err) {
    if (err instanceof ValidationError) {
      log("warn", "sign_in_failed", { ip, email: String(email).slice(0, 48) });
      return { fieldErrors: err.fieldErrors, message: err.message };
    }
    throw err;
  }
  redirect("/");
}

export async function signUpAction(
  _prev: SignInState,
  formData: FormData
): Promise<SignInState> {
  if (!(await allowSignUp())) {
    return { message: "Sign-up is closed — this Perch already has a creator." };
  }
  const email = formData.get("email");
  const password = formData.get("password");
  try {
    await signUpOwner(String(email ?? ""), String(password ?? ""));
  } catch (err) {
    if (err instanceof ValidationError) return { fieldErrors: err.fieldErrors, message: err.message };
    if (err instanceof ForbiddenError) return { message: err.message };
    throw err;
  }
  redirect("/setup");
}

export async function signOutAction(): Promise<void> {
  await signOutOwner();
  redirect("/sign-in");
}
