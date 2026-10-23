import bcrypt from "bcryptjs";
import { db, schema } from "@/db";
import { ForbiddenError, UnauthorizedError, ValidationError } from "@/lib/errors";
import { getSession, setSession, clearSession, type Session } from "@/lib/session";
import { eq, sql } from "drizzle-orm";

export async function requireSession(): Promise<Session> {
  const s = await getSession();
  if (!s) throw new UnauthorizedError();
  return s;
}

export type OwnerContext = {
  session: Session;
  user: schema.User;
  profile: schema.Profile | null;
};

/** Loads the session user and (optionally) their profile; throws if not signed in. */
export async function requireOwner(): Promise<OwnerContext> {
  const session = await requireSession();
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.id, session.userId))
    .limit(1);
  if (!user) {
    await clearSession();
    throw new UnauthorizedError();
  }
  const [profile] = await db
    .select()
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, user.id))
    .limit(1);
  return { session, user, profile: profile ?? null };
}

/** Loads the owner context and asserts the profile exists. */
export async function requireOwnerWithProfile(): Promise<OwnerContext & { profile: schema.Profile }> {
  const ctx = await requireOwner();
  if (!ctx.profile) {
    throw new ForbiddenError("Profile is not set up yet.");
  }
  return ctx as OwnerContext & { profile: schema.Profile };
}

/** v1 is single-creator; sign-up is only allowed when there are zero users yet. */
export async function allowSignUp(): Promise<boolean> {
  const [{ count }] = await db
    .select({ count: sql<number>`cast(count(*) as integer)` })
    .from(schema.users);
  return (count ?? 0) === 0;
}

/* ---- Credential helpers ---- */

const BCRYPT_ROUNDS = 12;

function requireEmail(email: unknown): string {
  if (typeof email !== "string") throw new ValidationError("Email is required.", { email: "Email is required." });
  const trimmed = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(trimmed)) {
    throw new ValidationError("That doesn't look like an email.", { email: "That doesn't look like an email." });
  }
  if (trimmed.length > 254) {
    throw new ValidationError("Email is too long.", { email: "Email is too long." });
  }
  return trimmed;
}

function requirePassword(password: unknown): string {
  if (typeof password !== "string" || password.length < 8) {
    throw new ValidationError("Password must be at least 8 characters.", { password: "At least 8 characters." });
  }
  if (password.length > 200) {
    throw new ValidationError("Password is too long.", { password: "Too long." });
  }
  return password;
}

export async function signUpOwner(email: string, password: string): Promise<Session> {
  if (!(await allowSignUp())) {
    throw new ForbiddenError("Sign-up is closed. Perch is single-creator.");
  }
  const normEmail = requireEmail(email);
  const pw = requirePassword(password);
  const hash = await bcrypt.hash(pw, BCRYPT_ROUNDS);
  const [created] = await db
    .insert(schema.users)
    .values({ email: normEmail, passwordHash: hash })
    .returning();
  const session: Session = { userId: created.id, email: created.email };
  await setSession(session);
  return session;
}

export async function signInOwner(email: string, password: string): Promise<Session> {
  const normEmail = requireEmail(email);
  const pw = requirePassword(password);
  const [user] = await db
    .select()
    .from(schema.users)
    .where(sql`lower(${schema.users.email}) = ${normEmail}`)
    .limit(1);
  // Constant-time-ish: do a bcrypt compare even on miss to not leak existence.
  const hash = user?.passwordHash ?? "$2a$12$0000000000000000000000.0000000000000000000000000000000";
  const ok = await bcrypt.compare(pw, hash);
  if (!user || !ok) {
    throw new ValidationError("Email or password doesn't match.", {
      email: " ",
      password: "That didn't match.",
    });
  }
  const session: Session = { userId: user.id, email: user.email };
  await setSession(session);
  return session;
}

export async function signOutOwner(): Promise<void> {
  await clearSession();
}
