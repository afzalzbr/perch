import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/db";
import { and, eq, sql } from "drizzle-orm";
import { resolveLinkForRedirect, recordClick } from "@/domain/clicks";
import { hitRateLimit } from "@/lib/rate-limit";
import { log } from "@/lib/logger";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ linkId: string }> }
) {
  const { linkId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(linkId)) {
    return new NextResponse("Not found", { status: 404 });
  }

  // Rate-limit per IP to prevent click flooding of a single link.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? req.headers.get("x-real-ip") ?? "local";
  const bucket = hitRateLimit(`go:${ip}:${linkId}`, { capacity: 20, refillPerSecond: 2 });
  if (!bucket.ok) {
    return new NextResponse("Slow down", {
      status: 429,
      headers: { "Retry-After": String(bucket.retryAfter) },
    });
  }

  // Load the profile that holds this link in its PUBLISHED snapshot.
  const [profile] = await db
    .select()
    .from(schema.profiles)
    .where(
      and(
        sql`${schema.profiles.publishedSnapshot} is not null`,
        sql`exists (
          select 1 from jsonb_array_elements(${schema.profiles.publishedSnapshot}->'links') l
          where l->>'id' = ${linkId}
        )`
      )
    )
    .limit(1);

  if (!profile) {
    log("info", "click_miss", { linkId });
    return new NextResponse("Link not available", { status: 404 });
  }

  const resolution = resolveLinkForRedirect(profile, linkId);
  if (!resolution.ok) {
    return new NextResponse("Link not available", { status: 404 });
  }

  const publicOrigin = process.env.PERCH_PUBLIC_ORIGIN ?? null;
  try {
    await recordClick(linkId, req.headers.get("referer"), publicOrigin);
  } catch (err) {
    log("error", "click_record_failed", { linkId, error: String(err) });
    // Don't fail the redirect because analytics failed.
  }

  return NextResponse.redirect(resolution.href, 302);
}
