import { NextResponse } from "next/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  let dbOk = false;
  let dbError: string | undefined;
  try {
    await db.execute(sql`SELECT 1`);
    dbOk = true;
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      dbError = err instanceof Error ? err.message : String(err);
    }
  }
  return NextResponse.json(
    { ok: dbOk, service: "perch", time: new Date().toISOString(), ...(dbError ? { dbError } : {}) },
    { status: dbOk ? 200 : 503 }
  );
}
