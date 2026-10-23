import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  jsonb,
  date,
  bigint,
  uniqueIndex,
  index,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: text("email").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    emailLower: uniqueIndex("users_email_lower_uniq").on(sql`lower(${t.email})`),
  })
);

export type SocialKind =
  | "instagram"
  | "youtube"
  | "tiktok"
  | "x"
  | "github"
  | "linkedin"
  | "website";

export type Theme = "daylight" | "dusk" | "paper";

export type PublishedLink = {
  id: string;
  label: string;
  href: string;
  description: string | null;
  highlight: boolean;
};

export type PublishedSocial = {
  kind: SocialKind;
  handle: string;
  href: string;
};

export type PublishedSnapshot = {
  version: number;
  publishedAt: string;
  slug: string;
  displayName: string;
  bio: string;
  theme: Theme;
  avatarKey: string | null;
  links: PublishedLink[];
  socials: PublishedSocial[];
};

export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    slug: text("slug").notNull(),
    displayName: text("display_name").notNull(),
    bio: text("bio").notNull().default(""),
    theme: text("theme").$type<Theme>().notNull().default("daylight"),
    draftAvatarKey: text("draft_avatar_key"),
    draftUpdatedAt: timestamp("draft_updated_at", { withTimezone: true }).notNull().defaultNow(),
    publishedSnapshot: jsonb("published_snapshot").$type<PublishedSnapshot | null>(),
    publishedAt: timestamp("published_at", { withTimezone: true }),
    publishedVersion: integer("published_version").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdUniq: uniqueIndex("profiles_user_uniq").on(t.userId),
    slugUniq: uniqueIndex("profiles_slug_lower_uniq").on(sql`lower(${t.slug})`),
    // v1 singleton: at most one profile row in the whole database.
    singleton: uniqueIndex("profiles_singleton")
      .on(sql`(TRUE)`),
    themeCheck: check("profiles_theme_check", sql`${t.theme} in ('daylight','dusk','paper')`),
    slugCheck: check(
      "profiles_slug_check",
      sql`${t.slug} ~ '^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$'`
    ),
  })
);

export const links = pgTable(
  "links",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    href: text("href").notNull(),
    description: text("description"),
    highlight: boolean("highlight").notNull().default(false),
    position: integer("position").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    profilePosUniq: uniqueIndex("links_profile_position_uniq")
      .on(t.profileId, t.position),
    byProfile: index("links_profile_idx").on(t.profileId),
  })
);

export const socials = pgTable(
  "socials",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    profileId: uuid("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
    kind: text("kind").$type<SocialKind>().notNull(),
    handle: text("handle").notNull(),
    href: text("href").notNull(),
    position: integer("position").notNull(),
  },
  (t) => ({
    profileKindUniq: uniqueIndex("socials_profile_kind_uniq").on(t.profileId, t.kind),
    byProfile: index("socials_profile_idx").on(t.profileId),
  })
);

export const clickCounts = pgTable(
  "click_counts",
  {
    linkId: uuid("link_id").notNull(),
    day: date("day").notNull(),
    referrerCategory: text("referrer_category").notNull(),
    count: bigint("count", { mode: "number" }).notNull().default(0),
  },
  (t) => ({
    pk: uniqueIndex("click_counts_pk").on(t.linkId, t.day, t.referrerCategory),
    byLink: index("click_counts_link_idx").on(t.linkId),
    byDay: index("click_counts_day_idx").on(t.day),
    categoryCheck: check(
      "click_counts_cat_check",
      sql`${t.referrerCategory} in ('search','social','direct','other')`
    ),
  })
);

export type User = typeof users.$inferSelect;
export type Profile = typeof profiles.$inferSelect;
export type Link = typeof links.$inferSelect;
export type Social = typeof socials.$inferSelect;
export type ClickCount = typeof clickCounts.$inferSelect;
