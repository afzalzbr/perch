/**
 * URL normalization used wherever untrusted URLs enter the system:
 * link destinations, social hrefs. Unsafe protocols are rejected.
 */

const ALLOWED_LINK_PROTOCOLS = new Set(["http:", "https:", "mailto:"]);
const SOCIAL_HOSTS: Record<string, readonly string[]> = {
  instagram: ["instagram.com", "www.instagram.com"],
  youtube: ["youtube.com", "www.youtube.com", "youtu.be", "m.youtube.com"],
  tiktok: ["tiktok.com", "www.tiktok.com", "vm.tiktok.com"],
  x: ["x.com", "www.x.com", "twitter.com", "www.twitter.com"],
  github: ["github.com", "www.github.com"],
  linkedin: ["linkedin.com", "www.linkedin.com"],
  website: [],
};

export type NormalizedUrl = {
  href: string;
  protocol: string;
  hostname: string | null;
};

export function normalizeLinkUrl(input: string): NormalizedUrl {
  const raw = (input ?? "").trim();
  if (!raw) throw new Error("URL is required");
  if (raw.length > 2048) throw new Error("URL is too long");

  let withScheme = raw;
  if (!/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(raw) && !raw.startsWith("//")) {
    // Bare domain → assume https://
    withScheme = `https://${raw}`;
  }

  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    throw new Error("That doesn't look like a valid URL.");
  }

  const protocol = parsed.protocol.toLowerCase();
  if (!ALLOWED_LINK_PROTOCOLS.has(protocol)) {
    throw new Error(
      "Links must start with https:// (or mailto: for email)."
    );
  }

  if (protocol === "mailto:") {
    const addr = parsed.pathname.trim();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(addr)) {
      throw new Error("That doesn't look like a valid email address.");
    }
    return { href: `mailto:${addr}`, protocol, hostname: null };
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname) throw new Error("Missing hostname.");
  if (hostname === "localhost" || /^(\d+\.){3}\d+$/.test(hostname)) {
    throw new Error("Public links must use a domain name.");
  }

  // Normalize: lowercase hostname, drop trailing dot, drop default ports,
  // normalize percent-encoded path, keep query & fragment.
  parsed.hostname = hostname.replace(/\.+$/, "");
  if (
    (parsed.protocol === "http:" && parsed.port === "80") ||
    (parsed.protocol === "https:" && parsed.port === "443")
  ) {
    parsed.port = "";
  }

  return {
    href: parsed.toString(),
    protocol,
    hostname: parsed.hostname,
  };
}

export function normalizeSocialUrl(
  kind: keyof typeof SOCIAL_HOSTS,
  input: string
): NormalizedUrl {
  const url = normalizeLinkUrl(input);
  if (url.protocol !== "https:") {
    throw new Error("Social links must use https://.");
  }
  const allowed = SOCIAL_HOSTS[kind];
  if (allowed.length > 0 && (!url.hostname || !allowed.includes(url.hostname))) {
    throw new Error(
      `That doesn't look like a ${kind} profile URL (expected one of ${allowed.join(", ")}).`
    );
  }
  return url;
}

export function hostnameOf(href: string): string | null {
  try {
    const u = new URL(href);
    if (u.protocol === "mailto:") return null;
    return u.hostname;
  } catch {
    return null;
  }
}
