import { hostnameOf } from "@/lib/normalize-url";

export type LinkCardProps = {
  label: string;
  href: string;
  description?: string | null;
  highlight?: boolean;
  draft?: boolean;
  icon?: string;
  external?: boolean;
};

export function LinkCard({ label, href, description, highlight, draft, icon, external = true }: LinkCardProps) {
  const host = hostnameOf(href);
  const thumb = icon ?? label.trim().charAt(0).toUpperCase() ?? "·";
  const subtitle = description && description.trim().length > 0 ? description : null;
  const cls = [
    "perch-link-card",
    highlight ? "is-highlight" : "",
    draft ? "is-draft" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const rel = external ? "noopener noreferrer" : undefined;
  const target = external ? "_blank" : undefined;
  return (
    <a className={cls} href={href} rel={rel} target={target}>
      <span className="perch-link-card__thumb" aria-hidden="true">
        {thumb}
      </span>
      <span className="perch-link-card__text">
        <span className="perch-link-card__label">{label}</span>
        {subtitle ? (
          <span className="perch-link-card__desc">{subtitle}</span>
        ) : host ? (
          <span className="perch-link-card__host">{host}</span>
        ) : null}
      </span>
      <span className="perch-link-card__arrow" aria-hidden="true">
        →
      </span>
    </a>
  );
}
