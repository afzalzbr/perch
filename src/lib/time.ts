// Day computation in the creator's local timezone, without pulling in a date lib.

const DEFAULT_TZ = process.env.PERCH_TZ ?? "UTC";

export function profileTz(): string {
  return process.env.PERCH_TZ ?? DEFAULT_TZ;
}

/** Returns YYYY-MM-DD in the configured profile timezone. */
export function currentDayLocal(now: Date = new Date(), tz: string = profileTz()): string {
  // en-CA locale yields YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Format a UTC instant in the profile tz, e.g. "Thu, 23 Oct · 4:12 pm PDT". */
export function formatPublishedAt(ts: Date, tz: string = profileTz()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    timeZoneName: "short",
  }).formatToParts(ts);
  const by = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${by("weekday")}, ${by("day")} ${by("month")} · ${by("hour")}:${by("minute")} ${by("dayPeriod")} ${by(
    "timeZoneName"
  )}`;
}

/** Returns the last `n` day strings (YYYY-MM-DD) in local tz, oldest first. */
export function lastNDaysLocal(n: number, now: Date = new Date(), tz: string = profileTz()): string[] {
  const out: string[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getTime() - i * 86_400_000);
    out.push(currentDayLocal(d, tz));
  }
  return out;
}
