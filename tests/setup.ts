import { execSync } from "node:child_process";

process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ?? "postgres://perch:perch@localhost:5432/perch_test";
process.env.SESSION_SECRET =
  process.env.SESSION_SECRET ?? "test-session-secret-must-be-at-least-32-chars-long!!";
process.env.STORAGE_DRIVER = process.env.STORAGE_DRIVER ?? "local";
process.env.UPLOADS_DIR = process.env.UPLOADS_DIR ?? "./uploads-test";
process.env.PERCH_TZ = process.env.PERCH_TZ ?? "UTC";

// Ensure the schema exists in the test DB. One-time per process.
try {
  execSync(`psql "${process.env.DATABASE_URL}" -c "SELECT 1 FROM users LIMIT 1" > /dev/null 2>&1`);
} catch {
  execSync(`npx tsx scripts/migrate.ts`, { env: { ...process.env }, stdio: "inherit" });
}
