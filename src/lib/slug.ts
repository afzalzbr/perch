// Reserved slugs cannot be claimed by a creator.
export const RESERVED_SLUGS = new Set([
  "about",
  "admin",
  "analytics",
  "api",
  "assets",
  "auth",
  "contact",
  "dashboard",
  "editor",
  "go",
  "help",
  "login",
  "logout",
  "legal",
  "privacy",
  "profile",
  "settings",
  "setup",
  "sign-in",
  "sign-out",
  "sign-up",
  "signin",
  "signout",
  "signup",
  "static",
  "support",
  "terms",
  "uploads",
  "www",
]);

const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;

export function validateSlug(input: string): string {
  const raw = (input ?? "").trim().toLowerCase();
  if (!raw) throw new Error("Pick a slug for your page.");
  if (raw.length < 3) throw new Error("Slugs are at least 3 characters.");
  if (raw.length > 32) throw new Error("Slugs are at most 32 characters.");
  if (!SLUG_RE.test(raw)) {
    throw new Error("Use lowercase letters, numbers, and hyphens. No leading or trailing hyphen.");
  }
  if (RESERVED_SLUGS.has(raw)) {
    throw new Error("That slug is reserved — try another.");
  }
  if (raw.includes("--")) {
    throw new Error("Slugs can't contain two hyphens in a row.");
  }
  return raw;
}
