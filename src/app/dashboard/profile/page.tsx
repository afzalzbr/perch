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
      <div className="app-row" style={{ justifyContent: "space-between" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <h1 className="app-panel__title" style={{ margin: 0 }}>
            Your page
          </h1>
          {profile.publishedAt ? (
            draftAhead ? (
              <Badge tone="warning" label="Draft ahead" />
            ) : (
              <Badge tone="success" label="Published" />
            )
          ) : (
            <Badge tone="neutral" label="Not published yet" />
          )}
        </div>
        <code className="app-url">{publicUrlFor(profile.slug).replace(/^https?:\/\//, "")}</code>
      </div>

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
