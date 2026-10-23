import type { ReactNode } from "react";
import type { SocialKind, Theme } from "@/db/schema";
import { LinkCard } from "./LinkCard";
import { SocialRow } from "./SocialRow";

export type PhonePreviewProps = {
  name: string;
  slug: string;
  bio?: string | null;
  avatarUrl?: string | null;
  theme?: Theme;
  links: Array<{
    label: string;
    href: string;
    description?: string | null;
    highlight?: boolean;
  }>;
  social?: Array<{ kind: SocialKind; handle: string; href: string }>;
  footer?: ReactNode;
};

export function PhonePreview({ name, slug, bio, avatarUrl, theme = "daylight", links, social = [] }: PhonePreviewProps) {
  return (
    <div className={`perch-phone perch-theme-${theme}`} aria-label="Live preview of the public page">
      <div className="perch-phone__chrome">
        <span>9:41</span>
        <span>perch.app/{slug}</span>
      </div>
      <div className="perch-phone__screen">
        <div className="perch-phone__header">
          <span
            className="perch-avatar perch-avatar--md perch-avatar--ring"
            role="img"
            aria-label={name || "Avatar"}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" />
            ) : (
              <span aria-hidden="true">{name ? name.trim().charAt(0).toUpperCase() : "·"}</span>
            )}
          </span>
          <span className="perch-phone__name">{name || "Your name"}</span>
          <span className="perch-phone__handle">@{slug || "handle"}</span>
          {bio ? <span className="perch-phone__bio">{bio}</span> : null}
        </div>
        <div className="perch-phone__links">
          {links.length === 0 ? (
            <div className="perch-link-card">
              <span className="perch-link-card__thumb" aria-hidden="true">
                +
              </span>
              <span className="perch-link-card__text">
                <span className="perch-link-card__label">Add a link to see it here</span>
                <span className="perch-link-card__desc">The visitor sees exactly this list.</span>
              </span>
            </div>
          ) : (
            links.map((l, i) => (
              <LinkCard
                key={i}
                label={l.label}
                href={l.href}
                description={l.description}
                highlight={l.highlight}
                external={false}
              />
            ))
          )}
        </div>
        {social.length > 0 ? <SocialRow handles={social} /> : null}
      </div>
    </div>
  );
}
