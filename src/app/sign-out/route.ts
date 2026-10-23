import { NextResponse } from "next/server";
import { clearSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  await clearSession();
  return NextResponse.redirect(new URL("/sign-in", process.env.PERCH_PUBLIC_ORIGIN ?? "http://localhost:3000"));
}
