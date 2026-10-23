import { db, schema } from "@/db";
import { sql } from "drizzle-orm";
import bcrypt from "bcryptjs";

export async function truncateAll(): Promise<void> {
  await db.execute(sql`
    TRUNCATE TABLE click_counts, socials, links, profiles, users RESTART IDENTITY CASCADE
  `);
}

export async function createUser(email = "owner@example.com", password = "superSecret1"): Promise<schema.User> {
  const hash = await bcrypt.hash(password, 4);
  const [u] = await db.insert(schema.users).values({ email, passwordHash: hash }).returning();
  return u;
}

export async function createProfileFor(
  userId: string,
  { slug = "alex", displayName = "Alex Perch" }: { slug?: string; displayName?: string } = {}
): Promise<schema.Profile> {
  const [p] = await db
    .insert(schema.profiles)
    .values({ userId, slug, displayName })
    .returning();
  return p;
}
