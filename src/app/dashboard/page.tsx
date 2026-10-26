import { requireOwnerWithProfile } from "@/domain/auth";
import { publicUrlFor } from "@/domain/profile";
import { Badge } from "@/components/Badge";
import { Avatar } from "@/components/Avatar";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { formatPublishedAt } from "@/lib/time";
import { isDraftAhead } from "@/domain/publish";
import { analyticsSummary } from "@/domain/clicks";
import { getStorage } from "@/lib/storage";
import { listLinks } from "@/domain/links";
import Link from "next/link";

export const metadata = { title: "Overview" };

export default async function DashboardPage() {
  const { profile } = await requireOwnerWithProfile();
  const [analytics, draftLinks] = await Promise.all([
    analyticsSummary(profile),
    listLinks(profile.id),
  ]);

  const published = profile.publishedSnapshot;
  const draftAhead = isDraftAhead(profile);
  const publicUrl = publicUrlFor(profile.slug);

  let avatarUrl: string | null = null;
  if (profile.draftAvatarKey) {
    avatarUrl = await getStorage().getSignedUrl(profile.draftAvatarKey, 300);
  }

  const completeness = computeCompleteness({
    hasName: profile.displayName.length > 0,
    hasBio: profile.bio.length > 0,
    hasAvatar: !!profile.draftAvatarKey,
    hasLinks: draftLinks.length >= 1,
    everPublished: !!published,
  });

  const pillState = !published
    ? { tone: "neutral" as const, label: "Not published yet" }
    : draftAhead
    ? { tone: "warning" as const, label: "Draft ahead" }
    : { tone: "success" as const, label: "Published" };

  const topLink = analytics.perLink.find((l) => l.count7 > 0);

  return (
    <div className="app-stack">
      <header className="page-hero">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          <span className="page-hero__eyebrow">Overview</span>
          <h1 className="page-hero__title">
            <Avatar name={profile.displayName} src={avatarUrl} size="md" />
            <span>{profile.displayName}</span>
            <Badge label={pillState.label} tone={pillState.tone} />
          </h1>
          <p className="page-hero__subtitle">
            Your bio page lives at <Link href={publicUrl} className="app-url" target="_blank" rel="noopener noreferrer">{publicUrl.replace(/^https?:\/\//, "")}</Link>
          </p>
        </div>
        <div className="page-hero__right">
          <div className="app-row" style={{ gap: "var(--space-2)" }}>
            <PrimaryButton href="/dashboard/profile" label="Edit profile" />
            {published ? (
              <SecondaryButton
                href={publicUrl}
                label="View public page"
                {...({ target: "_blank", rel: "noopener noreferrer" } as object)}
              />
            ) : (
              <SecondaryButton href="/dashboard/profile" label="Add your first link" />
            )}
          </div>
        </div>
      </header>

      <div className="app-metric-grid">
        <div className="app-metric-card">
          <span className="app-label">7-day clicks</span>
          <span className="app-metric">{analytics.total7.toLocaleString("en-US")}</span>
          <span className="app-panel__subtitle">
            {analytics.total7 === 0
              ? "Nothing yet — clicks arrive once a visitor opens a link."
              : "Rolled in your local day."}
          </span>
        </div>
        <div className="app-metric-card">
          <span className="app-label">Most clicked this week</span>
          <span className="app-metric-sm" style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {topLink ? topLink.label : "—"}
          </span>
          <span className="app-panel__subtitle">
            {topLink ? `${topLink.count7} clicks · ${topLink.highlight ? "featured" : "regular"}` : "Nothing yet."}
          </span>
        </div>
        <div className="app-metric-card">
          <span className="app-label">Last published</span>
          <span className="app-metric-sm">
            {profile.publishedAt ? formatPublishedAt(profile.publishedAt) : "Never"}
          </span>
          <span className="app-panel__subtitle">
            {profile.publishedAt
              ? `Version ${profile.publishedVersion}`
              : "Publish once your draft is ready."}
          </span>
        </div>
        <div className="app-metric-card">
          <span className="app-label">Setup</span>
          <span className="app-metric">{completeness.percent}%</span>
          <ul style={{ margin: 0, paddingLeft: 20, color: "var(--color-ink-secondary)", lineHeight: "22px" }}>
            {completeness.items.map((i) => (
              <li key={i.label} style={{ fontSize: 13, opacity: i.done ? 0.5 : 1 }}>
                {i.done ? "✓" : "·"} {i.label}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function computeCompleteness(input: {
  hasName: boolean;
  hasBio: boolean;
  hasAvatar: boolean;
  hasLinks: boolean;
  everPublished: boolean;
}) {
  const items = [
    { label: "Display name", done: input.hasName },
    { label: "Short bio", done: input.hasBio },
    { label: "Avatar", done: input.hasAvatar },
    { label: "At least one link", done: input.hasLinks },
    { label: "Published once", done: input.everPublished },
  ];
  const done = items.filter((i) => i.done).length;
  return { items, percent: Math.round((done / items.length) * 100) };
}
