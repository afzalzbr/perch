import { redirect } from "next/navigation";
import { getSession } from "@/lib/session";
import { db, schema } from "@/db";
import { eq } from "drizzle-orm";

export default async function Home() {
  const session = await getSession();
  if (!session) redirect("/sign-in");
  const [profile] = await db
    .select({ id: schema.profiles.id })
    .from(schema.profiles)
    .where(eq(schema.profiles.userId, session.userId))
    .limit(1);
  if (!profile) redirect("/setup");
  redirect("/dashboard");
}
