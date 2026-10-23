import bcrypt from "bcryptjs";
import pg from "pg";
import { randomUUID } from "node:crypto";

type SeedOptions = {
  includeClicks?: boolean;
  variant?: "happy" | "empty";
};

async function main(): Promise<void> {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }
  const variant = (process.env.PERCH_SEED_VARIANT as SeedOptions["variant"]) ?? "happy";
  const includeClicks = (process.env.PERCH_SEED_CLICKS ?? "1") !== "0";

  const client = new pg.Client({ connectionString: dbUrl });
  await client.connect();

  // Reset data (keep schema).
  await client.query(
    "TRUNCATE TABLE click_counts, socials, links, profiles, users RESTART IDENTITY CASCADE"
  );

  const email = process.env.PERCH_SEED_EMAIL ?? "alex@example.com";
  const password = process.env.PERCH_SEED_PASSWORD ?? "superSecret1";
  const hash = await bcrypt.hash(password, 10);

  const { rows: userRows } = await client.query<{ id: string }>(
    `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
    [email, hash]
  );
  const userId = userRows[0].id;

  const profileId = randomUUID();
  const slug = "alex";
  await client.query(
    `INSERT INTO profiles (id, user_id, slug, display_name, bio, theme, draft_updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, now())`,
    [
      profileId,
      userId,
      slug,
      "Alex Perch",
      "Printmaker in Portland. Occasional writer. Dog nerd.",
      "daylight",
    ]
  );

  if (variant === "empty") {
    console.log("seed: created empty profile (no links)");
    await client.end();
    return;
  }

  const links = [
    {
      id: randomUUID(),
      label: "The October print drop",
      href: "https://shop.example.com/october",
      description: "Only 40 made · ships Nov 4",
      highlight: true,
      position: 0,
    },
    {
      id: randomUUID(),
      label: "Monthly letters, every first Monday",
      href: "https://news.example.com/subscribe",
      description: null,
      highlight: false,
      position: 1,
    },
    {
      id: randomUUID(),
      label: "Portfolio: alex.me",
      href: "https://alex.me",
      description: null,
      highlight: false,
      position: 2,
    },
    // Archived-ish state: a link that was published once but is now hidden from the draft
    // is modeled by storing it only in published_snapshot after a later publish. We also
    // seed one plain draft link that has no published counterpart yet.
    {
      id: randomUUID(),
      label: "Work in progress — Dec studio tour",
      href: "https://alex.me/studio-tour",
      description: null,
      highlight: false,
      position: 3,
    },
  ];

  for (const l of links) {
    await client.query(
      `INSERT INTO links (id, profile_id, label, href, description, highlight, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [l.id, profileId, l.label, l.href, l.description, l.highlight, l.position]
    );
  }

  await client.query(
    `INSERT INTO socials (profile_id, kind, handle, href, position)
     VALUES
      ($1, 'instagram', '@alex.prints', 'https://instagram.com/alex.prints', 0),
      ($1, 'website', 'alex.me',        'https://alex.me', 1)`,
    [profileId]
  );

  // Publish v1 with the first three links (studio tour link is only in draft).
  const snapshot = {
    version: 1,
    publishedAt: new Date().toISOString(),
    slug,
    displayName: "Alex Perch",
    bio: "Printmaker in Portland. Occasional writer. Dog nerd.",
    theme: "daylight",
    avatarKey: null,
    links: links.slice(0, 3).map((l) => ({
      id: l.id,
      label: l.label,
      href: l.href,
      description: l.description,
      highlight: l.highlight,
    })),
    socials: [
      { kind: "instagram", handle: "@alex.prints", href: "https://instagram.com/alex.prints" },
      { kind: "website", handle: "alex.me", href: "https://alex.me" },
    ],
  };

  await client.query(
    `UPDATE profiles
       SET published_snapshot = $1::jsonb,
           published_at = now(),
           published_version = 1,
           draft_updated_at = now() + interval '1 second'
     WHERE id = $2`,
    [JSON.stringify(snapshot), profileId]
  );

  if (includeClicks) {
    // Three days of realistic daily counts for the published links.
    const today = new Date();
    const dayStr = (d: Date) => d.toISOString().slice(0, 10);
    const minus = (days: number) => new Date(today.getTime() - days * 86_400_000);
    const scenarios: Array<[string, string, number]> = [
      [links[0].id, "direct", 24],
      [links[0].id, "social", 56],
      [links[0].id, "search", 11],
      [links[1].id, "social", 18],
      [links[1].id, "direct", 7],
      [links[2].id, "direct", 9],
      [links[2].id, "other", 3],
    ];
    for (const [id, cat, count] of scenarios) {
      for (let d = 0; d < 3; d++) {
        const day = dayStr(minus(d));
        const partition = Math.max(1, Math.round((count / 3) * (1 + 0.2 * (d - 1))));
        await client.query(
          `INSERT INTO click_counts (link_id, day, referrer_category, count)
             VALUES ($1, $2::date, $3, $4)
           ON CONFLICT (link_id, day, referrer_category)
             DO UPDATE SET count = click_counts.count + EXCLUDED.count`,
          [id, day, cat, partition]
        );
      }
    }
  }

  console.log(`seed: ready
  sign-in : ${email} / ${password}
  profile : ${slug}
  public  : /${slug}
  variant : ${variant}
  clicks  : ${includeClicks ? "yes" : "no"}
`);

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
