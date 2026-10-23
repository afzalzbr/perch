import { NextResponse } from "next/server";
import { getPool } from "@/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  let dbOk = false;
  try {
    const client = await getPool().connect();
    try {
      await client.query("SELECT 1");
      dbOk = true;
    } finally {
      client.release();
    }
  } catch {
    dbOk = false;
  }
  return NextResponse.json(
    { ok: dbOk, service: "perch", time: new Date().toISOString() },
    { status: dbOk ? 200 : 503 }
  );
}
