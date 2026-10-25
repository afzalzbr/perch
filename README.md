# Perch

A single-creator alternative to Linktree. One profile, one public URL, a short list of links, and privacy-respecting daily click counts.

The visual language, component rules, and tokens come from the Perch design-system artifact at
<https://claude.ai/artifact/9qaG8VjMAaWTsUNzfchoSH> — in particular `project/README.md`, `project/tokens.json`, and each `project/components/<Name>/README.md`. Those component rules are treated as server-enforced product requirements (one featured link per page, drag + up/down reorder, snapshot-based publish, etc.), not visual suggestions.

See [`TECHNICAL_PLAN.md`](./TECHNICAL_PLAN.md) for the architecture, data model, state transitions, and test strategy.

---

## Prerequisites

- Node.js 20+ (tested on 22)
- PostgreSQL 14+ (tested on 16)
- A local filesystem for uploads in dev, or any S3-compatible bucket in prod

## Quick start

```bash
# 1. Install
npm install --legacy-peer-deps

# 2. Create the databases
createdb perch
createdb perch_test     # used by the Vitest integration suite

# 3. Set env vars (see .env.example)
cp .env.example .env.local
# edit DATABASE_URL and SESSION_SECRET (must be >= 32 chars)

# 4. Apply migrations
DATABASE_URL=postgres://perch:perch@localhost:5432/perch npm run db:migrate
DATABASE_URL=postgres://perch:perch@localhost:5432/perch_test npm run db:migrate

# 5. Seed demo data (one creator, three published links, three days of clicks)
DATABASE_URL=postgres://perch:perch@localhost:5432/perch npm run db:seed

# 6. Run
npm run dev          # http://localhost:3000
```

The seed script prints the demo credentials — the default is `alex@example.com` / `superSecret1`. The public page is served at `/<slug>` (default `/alex`).

## Environment variables

See `.env.example`. The required ones:

| Var | Purpose |
| --- | --- |
| `DATABASE_URL` | Postgres connection string. |
| `TEST_DATABASE_URL` | Postgres for the Vitest integration suite. |
| `SESSION_SECRET` | 32+ character secret used to HMAC the session cookie and sign local upload URLs. |
| `STORAGE_DRIVER` | `local` (dev default, writes under `./uploads/`) or `s3`. |
| `UPLOADS_DIR` | Where the local adapter stores files. |
| `S3_*` | Required only when `STORAGE_DRIVER=s3`. See `.env.example`. |
| `PERCH_PUBLIC_ORIGIN` | Public origin used in share URLs and to detect self-referrer. |
| `PERCH_TZ` | IANA timezone the creator's analytics days are rolled in. |
| `CLOUDFLARE_WEB_ANALYTICS_TOKEN` | Optional. When set, the beacon is emitted on the public page. |

## npm scripts

| Script | What it does |
| --- | --- |
| `npm run dev` | Start the Next.js dev server. |
| `npm run build` | Production build. |
| `npm start` | Start the production server. |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm run db:migrate` | Apply SQL migrations in `drizzle/`. |
| `npm run db:reset` | Drop all app tables (dangerous — dev only). |
| `npm run db:seed` | Seed one creator + published page + demo analytics. |
| `npm test` | Vitest unit + integration suite against `TEST_DATABASE_URL`. |
| `npm run e2e` | Playwright end-to-end suite (needs chromium — see below). |
| `npm run e2e:install` | `playwright install chromium` (first run only). |

## Database and migrations

- Migrations live in `drizzle/` as hand-authored SQL and are applied in filename order.
- `scripts/migrate.ts` is a tiny runner that records applied files in a `schema_migrations` table — no Drizzle Kit CLI dependency at runtime.
- The schema is also mirrored as a Drizzle `pgTable` definition in `src/db/schema.ts` so queries get types; a `drizzle.config.ts` is included for anyone who prefers to generate migrations with Drizzle Kit instead.
- `src/db/index.ts` auto-detects the driver from the connection string: a `*.neon.tech` host uses `@neondatabase/serverless` (HTTPS/WebSocket), everything else uses `pg`. Force one with `PERCH_DB_DRIVER=neon-serverless|node-postgres`. Migrations and the seed script prefer `DATABASE_URL_UNPOOLED` when present, per [Neon's connection guidance](https://neon.com/docs/connect/choose-connection.md).

### Setting up on Neon

```bash
npm i -g neon@latest
neon login                                   # or export NEON_API_KEY=...
neon init -y --org-id <org> --project-id <project> \
            --branch production --services postgres
neon deploy                                  # pulls DATABASE_URL + DATABASE_URL_UNPOOLED into .env.local
node --env-file=.env.local --import tsx scripts/migrate.ts
node --env-file=.env.local --import tsx scripts/seed.ts    # optional
npm run build
node --env-file=.env.local node_modules/.bin/next start
```

If the host only allows HTTPS egress (no raw TCP on 5432), the driver reads `HTTPS_PROXY` and tunnels the WebSocket through it.

## Testing

```bash
# Vitest — unit + integration against TEST_DATABASE_URL
npm test

# Playwright — end-to-end + mobile viewport
TEST_DATABASE_URL=postgres://perch:perch@localhost:5432/perch_test \
  npm run db:reset && npm run db:migrate
npm run e2e
```

The E2E suite uses a test-only route `POST /api/test/seed` guarded by `PERCH_TEST_MODE=1` (set in `playwright.config.ts`) to reset state and sign the session in without going through the UI sign-up flow each time.

### Running Playwright inside a container with a pre-installed browser

If your environment ships Chromium at a non-standard path (e.g. `/opt/pw-browsers/chromium-<version>/chrome-linux/chrome`), set `PW_CHROMIUM_PATH` and the config will pick it up via `launchOptions.executablePath`.

## Deployment

Perch is a plain Next.js 15 app. Any Node 20+ host works. A minimal production flow:

1. Provision Postgres and run migrations: `DATABASE_URL=… npm run db:migrate`.
2. Set `STORAGE_DRIVER=s3` and the matching `S3_*` env vars.
3. Set `SESSION_SECRET` to a long random value and `PERCH_PUBLIC_ORIGIN=https://your-domain`.
4. `npm run build && npm start`.
5. (Optional) Set `CLOUDFLARE_WEB_ANALYTICS_TOKEN` to opt into the public-page beacon.

### Backup and restore

Everything that matters lives in Postgres plus the object store.

- Postgres: `pg_dump $DATABASE_URL > perch.sql`; restore with `psql $DATABASE_URL < perch.sql`.
- Object store (S3): mirror the bucket with `aws s3 sync s3://perch-uploads /backup/perch-uploads`. For the local driver, back up `UPLOADS_DIR`.
- Avatars that have been deleted from the UI stay in the bucket until a lifecycle rule removes them (the app never retains the key once removed).

Nothing else needs backup: `click_counts` are aggregates (no visitor identity), `click_counts` rows survive link deletes so analytics is preserved across edits.

## Security decisions

- **Visitor privacy.** No per-visit row. Clicks are stored only as `(link_id, local-day, coarse-referrer, count)`. The referrer is classified into `search | social | direct | other` and nothing else of it is kept. No IP, no user agent, no cookie identifier.
- **Session cookies.** HttpOnly, `SameSite=Lax`. The `Secure` flag is set when `PERCH_PUBLIC_ORIGIN` begins with `https://` so cookies work both in local HTTP dev and HTTPS prod without a config switch.
- **CSRF.** State-changing routes are React Server Actions, which Next.js protects with an origin check. The one state-changing public route handler (`/sign-out`) is POST-only.
- **URL safety.** `src/lib/normalize-url.ts` only allows `http:`, `https:`, and `mailto:` for links. Social URLs are additionally host-checked against the platform's known hostnames.
- **Secrets.** No secrets are read in client components. `src/lib/logger.ts` redacts common sensitive keys (`password`, `token`, `authorization`, `cookie`, …) before writing structured log lines.
- **Rate limits.** `src/lib/rate-limit.ts` is a per-process token bucket applied to sign-in (5/min/IP) and `/go/[linkId]` (20/min/IP/link). Replace with Redis for horizontal scale.
- **Uploads.** Avatars are size-capped at 2 MB and typed-checked (PNG/JPEG/WEBP/GIF). The local adapter signs short-lived URLs with an HMAC; S3 uses signed GETs with the AWS SDK.
- **Scope of trust.** Visitor pages render exclusively from the frozen `profiles.published_snapshot` JSONB column. A link id that only exists in draft 404s on `/go/[linkId]` — the "resolve an active published link before counting a click" rule.

## Known limitations

- Single-creator by design (v1). A partial unique index enforces that only one `profiles` row can exist.
- Sign-up only works while there are zero users in the database. There is no email verification yet (the stated audience is one creator who owns the DB).
- Published snapshots are not retained version-over-version — only the current one is kept.
- Click aggregation is per-day in the configured timezone; there is no hourly dimension.
- The S3 adapter does not do server-side encryption or lifecycle policies — set those on the bucket itself.
- Rate limiter is in-process. Behind a load balancer this won't share state across instances.
- Playwright's "edit → publish" journey and the mobile smoke test are included in `tests/e2e/` and run against a built app; set `PW_CHROMIUM_PATH` if your environment has a pre-installed Chromium at a non-standard location.

## Repository layout

```
src/
  app/                 # Next.js App Router routes
    [slug]/            # public page
    dashboard/         # owner-only surfaces (overview, profile editor, analytics)
    sign-in/, setup/   # auth flows
    api/, go/, uploads/ # route handlers (health, click redirect, signed-URL serve, test-only seed)
  components/          # Perch UI components matching the design-system contract
  db/                  # Drizzle schema + pool
  domain/              # business logic (publish/draft, links, clicks, auth)
  lib/                 # URL normalization, slug rules, referrer classifier, storage, session, rate limit, logger, time
drizzle/               # hand-authored SQL migrations
scripts/               # migrate.ts, reset-db.ts, seed.ts
tests/
  unit/, integration/  # Vitest
  e2e/                 # Playwright (desktop + mobile)
TECHNICAL_PLAN.md      # architecture + data model + state transitions
```
