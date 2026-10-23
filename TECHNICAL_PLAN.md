# Perch — Technical Plan

A single-creator alternative to Linktree. One profile, one public URL, drafts & publishes, privacy-respecting daily click counts.

Design system (brand, tokens, component rules) is published at the Perch design-system artifact — tokens.json and each `project/components/<Name>/README.md` are treated as server-enforced product requirements.

## Stack

- **Framework**: Next.js 15, App Router, TypeScript, React 19
- **DB**: PostgreSQL via Drizzle ORM, hand-authored SQL migrations
- **Storage**: S3-compatible adapter (`src/lib/storage.ts`) with a filesystem-backed local fake used for dev and tests
- **Auth**: email + password (bcrypt) stored in Postgres, cookie session via `iron-session`
- **Analytics**: Cloudflare Web Analytics beacon on the public page (token from env), aggregate counts stored in Postgres
- **Tests**: Vitest for unit + integration against an isolated test DB; Playwright for end-to-end journeys (desktop + a small-viewport run)

## Routes

Server-rendered by default. Server Actions for all authenticated mutations; Route Handlers only for public endpoints that must stay outside React (click redirect, health, upload).

| Path | Purpose |
| --- | --- |
| `/` | Redirect: unauthenticated → `/sign-in`, authenticated → `/dashboard`, no profile → `/setup` |
| `/sign-in` | Email + password sign-in. Server action issues session. |
| `/setup` | First-run wizard: display name, slug (reserved during setup), initial theme. Server action creates `profile` row (one allowed in v1) with empty draft + empty published snapshot. |
| `/dashboard` | Profile completeness, published URL, last-published time, 7-day click total, Edit and View actions. |
| `/dashboard/profile` | Profile editor: avatar upload, display name, bio, theme, social, reorderable link list, phone preview. |
| `/dashboard/analytics` | 7- and 30-day totals, per-link ranking, daily trend, zero-state copy from design system. |
| `/[slug]` | **Public page.** Reads from `profiles.published_snapshot` only. 404 if slug not published yet. |
| `/go/[linkId]` | Click redirect. Looks up link in `published_snapshot`, upserts aggregate row, 302 to destination. |
| `/api/upload/avatar` | Multipart upload to storage adapter. Owner-only. |
| `/api/health` | `{ ok, db }` for ops. |
| `/sign-out` | POST → clears session, redirects. |

## Server Actions

All in `src/app/.../actions.ts`. Each runs through `requireOwner()` to confirm the session owns the profile. Zod validates. Return `{ ok: true }` or `{ error }`.

- `signInAction(email, password)` — creates session; redirects to `/dashboard` or `/setup` as needed.
- `signUpAction(email, password)` — only works while there's zero users in the DB (single-creator v1).
- `createProfileAction(slug, name)` — only works if no profile yet; reserves slug (unique + lowercase + regex-checked).
- `updateProfileAction({ displayName, bio, theme })` — updates draft fields on `profiles`, bumps `draft_updated_at`.
- `updateSocialAction(handles[])` — rewrites draft social handles.
- `uploadAvatarAction(formData)` — writes blob through storage adapter, stores key on `profiles.draft_avatar_key`.
- `createLinkAction({ label, href, description, highlight })` — appends link with next position.
- `updateLinkAction(id, patch)` — updates a draft link.
- `reorderLinksAction(ids[])` — single DB transaction updates all positions.
- `deleteLinkAction(id)` — hard-delete from draft (deleted links on `published_snapshot` continue to resolve clicks until next publish; see "Clicks" below).
- `publishProfileAction()` — within one DB tx: validates draft (<=1 highlight, >=1 link, no blocking validation errors), builds `PublishedSnapshot` JSON, writes it to `profiles.published_snapshot`, sets `published_at`, bumps `published_version`.
- `discardDraftAction()` — overwrites draft fields and link rows from the latest published snapshot.

## Data model

Three tables + the single aggregated counts table. No ClickEvent per-visitor row.

```
users
  id uuid pk
  email citext unique not null
  password_hash text not null
  created_at timestamptz not null default now()

profiles                            -- single-row in v1 (enforced in code + partial unique index below)
  id uuid pk
  user_id uuid fk users unique
  slug citext unique not null       -- regex ^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$; reserved during setup
  display_name text not null
  bio text not null default ''
  theme text not null default 'daylight'  -- 'daylight' | 'dusk' | 'paper'
  draft_avatar_key text              -- storage key; signed URL on read
  draft_updated_at timestamptz not null default now()
  published_snapshot jsonb           -- null = never published; snapshot copies everything the public page needs
  published_at timestamptz
  published_version int not null default 0
  created_at timestamptz, updated_at timestamptz

  -- v1: at most one row across the whole app
  -- enforced by:
  --   check (id = id)  -- placeholder
  --   create unique index profiles_singleton on profiles ((true))
  -- see migration file

links                                -- these are DRAFT links
  id uuid pk
  profile_id uuid fk profiles cascade
  label text not null
  href text not null                 -- normalized, https or mailto only
  description text
  highlight boolean not null default false
  position int not null              -- 0-based; monotonic within profile
  created_at timestamptz, updated_at timestamptz
  unique (profile_id, position)      -- enforced atomically on reorder

socials
  id uuid pk
  profile_id uuid fk profiles cascade
  kind text not null                 -- 'instagram' | 'youtube' | 'tiktok' | 'x' | 'github' | 'linkedin' | 'website'
  handle text not null
  href text not null                 -- normalized, https only
  position int not null
  unique (profile_id, kind)          -- one of each

click_counts
  link_id uuid not null
  day date not null                  -- creator's local day (America/Los_Angeles by default; configurable)
  referrer_category text not null    -- 'search' | 'social' | 'direct' | 'other'
  count bigint not null default 0
  primary key (link_id, day, referrer_category)
```

### Published snapshot shape

`profiles.published_snapshot` is a frozen JSON copy of exactly what the public page renders. The public page NEVER joins against the draft `links` table.

```ts
type PublishedSnapshot = {
  version: number;             // mirrors profiles.published_version
  publishedAt: string;         // ISO
  slug: string;
  displayName: string;
  bio: string;
  theme: 'daylight' | 'dusk' | 'paper';
  avatarKey: string | null;
  links: Array<{
    id: string;                // same uuid as draft row — stable across publishes
    label: string;
    href: string;
    description: string | null;
    highlight: boolean;
  }>;
  socials: Array<{ kind: SocialKind; handle: string; href: string }>;
};
```

### Lifecycle

- A link `id` is stable from first draft onward.  Clicks always key by this uuid, so analytics survive republishes and even deletes.
- When a link is deleted from draft, it stays in `published_snapshot` until the next publish. Clicks continue to count against it. On the next publish the snapshot replaces it; subsequent clicks on the retired id resolve to a 404 "Link not available."
- `click_counts` is never deleted on link delete — the user's totals survive edits.
- Hard reset: deleting a user cascades to profile → links/socials, and `click_counts` are left orphaned but harmless (keyed by link_id).

### Transaction boundaries

- `reorderLinksAction` — a single `BEGIN; UPDATE … CASE position WHEN … END; COMMIT;` with a deferred unique constraint; the atomic update rule under "DETAILED BEHAVIOR".
- `publishProfileAction` — same tx reads draft rows, assembles the snapshot, writes to `profiles`.
- Click insert — single `INSERT ... ON CONFLICT (link_id, day, referrer_category) DO UPDATE SET count = count + 1`.

## Authorization boundaries

- All server actions call `requireOwner(profileId?)`:
  - loads the session's user id,
  - fetches the single `profile` for that user,
  - throws `ForbiddenError` if no match.
- Public page and `/go/[linkId]` are the only routes that resolve state without a session.
- `/go/[linkId]` only resolves against the `published_snapshot`; a link id that exists in draft but has never been published 404s. This is the "count a click only after resolving an active published link" rule.

## State transitions

```
Profile      : null → draft (setup) → draft+published (first publish) → draft ahead of published (edit) → in sync (publish)
Link (draft) : created → edited → reordered → deleted
Snapshot     : null → v1 → v2 … (append-only versions; previous snapshots not retained in v1)
```

- Only the owner can trigger a profile transition.
- `publish` is reversible only in the sense that the owner can edit and publish again; previous snapshots are not restored.

## External adapters

### Storage (`src/lib/storage.ts`)

Narrow interface `{ put, getSignedUrl, delete }`. Two implementations:

- `LocalStorage` (default in dev + test) — writes under `./uploads/`, serves them from `/uploads/*`.
- `S3Storage` — uses `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`.

Selected by `STORAGE_DRIVER` env.

### Cloudflare Web Analytics

Beacon script tag emitted on `[slug]/page.tsx` only when `CLOUDFLARE_WEB_ANALYTICS_TOKEN` is set. No server-side proxying, no visitor identifiers stored.

## Click handling

1. Visitor hits `/go/[linkId]?r=<ref>` (public-page links go through this).
2. Load `profiles.published_snapshot` referencing `linkId`; if not present or `href` normalization fails, 404.
3. Classify referrer with `classifyReferrer(ref)` → `search | social | direct | other`. No full referrer kept.
4. UPSERT `(link_id, day, referrer_category)` with `count + 1` where `day = currentDateInProfileTz()`.
5. 302 to the destination.

## Security

- Password hashed with bcrypt (12 rounds).
- Session cookie: httpOnly, secure in prod, SameSite=Lax, 7-day sliding window.
- CSRF: Server Actions are protected by Next.js's built-in origin check; Route Handlers use a double-submit CSRF token where state-changing.
- All untrusted inputs validated server-side with Zod. URL normalization rejects `javascript:`, `data:`, `file:`, etc.
- Avatars: content-type sniffed, size-limited (2 MB), served via time-limited signed URLs.
- Public page escapes everything by default; bio stored as plain text.
- Rate limiting on sign-in and `/go/[linkId]` with an in-memory token bucket (per-IP).

## Tests

- **Unit** (Vitest):
  - `normalize-url.test.ts` — accepts https/http/mailto, rejects dangerous protocols, normalizes casing, strips trailing dots, handles IDN.
  - `slug.test.ts` — reserved slugs rejected, length/char rules enforced.
  - `referrer.test.ts` — classification table.
  - `authorization.test.ts` — `requireOwner` denies when session doesn't match profile, allows when it does.
  - `publish.test.ts` — publish refuses when >1 highlighted or 0 links; snapshot content matches draft.
- **Integration** (Vitest + real test DB):
  - `links.test.ts` — reorder enforces positions atomically; delete leaves click_counts intact.
  - `clicks.test.ts` — upsert increments without visitor identity leaked anywhere.
  - `storage.test.ts` — put/getSignedUrl round-trip on the local adapter.
- **E2E** (Playwright):
  - `journey-1-publish.spec.ts` — sign up, setup, add three links, reorder, preview, publish, visit public URL.
  - `journey-2-edit.spec.ts` — edit a link, confirm public URL unchanged, re-publish, confirm change.
  - `journey-3-visitor-click.spec.ts` — click a link, see totals move in dashboard analytics.
  - `mobile.spec.ts` — journey 1 at 390×844.

Single command: `pnpm test` (unit + integration). `pnpm e2e` for Playwright.

## Deliverables

- Working app under `src/`.
- Migrations under `drizzle/`.
- Seed script `scripts/seed.ts` with: one creator, three real links incl. one featured, one archived (empty state) scenario toggleable via flag, three days of synthetic click_counts.
- `.env.example`, README, this plan.
