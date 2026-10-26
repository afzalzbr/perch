import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { db, schema } from "@/db";
import { sql } from "drizzle-orm";
import { getStorage } from "@/lib/storage";
import { LinkCard } from "@/components/LinkCard";
import { SocialRow } from "@/components/SocialRow";
import { Avatar } from "@/components/Avatar";
import { Mark } from "@/components/Mark";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const snap = await loadPublished(slug);
  if (!snap) return { title: "Not found" };
  return {
    title: snap.displayName,
    description: snap.bio?.slice(0, 160) || `${snap.displayName} on Perch.`,
  };
}

async function loadPublished(slug: string): Promise<schema.PublishedSnapshot | null> {
  const [row] = await db
    .select({ snap: schema.profiles.publishedSnapshot })
    .from(schema.profiles)
    .where(sql`lower(${schema.profiles.slug}) = ${slug.toLowerCase()}`)
    .limit(1);
  return (row?.snap as schema.PublishedSnapshot | null) ?? null;
}

export default async function PublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const snap = await loadPublished(slug);
  if (!snap) notFound();

  let avatarUrl: string | null = null;
  if (snap.avatarKey) {
    avatarUrl = await getStorage().getSignedUrl(snap.avatarKey, 600);
  }

  const cfToken = process.env.CLOUDFLARE_WEB_ANALYTICS_TOKEN;

  return (
    <main className={`public-page perch-theme-${snap.theme}`} data-theme={snap.theme}>
      <header className="public-page__header">
        <span className="public-page__avatar-wrap">
          <Avatar name={snap.displayName} src={avatarUrl} size="lg" />
        </span>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", alignItems: "center" }}>
          <h1 className="public-page__name">{snap.displayName}</h1>
          <span className="public-page__handle">perch.app/{snap.slug}</span>
        </div>
        {snap.bio ? <p className="public-page__bio">{snap.bio}</p> : null}
      </header>
      <nav className="public-page__links" aria-label={`Links from ${snap.displayName}`}>
        {snap.links.map((l) => (
          <LinkCard
            key={l.id}
            label={l.label}
            href={`/go/${l.id}`}
            description={l.description ?? undefined}
            highlight={l.highlight}
            external={false}
          />
        ))}
      </nav>
      <div className="public-page__social">
        <SocialRow handles={snap.socials} />
      </div>
      <footer className="public-page__footer">
        <Mark size="sm" />
        <a href="/sign-in">Made with Perch</a>
      </footer>
      {cfToken ? (
        <script
          defer
          src="https://static.cloudflareinsights.com/beacon.min.js"
          data-cf-beacon={`{"token": "${escapeJson(cfToken)}"}`}
        />
      ) : null}
    </main>
  );
}

function escapeJson(s: string): string {
  return s.replace(/"/g, '\\"').replace(/</g, "\\u003c");
}
