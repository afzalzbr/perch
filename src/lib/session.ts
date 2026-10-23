import { createHmac, timingSafeEqual, randomBytes } from "node:crypto";
import { cookies } from "next/headers";

const COOKIE_NAME = "perch_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

export type Session = { userId: string; email: string };

function secret(): Buffer {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters.");
  }
  return Buffer.from(s, "utf8");
}

function encode(payload: Session): string {
  const header = Buffer.from(
    JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS })
  ).toString("base64url");
  const sig = createHmac("sha256", secret()).update(header).digest("base64url");
  return `${header}.${sig}`;
}

function decode(cookie: string | undefined): Session | null {
  if (!cookie) return null;
  const [header, sig] = cookie.split(".");
  if (!header || !sig) return null;
  const expected = createHmac("sha256", secret()).update(header).digest("base64url");
  if (expected.length !== sig.length) return null;
  try {
    if (!timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  } catch {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(header, "base64url").toString("utf8")) as Session & {
      exp: number;
    };
    if (parsed.exp && parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return { userId: parsed.userId, email: parsed.email };
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const jar = await cookies();
  return decode(jar.get(COOKIE_NAME)?.value);
}

function cookieSecure(): boolean {
  // Only mark the cookie Secure when actually served over HTTPS. In production
  // deployments, PERCH_PUBLIC_ORIGIN should be https://… — in local or Playwright
  // runs it's http://localhost, where Secure would prevent the browser from
  // ever sending the cookie back.
  const origin = process.env.PERCH_PUBLIC_ORIGIN ?? "";
  return origin.startsWith("https://");
}

export async function setSession(session: Session): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, encode(session), {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSession(): Promise<void> {
  const jar = await cookies();
  jar.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
}

/* ---- CSRF token (for route handlers that take state-changing POSTs) ---- */

const CSRF_COOKIE = "perch_csrf";

export async function csrfToken(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(CSRF_COOKIE)?.value;
  if (existing) return existing;
  const token = randomBytes(24).toString("base64url");
  jar.set(CSRF_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: cookieSecure(),
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
  return token;
}

export async function verifyCsrf(token: string | null | undefined): Promise<boolean> {
  if (!token) return false;
  const jar = await cookies();
  const stored = jar.get(CSRF_COOKIE)?.value;
  if (!stored) return false;
  if (stored.length !== token.length) return false;
  try {
    return timingSafeEqual(Buffer.from(stored), Buffer.from(token));
  } catch {
    return false;
  }
}
