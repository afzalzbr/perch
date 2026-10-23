-- Perch initial schema.
-- Hand-authored migration. See TECHNICAL_PLAN.md for the data model.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  password_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS users_email_lower_uniq ON users (lower(email));

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slug text NOT NULL,
  display_name text NOT NULL,
  bio text NOT NULL DEFAULT '',
  theme text NOT NULL DEFAULT 'daylight',
  draft_avatar_key text,
  draft_updated_at timestamptz NOT NULL DEFAULT now(),
  published_snapshot jsonb,
  published_at timestamptz,
  published_version integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT profiles_theme_check CHECK (theme IN ('daylight','dusk','paper')),
  CONSTRAINT profiles_slug_check CHECK (slug ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$')
);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_user_uniq ON profiles (user_id);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_slug_lower_uniq ON profiles (lower(slug));
-- Single-creator v1: at most one profile row in the whole database.
CREATE UNIQUE INDEX IF NOT EXISTS profiles_singleton ON profiles ((TRUE));

CREATE TABLE IF NOT EXISTS links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  label text NOT NULL,
  href text NOT NULL,
  description text,
  highlight boolean NOT NULL DEFAULT false,
  position integer NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS links_profile_idx ON links (profile_id);
-- Position is unique within a profile. Enforced DEFERRABLE so a reorder can swap
-- positions inside a single transaction without a temporary gap.
ALTER TABLE links
  DROP CONSTRAINT IF EXISTS links_profile_position_uniq;
ALTER TABLE links
  ADD CONSTRAINT links_profile_position_uniq
    UNIQUE (profile_id, position) DEFERRABLE INITIALLY IMMEDIATE;

CREATE TABLE IF NOT EXISTS socials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind text NOT NULL,
  handle text NOT NULL,
  href text NOT NULL,
  position integer NOT NULL
);
CREATE INDEX IF NOT EXISTS socials_profile_idx ON socials (profile_id);
CREATE UNIQUE INDEX IF NOT EXISTS socials_profile_kind_uniq ON socials (profile_id, kind);

CREATE TABLE IF NOT EXISTS click_counts (
  link_id uuid NOT NULL,
  day date NOT NULL,
  referrer_category text NOT NULL,
  count bigint NOT NULL DEFAULT 0,
  PRIMARY KEY (link_id, day, referrer_category),
  CONSTRAINT click_counts_cat_check CHECK (referrer_category IN ('search','social','direct','other'))
);
CREATE INDEX IF NOT EXISTS click_counts_link_idx ON click_counts (link_id);
CREATE INDEX IF NOT EXISTS click_counts_day_idx ON click_counts (day);
