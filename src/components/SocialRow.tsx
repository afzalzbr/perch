import type { ReactNode } from "react";
import type { SocialKind } from "@/db/schema";

const LABEL: Record<SocialKind, string> = {
  instagram: "Instagram",
  youtube: "YouTube",
  tiktok: "TikTok",
  x: "X",
  github: "GitHub",
  linkedin: "LinkedIn",
  website: "Website",
};

/**
 * Icons are drawn on a 24-grid, 1.5px stroke, square endcaps.
 * Everything is `fill="none"` by default via the parent CSS — any filled
 * element below passes `fill="currentColor"` explicitly.
 */
const ICON: Record<SocialKind, ReactNode> = {
  instagram: (
    <>
      <rect x="3" y="3" width="18" height="18" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.9" fill="currentColor" stroke="none" />
    </>
  ),
  youtube: (
    <>
      <path d="M2.5 8.5c0-1.1.9-2 2-2h15c1.1 0 2 .9 2 2v7c0 1.1-.9 2-2 2h-15c-1.1 0-2-.9-2-2v-7z" />
      <path d="M10 9.5v5l4.5-2.5z" fill="currentColor" stroke="none" />
    </>
  ),
  tiktok: (
    <>
      <path d="M15 3v9.5a3.5 3.5 0 1 1-3.5-3.5" />
      <path d="M15 3c.2 2.5 1.9 4.5 4.5 4.8" />
    </>
  ),
  x: (
    <>
      <path d="M4 4l16 16" />
      <path d="M20 4L4 20" />
    </>
  ),
  github: (
    <>
      <path d="M9 19c-4 1.3-4-2.2-5.5-2.5M15 21v-3.4c0-1 .1-1.4-.5-2 2.8-.3 5.5-1.4 5.5-6a4.6 4.6 0 0 0-1.3-3.2 4.2 4.2 0 0 0-.1-3.2s-1-.3-3.4 1.2a11.6 11.6 0 0 0-6 0C6.3 2.9 5.3 3.2 5.3 3.2a4.2 4.2 0 0 0-.1 3.2A4.6 4.6 0 0 0 3.9 9.6c0 4.6 2.7 5.7 5.5 6-.6.6-.6 1.2-.5 2V21" />
    </>
  ),
  linkedin: (
    <>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-4 0v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect x="2" y="9" width="4" height="12" />
      <circle cx="4" cy="4" r="2" fill="currentColor" stroke="none" />
    </>
  ),
  website: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </>
  ),
};

export function SocialRow({
  handles,
}: {
  handles: Array<{ kind: SocialKind; handle: string; href: string }>;
}) {
  if (handles.length === 0) return null;
  return (
    <div className="perch-social-row" role="list">
      {handles.map((h) => (
        <a
          key={h.kind}
          className="perch-social-row__item"
          href={h.href}
          rel="noopener noreferrer"
          target="_blank"
          aria-label={`${LABEL[h.kind]}${h.handle ? ` ${h.handle}` : ""}`}
          role="listitem"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true">
            {ICON[h.kind]}
          </svg>
        </a>
      ))}
    </div>
  );
}
