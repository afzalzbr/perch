import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://perch:perch@localhost:5432/perch",
  },
  strict: true,
  verbose: true,
} satisfies Config;
