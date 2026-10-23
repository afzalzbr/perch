export type AvatarSize = "sm" | "md" | "lg";

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "·";
  if (words.length === 1) return words[0].slice(0, 1).toUpperCase();
  return `${words[0][0]}${words[1][0]}`.toUpperCase();
}

export function Avatar({
  src,
  name,
  size = "md",
  ring = false,
}: {
  src?: string | null;
  name: string;
  size?: AvatarSize;
  ring?: boolean;
}) {
  const cls = [
    "perch-avatar",
    `perch-avatar--${size}`,
    ring ? "perch-avatar--ring" : "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <span className={cls} role="img" aria-label={name || "Avatar"}>
      {src ? <img src={src} alt="" loading="lazy" /> : <span aria-hidden="true">{initials(name)}</span>}
    </span>
  );
}
