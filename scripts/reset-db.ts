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
    DROP TABLE IF EXISTS click_counts CASCADE;
    DROP TABLE IF EXISTS socials CASCADE;
    DROP TABLE IF EXISTS links CASCADE;
    DROP TABLE IF EXISTS profiles CASCADE;
    DROP TABLE IF EXISTS users CASCADE;
    DROP TABLE IF EXISTS schema_migrations CASCADE;
  `);
  await client.end();
  console.log("reset done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
