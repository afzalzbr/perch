import { requireOwnerWithProfile } from "@/domain/auth";
import { analyticsSummary } from "@/domain/clicks";
import { Badge } from "@/components/Badge";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage() {
  const { profile } = await requireOwnerWithProfile();
  const data = await analyticsSummary(profile);
  const published = !!profile.publishedSnapshot;
  return (
    <section className="app-stack">
      <h1 className="app-panel__title">Analytics</h1>
      <p className="app-panel__subtitle">
        Daily click totals per link in your local time. No visitor fingerprints or precise locations are collected.
      </p>

      <div className="app-metric-grid">
        <div className="app-metric-card">
          <span className="app-label">7-day clicks</span>
          <span className="app-metric">{data.total7.toLocaleString("en-US")}</span>
        </div>
        <div className="app-metric-card">
          <span className="app-label">30-day clicks</span>
          <span className="app-metric">{data.total30.toLocaleString("en-US")}</span>
        </div>
      </div>

      <div className="app-panel">
        <div className="app-row" style={{ justifyContent: "space-between" }}>
          <h2 className="app-panel__title">Last 7 days</h2>
          <span style={{ fontSize: 12, color: "var(--color-ink-muted)" }}>
            Totals rolled by day in {process.env.PERCH_TZ ?? "UTC"}.
          </span>
        </div>
        {data.dailyTrend.every((d) => d.count === 0) ? (
          <div className="app-empty" role="status">
            <h3 className="app-empty__title">No clicks yet.</h3>
            <p className="app-empty__body">
              {published
                ? "Clicks will show up here once someone opens a link on your page."
                : "Clicks will show up here once your page is published and someone opens a link."}
            </p>
          </div>
        ) : (
          <TrendBars trend={data.dailyTrend} />
        )}
      </div>

      <div className="app-panel">
        <h2 className="app-panel__title">Per link</h2>
        {data.perLink.length === 0 ? (
          <div className="app-empty">
            <h3 className="app-empty__title">Nothing to rank yet.</h3>
            <p className="app-empty__body">
              Publish your page and your first visitor click will create the first ranking row here.
            </p>
          </div>
        ) : (
          <ol className="app-ranking">
            {data.perLink.map((row) => (
              <li key={row.linkId}>
                <div className="app-ranking__label">
                  <strong>{row.label}</strong>
                  <span style={{ fontSize: 12, color: "var(--color-ink-secondary)" }}>
                    30-day: {row.count30.toLocaleString("en-US")}
                    {row.highlight ? " · featured" : ""}
                  </span>
                </div>
                <div className="app-row" style={{ gap: 8 }}>
                  {row.highlight ? <Badge label="Featured" tone="brand" /> : null}
                  <span className="app-ranking__count">{row.count7.toLocaleString("en-US")}</span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>
    </section>
  );
}

function TrendBars({ trend }: { trend: Array<{ day: string; count: number }> }) {
  const max = Math.max(1, ...trend.map((t) => t.count));
  const today = trend[trend.length - 1]?.day;
  return (
    <div>
      <div className="app-trend" role="img" aria-label="Daily click trend">
        {trend.map((d) => {
          const h = Math.max(2, Math.round((d.count / max) * 110));
          return (
            <div
              key={d.day}
              className="app-trend__col"
              style={{ height: h }}
              data-today={d.day === today ? "true" : "false"}
              data-zero={d.count === 0 ? "true" : "false"}
              title={`${d.day}: ${d.count}`}
            />
          );
        })}
      </div>
      <div className="app-trend__labels">
        {trend.map((d) => (
          <span key={d.day}>{d.day.slice(5)}</span>
        ))}
      </div>
    </div>
  );
}
