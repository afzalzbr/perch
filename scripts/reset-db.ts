function isNeonUrl(url: string): boolean {
  try {
    return new URL(url).hostname.endsWith(".neon.tech");
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }
  const sql = `
    DROP TABLE IF EXISTS click_counts CASCADE;
    DROP TABLE IF EXISTS socials CASCADE;
    DROP TABLE IF EXISTS links CASCADE;
    DROP TABLE IF EXISTS profiles CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TABLE IF EXISTS schema_migrations CASCADE;
  `;
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
    await pool.query(sql);
    await pool.end();
  } else {
    const pg = await import("pg");
    const client = new pg.default.Client({ connectionString: url });
    await client.connect();
    await client.query(sql);
    await client.end();
  }
  console.log("reset done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
