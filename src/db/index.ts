import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

declare global {
  // eslint-disable-next-line no-var
  var __perchPool: pg.Pool | undefined;
}

function makePool(): pg.Pool {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return new Pool({
    connectionString: url,
    max: 10,
    idleTimeoutMillis: 10_000,
  });
}

export function getPool(): pg.Pool {
  if (!globalThis.__perchPool) globalThis.__perchPool = makePool();
  return globalThis.__perchPool!;
}

let _db: NodePgDatabase<typeof schema> | undefined;

export function getDb(): NodePgDatabase<typeof schema> {
  if (!_db) _db = drizzle(getPool(), { schema });
  return _db;
}

export const db = new Proxy({} as NodePgDatabase<typeof schema>, {
  get(_target, prop) {
    return (getDb() as unknown as Record<string, unknown>)[prop as string];
  },
});

export type Database = NodePgDatabase<typeof schema>;
export { schema };
