import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db, schema } from "@/db";
import { setSession } from "@/lib/session";
import { sql } from "drizzle-orm";

// Test-only seed endpoint. Guarded by PERCH_TEST_MODE so it never runs in prod.
// Create a user (idempotent), optionally make a profile, and set a session cookie
// on the response. Used by Playwright E2E to skip the sign-up UI dance.
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type Body = {
  email?: string;
  password?: string;
  withProfile?: boolean;
  slug?: string;
  displayName?: string;
};

export async function POST(req: NextRequest) {
  if (process.env.PERCH_TEST_MODE !== "1") {
    return NextResponse.json({ error: "disabled" }, { status: 404 });
  }
  const body = (await req.json().catch(() => ({}))) as Body;
  const email = body.email ?? "owner@example.com";
  const password = body.password ?? "superSecret1";

  await db.execute(sql`TRUNCATE TABLE click_counts, socials, links, profiles, users RESTART IDENTITY CASCADE`);

  const hash = await bcrypt.hash(password, 4);
  const [user] = await db
    .insert(schema.users)
    .values({ email, passwordHash: hash })
    .returning();

  let profile: schema.Profile | null = null;
  if (body.withProfile) {
    const [p] = await db
      .insert(schema.profiles)
      .values({
        userId: user.id,
        slug: body.slug ?? "alex",
        displayName: body.displayName ?? "Alex Perch",
      })
      .returning();
    profile = p;
  }

  await setSession({ userId: user.id, email: user.email });

  return NextResponse.json({ userId: user.id, profileId: profile?.id ?? null });
}
