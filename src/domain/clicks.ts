import { and, eq, gte, sql, inArray } from "drizzle-orm";
import { db, schema } from "@/db";
import { classifyReferrer, type ReferrerCategory } from "@/lib/referrer";
import { currentDayLocal, lastNDaysLocal } from "@/lib/time";

export type LinkResolution =
  | { ok: true; href: string; linkId: string }
  | { ok: false; reason: "not-published" | "retired" };

export function resolveLinkForRedirect(
  profile: schema.Profile,
  linkId: string
): LinkResolution {
  const snap = profile.publishedSnapshot;
  if (!snap) return { ok: false, reason: "not-published" };
  const found = snap.links.find((l) => l.id === linkId);
  if (!found) return { ok: false, reason: "retired" };
  return { ok: true, href: found.href, linkId: found.id };
}

export async function recordClick(
  linkId: string,
  referrer: string | null | undefined,
  publicOrigin: string | null = null
): Promise<ReferrerCategory> {
  const cat = classifyReferrer(referrer, publicOrigin);
  const day = currentDayLocal();
  await db.execute(sql`
    INSERT INTO click_counts (link_id, day, referrer_category, count)
    VALUES (${linkId}, ${day}::date, ${cat}, 1)
    ON CONFLICT (link_id, day, referrer_category)
    DO UPDATE SET count = click_counts.count + 1
  `);
  return cat;
}

export type AnalyticsSummary = {
  total7: number;
  total30: number;
  perLink: Array<{ linkId: string; label: string; count7: number; count30: number; highlight: boolean }>;
  dailyTrend: Array<{ day: string; count: number }>;
};

export async function analyticsSummary(
  profile: schema.Profile
): Promise<AnalyticsSummary> {
  const snap = profile.publishedSnapshot;
  const linkIds = snap ? snap.links.map((l) => l.id) : [];
  const labels = new Map<string, { label: string; highlight: boolean }>();
  snap?.links.forEach((l) => labels.set(l.id, { label: l.label, highlight: l.highlight }));

  if (linkIds.length === 0) {
    return { total7: 0, total30: 0, perLink: [], dailyTrend: lastNDaysLocal(7).map((d) => ({ day: d, count: 0 })) };
  }

  const days30 = lastNDaysLocal(30);
  const earliest = days30[0];
  const rows = await db
    .select({
      linkId: schema.clickCounts.linkId,
      day: schema.clickCounts.day,
      count: schema.clickCounts.count,
    })
    .from(schema.clickCounts)
    .where(
      and(inArray(schema.clickCounts.linkId, linkIds), gte(schema.clickCounts.day, earliest))
    );

  const days7Set = new Set(lastNDaysLocal(7));
  const perLinkMap = new Map<string, { count7: number; count30: number }>();
  const perDay = new Map<string, number>();
  for (const r of rows) {
    const linkStats = perLinkMap.get(r.linkId) ?? { count7: 0, count30: 0 };
    linkStats.count30 += r.count;
    if (days7Set.has(r.day)) {
      linkStats.count7 += r.count;
      perDay.set(r.day, (perDay.get(r.day) ?? 0) + r.count);
    }
    perLinkMap.set(r.linkId, linkStats);
  }

  const perLink = snap!.links
    .map((l) => {
      const stat = perLinkMap.get(l.id) ?? { count7: 0, count30: 0 };
      return { linkId: l.id, label: l.label, count7: stat.count7, count30: stat.count30, highlight: l.highlight };
    })
    .sort((a, b) => b.count7 - a.count7 || b.count30 - a.count30);

  const total7 = perLink.reduce((n, x) => n + x.count7, 0);
  const total30 = perLink.reduce((n, x) => n + x.count30, 0);

  const dailyTrend = lastNDaysLocal(7).map((d) => ({ day: d, count: perDay.get(d) ?? 0 }));
  return { total7, total30, perLink, dailyTrend };
}
