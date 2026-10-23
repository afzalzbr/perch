// Classify a referrer URL into a coarse category for daily analytics counts.
// No full referrer is retained — only the category.
export type ReferrerCategory = "search" | "social" | "direct" | "other";

const SEARCH_HOSTS = [
  "google.",
  "bing.com",
  "duckduckgo.com",
  "yahoo.",
  "yandex.",
  "baidu.com",
  "ecosia.org",
  "brave.com",
  "kagi.com",
];

const SOCIAL_HOSTS = [
  "instagram.com",
  "youtube.com",
  "youtu.be",
  "tiktok.com",
  "twitter.com",
  "x.com",
  "t.co",
  "linkedin.com",
  "lnkd.in",
  "facebook.com",
  "fb.com",
  "l.facebook.com",
  "reddit.com",
  "pinterest.com",
  "threads.net",
  "bsky.app",
  "mastodon.",
  "tumblr.com",
  "medium.com",
  "substack.com",
];

export function classifyReferrer(
  referrer: string | null | undefined,
  publicOrigin: string | null = null
): ReferrerCategory {
  if (!referrer) return "direct";
  let url: URL;
  try {
    url = new URL(referrer);
  } catch {
    return "other";
  }

  const host = url.hostname.toLowerCase();
  if (!host) return "direct";

  if (publicOrigin) {
    try {
      const self = new URL(publicOrigin).hostname.toLowerCase();
      if (host === self) return "direct";
    } catch {
      /* ignore */
    }
  }

  if (SEARCH_HOSTS.some((h) => host.includes(h))) return "search";
  if (SOCIAL_HOSTS.some((h) => host === h || host.endsWith(`.${h}`) || host.includes(h))) {
    return "social";
  }
  return "other";
}
