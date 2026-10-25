import { requireOwnerWithProfile } from "@/domain/auth";
import { listLinks } from "@/domain/links";
import { listSocials, publicUrlFor } from "@/domain/profile";
import { isDraftAhead } from "@/domain/publish";
import { getStorage } from "@/lib/storage";
import { Badge } from "@/components/Badge";
import { EditorClient } from "./editor.client";

export const metadata = { title: "Profile" };

export default async function ProfileEditorPage() {
  const { profile } = await requireOwnerWithProfile();
  const [draftLinks, draftSocials] = await Promise.all([listLinks(profile.id), listSocials(profile.id)]);

  let avatarUrl: string | null = null;
  if (profile.draftAvatarKey) {
    avatarUrl = await getStorage().getSignedUrl(profile.draftAvatarKey, 300);
  }
  const draftAhead = isDraftAhead(profile);

  return (
    <section className="app-stack">
      <header className="page-hero">
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
          <span className="page-hero__eyebrow">Editing</span>
          <h1 className="page-hero__title">
            Your page
            {profile.publishedAt ? (
              draftAhead ? (
                <Badge tone="warning" label="Draft ahead" />
              ) : (
                <Badge tone="success" label="Published" />
              )
            ) : (
              <Badge tone="neutral" label="Not published yet" />
            )}
          </h1>
          <p className="page-hero__subtitle">
            Edit freely — nothing goes live until you publish. The phone on the right mirrors exactly what visitors will see.
          </p>
        </div>
        <div className="page-hero__right">
          <span className="page-hero__eyebrow">Your public URL</span>
          <a className="app-url" href={publicUrlFor(profile.slug)} target="_blank" rel="noopener noreferrer">
            {publicUrlFor(profile.slug).replace(/^https?:\/\//, "")} →
          </a>
        </div>
      </header>

      <EditorClient
        profile={{
          id: profile.id,
          slug: profile.slug,
          displayName: profile.displayName,
          bio: profile.bio,
          theme: profile.theme,
          avatarUrl,
          publishedVersion: profile.publishedVersion,
          hasPublished: !!profile.publishedSnapshot,
          draftAhead,
        }}
        links={draftLinks.map((l) => ({
          id: l.id,
          label: l.label,
          href: l.href,
          description: l.description,
          highlight: l.highlight,
          position: l.position,
        }))}
        socials={draftSocials.map((s) => ({ id: s.id, kind: s.kind, handle: s.handle, href: s.href }))}
      />
    </section>
  );
}
