import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

type SqlClient = {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[] }>;
  end: () => Promise<void>;
};

function isNeonUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".neon.tech");
  } catch {
    return false;
  }
}

async function makeClient(url: string): Promise<SqlClient> {
  // Driver choice matches src/db/index.ts: Neon serverless over HTTPS/WebSocket
  // for *.neon.tech, raw pg otherwise.
  if (isNeonUrl(url)) {
    const { Pool, neonConfig } = await import("@neondatabase/serverless");
    const WS = (await import("ws")).default;
    const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy;
    let wsCtor: unknown = WS;
    if (proxyUrl) {
      const { HttpsProxyAgent } = await import("https-proxy-agent");
      const agent = new HttpsProxyAgent(proxyUrl);
      const Base = WS as unknown as new (...a: unknown[]) => object;
      wsCtor = class ProxiedWS extends Base {
        constructor(address: unknown, protocols?: unknown, options?: Record<string, unknown>) {
          super(address, protocols, { ...(options ?? {}), agent });
        }
      };
    }
    (neonConfig as unknown as { webSocketConstructor?: unknown }).webSocketConstructor = wsCtor;
    const pool = new Pool({ connectionString: url, max: 1 });
    return {
      query: async (text: string, params?: unknown[]) =>
        (await pool.query(text, params)) as { rows: unknown[] },
      end: () => pool.end(),
    };
  }
  const pg = await import("pg");
  const client = new pg.default.Client({ connectionString: url });
  await client.connect();
  return {
    query: (text: string, params?: unknown[]) =>
      client.query(text, params) as Promise<{ rows: unknown[] }>,
    end: () => client.end(),
  };
}

async function main(): Promise<void> {
  // Prefer the direct (non-pooled) connection string for migrations.
  // Neon's pgbouncer pooler can refuse multi-statement DDL and lock sequences.
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }
  const client = await makeClient(url);

  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    );
  `);

  const dir = join(process.cwd(), "drizzle");
  const files = readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const { rows } = (await client.query(
      "SELECT name FROM schema_migrations WHERE name = $1",
      [file]
    )) as { rows: Array<{ name: string }> };
    if (rows.length > 0) {
      console.log(`skip   ${file}`);
      continue;
    }
    const sqlText = readFileSync(join(dir, file), "utf8");
    console.log(`apply  ${file}`);
    try {
      await client.query("BEGIN");
      await client.query(sqlText);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK");
      console.error(`FAIL   ${file}:`, err);
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  console.log("migrations done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
