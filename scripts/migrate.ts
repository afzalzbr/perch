import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import pg from "pg";

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set");
    process.exit(1);
  }
  const client = new pg.Client({ connectionString: url });
  await client.connect();

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
    const { rows } = await client.query<{ name: string }>(
      "SELECT name FROM schema_migrations WHERE name = $1",
      [file]
    );
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
