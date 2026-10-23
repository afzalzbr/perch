// Minimal structured logger that redacts obvious secrets.
const REDACT_KEYS = new Set([
  "password",
  "passwordHash",
  "password_hash",
  "token",
  "secret",
  "authorization",
  "cookie",
]);

function redact(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(redact);
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    out[k] = REDACT_KEYS.has(k) ? "[redacted]" : redact(v);
  }
  return out;
}

export function log(
  level: "info" | "warn" | "error",
  message: string,
  context: Record<string, unknown> = {}
): void {
  const entry = {
    level,
    message,
    ts: new Date().toISOString(),
    ...(redact(context) as Record<string, unknown>),
  };
  // JSON lines on stdout; easier to parse than key=value.
  // eslint-disable-next-line no-console
  console[level === "error" ? "error" : "log"](JSON.stringify(entry));
}
