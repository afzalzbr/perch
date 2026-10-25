import * as schema from "./schema";

/**
 * Database handle.
 *
 * Two drivers are supported depending on the DATABASE_URL:
 *
 *   - A traditional Postgres TCP connection (e.g. a local Postgres, or
 *     anything reachable by `pg`): uses `pg.Pool` + `drizzle-orm/node-postgres`.
 *     Transactions, savepoints, LISTEN/NOTIFY all work.
 *
 *   - Neon's serverless HTTP/WebSocket driver (`@neondatabase/serverless`):
 *     used when `PERCH_DB_DRIVER=neon-serverless`, or auto-detected when
 *     DATABASE_URL points at a `*.neon.tech` host. Required in environments
 *     that only allow outbound HTTPS (e.g. the one this app may be deployed in
 *     without raw TCP egress on 5432). Supports transactions over WebSocket.
 */

type PgLikePool = {
  end: () => Promise<void>;
  connect?: (...args: unknown[]) => Promise<{
    query: (text: string, params?: unknown[]) => Promise<unknown>;
    release: () => void;
  }>;
};

type Database = ReturnType<typeof makeDb>;

declare global {
  // eslint-disable-next-line no-var
  var __perchPool: PgLikePool | undefined;
  // eslint-disable-next-line no-var
  var __perchDb: Database | undefined;
}

function isNeonUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".neon.tech");
  } catch {
    return false;
  }
}

function pickDriver(url: string): "neon-serverless" | "node-postgres" {
  const explicit = process.env.PERCH_DB_DRIVER;
  if (explicit === "neon-serverless" || explicit === "node-postgres") return explicit;
  return isNeonUrl(url) ? "neon-serverless" : "node-postgres";
}

function makeDb(url: string) {
  const driver = pickDriver(url);
  if (driver === "neon-serverless") {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { Pool, neonConfig } = require("@neondatabase/serverless") as typeof import("@neondatabase/serverless");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const WS = require("ws") as typeof import("ws");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { drizzle } = require("drizzle-orm/neon-serverless") as typeof import("drizzle-orm/neon-serverless");
    // When the runtime has an outbound HTTPS_PROXY (common in sandboxed hosts
    // like Claude Code's cloud container), tunnel the WebSocket through it so
    // the Neon driver can reach pg.*.neon.tech.
    const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || process.env.HTTP_PROXY || process.env.http_proxy;
    let wsCtor: unknown = WS;
    if (proxyUrl) {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { HttpsProxyAgent } = require("https-proxy-agent") as typeof import("https-proxy-agent");
      const agent = new HttpsProxyAgent(proxyUrl);
      const Base = WS as unknown as new (...a: unknown[]) => object;
      wsCtor = class ProxiedWS extends Base {
        constructor(address: unknown, protocols?: unknown, options?: Record<string, unknown>) {
          super(address, protocols, { ...(options ?? {}), agent });
        }
      };
    }
    (neonConfig as unknown as { webSocketConstructor?: unknown }).webSocketConstructor = wsCtor;
    const pool = new Pool({ connectionString: url, max: 10 });
    globalThis.__perchPool = pool as unknown as PgLikePool;
    return drizzle(pool, { schema });
  }
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const pg = require("pg") as typeof import("pg");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { drizzle } = require("drizzle-orm/node-postgres") as typeof import("drizzle-orm/node-postgres");
  const pool = new pg.Pool({ connectionString: url, max: 10, idleTimeoutMillis: 10_000 });
  globalThis.__perchPool = pool as unknown as PgLikePool;
  return drizzle(pool, { schema });
}

export function getPool(): PgLikePool {
  if (!globalThis.__perchPool) {
    getDb();
  }
  return globalThis.__perchPool!;
}

export function getDb(): Database {
  if (!globalThis.__perchDb) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL is not set");
    globalThis.__perchDb = makeDb(url);
  }
  return globalThis.__perchDb!;
}

export const db = new Proxy({} as Database, {
  get(_target, prop) {
    return (getDb() as unknown as Record<string, unknown>)[prop as string];
  },
});

export { schema };
export type { Database };
