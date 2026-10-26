"use client";

import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { Field } from "@/components/Field";
import { PrimaryButton } from "@/components/PrimaryButton";
import { SecondaryButton } from "@/components/SecondaryButton";
import { Badge } from "@/components/Badge";
import { Flash } from "@/components/Flash";
import { PhonePreview } from "@/components/PhonePreview";
import { SocialRow } from "@/components/SocialRow";
import type { SocialKind, Theme } from "@/db/schema";
import {
  updateProfileAction,
  createLinkAction,
  updateLinkAction,
  deleteLinkAction,
  moveLinkAction,
  upsertSocialAction,
  deleteSocialAction,
  publishAction,
  discardDraftAction,
  uploadAvatarAction,
  removeAvatarAction,
  type ActionResult,
} from "./actions";

export type EditorLink = {
  id: string;
  label: string;
  href: string;
  description: string | null;
  highlight: boolean;
  position: number;
};

export type EditorSocial = {
  id: string;
  kind: SocialKind;
  handle: string;
  href: string;
};

const SOCIAL_OPTIONS: Array<{ kind: SocialKind; label: string }> = [
  { kind: "instagram", label: "Instagram" },
  { kind: "youtube", label: "YouTube" },
  { kind: "tiktok", label: "TikTok" },
  { kind: "x", label: "X" },
  { kind: "github", label: "GitHub" },
  { kind: "linkedin", label: "LinkedIn" },
  { kind: "website", label: "Website" },
];

const EMPTY_RESULT: ActionResult = { ok: true };

export function EditorClient({
  profile,
  links,
  socials,
}: {
  profile: {
    id: string;
    slug: string;
    displayName: string;
    bio: string;
    theme: Theme;
    avatarUrl: string | null;
    publishedVersion: number;
    hasPublished: boolean;
    draftAhead: boolean;
  };
  links: EditorLink[];
  socials: EditorSocial[];
}) {
  const [localProfile, setLocalProfile] = useState({
    displayName: profile.displayName,
    bio: profile.bio,
    theme: profile.theme,
  });

  return (
    <>
      <div className="editor-grid">
        <nav className="editor-rail" aria-label="Sections">
          <EditorRailLink num="01" href="#profile" label="Profile" />
          <EditorRailLink num="02" href="#avatar" label="Avatar" />
          <EditorRailLink num="03" href="#links" label="Links" count={links.length} />
          <EditorRailLink num="04" href="#social" label="Social" count={socials.length} />
          <EditorRailLink num="05" href="#publish" label="Publish" />
        </nav>

        <div>
          <ProfileSpread
            profile={profile}
            onLocalChange={(next) => setLocalProfile((cur) => ({ ...cur, ...next }))}
          />
          <AvatarSpread current={profile.avatarUrl} />
          <LinksSpread links={links} />
          <SocialsSpread socials={socials} />
          <PublishSpread profile={profile} />
        </div>

        <aside className="editor-right">
          <PhonePreview
            name={localProfile.displayName}
            slug={profile.slug}
            bio={localProfile.bio}
            avatarUrl={profile.avatarUrl}
            theme={localProfile.theme}
            links={links.map((l) => ({
              label: l.label,
              href: l.href,
              description: l.description,
              highlight: l.highlight,
            }))}
            social={socials.map((s) => ({ kind: s.kind, handle: s.handle, href: s.href }))}
          />
        </aside>
      </div>

      <PublishBar profile={profile} />
    </>
  );
}

function EditorRailLink({ num, href, label, count }: { num: string; href: string; label: string; count?: number }) {
  return (
    <a className="editor-rail__link" href={href}>
      <span className="editor-rail__num">{num}</span>
      <span style={{ display: "inline-flex", gap: 6, alignItems: "baseline" }}>
        <span>{label}</span>
        {typeof count === "number" ? (
          <span style={{ color: "var(--color-ink-muted)", fontWeight: 500, fontSize: 11 }}>{count}</span>
        ) : null}
      </span>
    </a>
  );
}

/* ------------------- Spreads ------------------- */

function SpreadHeader({ num, title, meta }: { num: string; title: React.ReactNode; meta?: React.ReactNode }) {
  return (
    <header className="spread__header">
      <span className="spread__num" aria-hidden="true">{num}</span>
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        <h2 className="spread__title">{title}</h2>
        {meta ? <p className="spread__meta">{meta}</p> : null}
      </div>
    </header>
  );
}

function ProfileSpread({
  profile,
  onLocalChange,
}: {
  profile: { displayName: string; bio: string; theme: Theme };
  onLocalChange: (next: Partial<{ displayName: string; bio: string; theme: Theme }>) => void;
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(updateProfileAction, EMPTY_RESULT);
  const fieldErrors = state.ok ? undefined : state.fieldErrors;
  return (
    <section className="spread" id="profile">
      <SpreadHeader num="01" title="Profile" meta="How you introduce yourself at the top of the page." />
      <form action={action} className="spread__body">
        {!state.ok ? <Flash tone="danger">{state.message}</Flash> : state.flash ? <Flash tone="success">{state.flash}</Flash> : null}
        <Field
          label="Display name"
          name="displayName"
          defaultValue={profile.displayName}
          required
          maxLength={60}
          error={fieldErrors?.displayName}
          onChange={(e) => onLocalChange({ displayName: e.currentTarget.value })}
        />
        <Field
          label="Short bio"
          name="bio"
          defaultValue={profile.bio}
          maxLength={160}
          multiline
          hint="Up to 160 characters."
          error={fieldErrors?.bio}
          onChange={(e) => onLocalChange({ bio: (e.currentTarget as HTMLTextAreaElement).value })}
          rows={3}
        />
        <ThemeChooser name="theme" defaultValue={profile.theme} onChange={(t) => onLocalChange({ theme: t })} />
        <div className="app-row">
          <PrimaryButton type="submit" disabled={pending} label={pending ? "Saving…" : "Save draft"} size="sm" />
        </div>
      </form>
    </section>
  );
}

function ThemeChooser({
  name,
  defaultValue,
  onChange,
}: {
  name: string;
  defaultValue: Theme;
  onChange: (t: Theme) => void;
}) {
  const [value, setValue] = useState<Theme>(defaultValue);
  useEffect(() => onChange(value), [value, onChange]);
  const options: Array<{ id: Theme; label: string; sub: string }> = [
    { id: "daylight", label: "Daylight", sub: "Warm paper, soft contrast." },
    { id: "dusk", label: "Dusk", sub: "Dark warm, forest brand." },
    { id: "paper", label: "Paper", sub: "Bright, high contrast." },
  ];
  return (
    <fieldset style={{ border: 0, padding: 0, display: "flex", flexDirection: "column", gap: "var(--space-2)" }}>
      <legend className="perch-field__label">Theme</legend>
      <div className="app-row" role="radiogroup" aria-label="Theme">
        {options.map((o) => {
          const selected = value === o.id;
          return (
            <label
              key={o.id}
              style={{
                display: "flex",
                flex: 1,
                minWidth: 140,
                gap: 8,
                alignItems: "flex-start",
                padding: "var(--space-3)",
                borderRadius: "var(--radius-md)",
                border: `1px solid ${selected ? "var(--color-brand-500)" : "var(--color-border-soft)"}`,
                background: selected ? "var(--color-brand-100)" : "var(--color-surface-raised)",
                cursor: "pointer",
              }}
            >
              <input
                type="radio"
                name={name}
                value={o.id}
                checked={selected}
                onChange={() => setValue(o.id)}
                style={{ marginTop: 4 }}
              />
              <span style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <strong style={{ fontSize: 14 }}>{o.label}</strong>
                <span style={{ fontSize: 12, color: "var(--color-ink-secondary)" }}>{o.sub}</span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

/* ------------------- Avatar ------------------- */

function AvatarSpread({ current }: { current: string | null }) {
  const [state, uploadAction, pending] = useActionState<ActionResult, FormData>(uploadAvatarAction, EMPTY_RESULT);
  const [_removeState, removeAction, removing] = useActionState<ActionResult, FormData>(removeAvatarAction, EMPTY_RESULT);
  const inputRef = useRef<HTMLInputElement | null>(null);
  return (
    <section className="spread" id="avatar">
      <SpreadHeader num="02" title="Avatar" meta="One source upload, three display sizes. PNG, JPEG, WEBP, or GIF." />
      <div className="spread__body">
        {!state.ok ? <Flash tone="danger">{state.message}</Flash> : state.flash ? <Flash tone="success">{state.flash}</Flash> : null}
        <div className="app-row" style={{ alignItems: "center", gap: "var(--space-4)" }}>
          <span className="perch-avatar perch-avatar--lg perch-avatar--ring" role="img" aria-label="Current avatar">
            {current ? <img src={current} alt="" /> : <span aria-hidden="true">·</span>}
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", flex: 1, minWidth: 0 }}>
            <div className="app-row" style={{ gap: "var(--space-2)" }}>
              <form action={uploadAction} className="app-row" style={{ gap: "var(--space-2)" }}>
                <input ref={inputRef} name="avatar" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required />
                <PrimaryButton type="submit" disabled={pending} label={pending ? "Uploading…" : "Upload"} size="sm" />
              </form>
              {current ? (
                <form action={removeAction}>
                  <SecondaryButton type="submit" tone="danger" size="sm" disabled={removing} label="Remove" />
                </form>
              ) : null}
            </div>
            <span style={{ fontSize: 12, color: "var(--color-ink-muted)" }}>
              2 MB max. Visitors see a 96px round. Owners see 56px.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------- Links ------------------- */

function LinksSpread({ links }: { links: EditorLink[] }) {
  const [addState, addAction, addPending] = useActionState<ActionResult, FormData>(createLinkAction, EMPTY_RESULT);
  const [editingId, setEditingId] = useState<string | null>(null);
  const highlightCount = links.filter((l) => l.highlight).length;
  const formRef = useRef<HTMLFormElement | null>(null);

  useEffect(() => {
    if (addState.ok && addState.flash) formRef.current?.reset();
  }, [addState]);

  const meta =
    highlightCount > 1
      ? "Only one featured link is allowed — remove an extra to publish."
      : links.length === 0
      ? "Your public page needs at least one link before you can publish."
      : "Drag or use the arrows to reorder. One featured link per page.";

  return (
    <section className="spread" id="links">
      <SpreadHeader
        num="03"
        title={
          <>
            Links
            <Badge
              label={`${links.length} in draft`}
              tone={links.length === 0 ? "neutral" : "brand"}
            />
          </>
        }
        meta={meta}
      />

      <div className="spread__body">
        {links.length === 0 ? (
          <div className="app-empty">
            <h3 className="app-empty__title">No links yet.</h3>
            <p className="app-empty__body">
              Add the first link below — your public page needs at least one before you can publish.
            </p>
          </div>
        ) : (
          <ol className="app-draft-list" aria-label="Links in order">
            {links.map((l, i) => (
              <LinkRow
                key={l.id}
                link={l}
                index={i}
                total={links.length}
                editing={editingId === l.id}
                onEdit={() => setEditingId(l.id)}
                onCancel={() => setEditingId(null)}
              />
            ))}
          </ol>
        )}

        <form ref={formRef} action={addAction} className="app-stack" aria-busy={addPending}>
          <h3 className="app-section-head">Add a link</h3>
          {!addState.ok ? <Flash tone="danger">{addState.message}</Flash> : null}
        <Field label="Label" name="label" required maxLength={60} error={addState.ok ? undefined : addState.fieldErrors?.Label || addState.fieldErrors?.label} />
        <Field
          label="Destination URL"
          name="href"
          required
          type="url"
          hint="https://… or mailto:…"
          error={addState.ok ? undefined : addState.fieldErrors?.href}
        />
        <Field label="Description" name="description" maxLength={120} hint="Optional — a sentence of context." />
        <label className="app-row" style={{ gap: 8, alignItems: "center" }}>
          <input type="checkbox" name="highlight" disabled={highlightCount >= 1} />
          <span style={{ fontSize: 13 }}>Feature this link</span>
          {highlightCount >= 1 ? <Badge label="Featured taken" tone="warning" /> : null}
        </label>
          <div className="app-row">
            <PrimaryButton type="submit" disabled={addPending} label={addPending ? "Adding…" : "Add link"} size="sm" />
          </div>
        </form>
      </div>
    </section>
  );
}

function LinkRow({
  link,
  index,
  total,
  editing,
  onEdit,
  onCancel,
}: {
  link: EditorLink;
  index: number;
  total: number;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
}) {
  const [editState, editAction, editing_pending] = useActionState<ActionResult, FormData>(updateLinkAction, EMPTY_RESULT);
  const [, deleteAction, deletingPending] = useActionState<ActionResult, FormData>(deleteLinkAction, EMPTY_RESULT);
  const [, moveAction] = useActionState<ActionResult, FormData>(moveLinkAction, EMPTY_RESULT);
  return (
    <li className="app-draft-row">
      <div className="app-draft-row__handle" aria-label="Reorder">
        <form action={moveAction}>
          <input type="hidden" name="linkId" value={link.id} />
          <input type="hidden" name="direction" value="up" />
          <button type="submit" disabled={index === 0} aria-label="Move up" title="Move up">
            ↑
          </button>
        </form>
        <form action={moveAction}>
          <input type="hidden" name="linkId" value={link.id} />
          <input type="hidden" name="direction" value="down" />
          <button type="submit" disabled={index === total - 1} aria-label="Move down" title="Move down">
            ↓
          </button>
        </form>
      </div>
      <div className="app-draft-row__body">
        <div className="app-draft-row__title">
          <div className="app-draft-row__title-text">
            {link.highlight ? <Badge tone="brand" label="Featured" /> : null} <strong>{link.label}</strong>
            <div className="perch-link-card__host" style={{ marginTop: 2 }}>
              {safeHostname(link.href)}
            </div>
          </div>
          {!editing ? (
            <div className="app-draft-row__row-actions">
              <SecondaryButton type="button" size="sm" label="Edit" onClick={onEdit} />
              <form action={deleteAction} onSubmit={confirmSubmit(`Delete "${link.label}"?`)}>
                <input type="hidden" name="linkId" value={link.id} />
                <SecondaryButton type="submit" tone="danger" size="sm" disabled={deletingPending} label="Delete" />
              </form>
            </div>
          ) : null}
        </div>
        {editing ? (
          <form action={editAction} className="app-stack" aria-busy={editing_pending}>
            <input type="hidden" name="linkId" value={link.id} />
            {!editState.ok ? <Flash tone="danger">{editState.message}</Flash> : null}
            <div className="app-draft-row__fields">
              <Field label="Label" name="label" required defaultValue={link.label} maxLength={60} error={editState.ok ? undefined : editState.fieldErrors?.Label || editState.fieldErrors?.label} />
              <Field label="Destination URL" name="href" required type="url" defaultValue={link.href} error={editState.ok ? undefined : editState.fieldErrors?.href} />
            </div>
            <Field label="Description" name="description" maxLength={120} defaultValue={link.description ?? ""} />
            <label className="app-row" style={{ gap: 8, alignItems: "center" }}>
              <input type="checkbox" name="highlight" defaultChecked={link.highlight} />
              <span style={{ fontSize: 13 }}>Feature this link</span>
            </label>
            <div className="app-row">
              <PrimaryButton type="submit" disabled={editing_pending} label={editing_pending ? "Saving…" : "Save link"} size="sm" />
              <SecondaryButton type="button" size="sm" label="Cancel" onClick={onCancel} />
            </div>
          </form>
        ) : null}
      </div>
    </li>
  );
}

function safeHostname(href: string): string {
  try {
    const u = new URL(href);
    if (u.protocol === "mailto:") return u.pathname;
    return u.hostname + u.pathname.replace(/\/$/, "");
  } catch {
    return href;
  }
}

function confirmSubmit(message: string) {
  return (e: FormEvent<HTMLFormElement>) => {
    if (typeof window !== "undefined" && !window.confirm(message)) {
      e.preventDefault();
    }
  };
}

/* ------------------- Socials ------------------- */

function SocialsSpread({ socials }: { socials: EditorSocial[] }) {
  const [addState, addAction, addPending] = useActionState<ActionResult, FormData>(upsertSocialAction, EMPTY_RESULT);
  const [, deleteAction] = useActionState<ActionResult, FormData>(deleteSocialAction, EMPTY_RESULT);
  const takenKinds = new Set(socials.map((s) => s.kind));
  const availableOption = SOCIAL_OPTIONS.find((o) => !takenKinds.has(o.kind));
  return (
    <section className="spread" id="social">
      <SpreadHeader
        num="04"
        title="Social"
        meta={`Up to ${SOCIAL_OPTIONS.length} platforms · ${socials.length} added. Optional — the row simply doesn't render when empty.`}
      />
      <div className="spread__body">
        {socials.length === 0 ? null : (
          <ul className="social-list" aria-label="Social handles">
            {socials.map((s) => (
              <li key={s.id} className="social-list__item">
                <span className="social-list__icon" aria-hidden="true">
                  <SocialRow handles={[{ kind: s.kind, handle: s.handle, href: s.href }]} />
                </span>
                <span className="social-list__text">
                  <strong style={{ textTransform: "capitalize" }}>{s.kind}</strong>
                  <span className="perch-link-card__host">{s.handle}</span>
                </span>
                <form action={deleteAction}>
                  <input type="hidden" name="socialId" value={s.id} />
                  <SecondaryButton type="submit" tone="danger" size="sm" label="Remove" />
                </form>
              </li>
            ))}
          </ul>
        )}
        {availableOption ? (
          <form action={addAction} className="app-stack" aria-busy={addPending}>
            <h3 className="app-section-head">Add a handle</h3>
            {!addState.ok ? <Flash tone="danger">{addState.message}</Flash> : null}
            <div className="app-draft-row__fields">
              <div className="perch-field">
                <label className="perch-field__label" htmlFor="social-kind">
                  <span>Platform</span>
                </label>
                <div className="perch-field__input-wrap">
                  <select
                    id="social-kind"
                    name="kind"
                    defaultValue={availableOption.kind}
                    className="perch-field__input"
                  >
                    {SOCIAL_OPTIONS.filter((o) => !takenKinds.has(o.kind)).map((o) => (
                      <option key={o.kind} value={o.kind}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="perch-field__hint" aria-hidden="true" />
              </div>
              <Field label="Handle" name="handle" required maxLength={60} hint="How you want it announced." />
            </div>
            <Field label="Full URL" name="href" required type="url" hint="https://…" />
            <div className="app-row">
              <PrimaryButton type="submit" disabled={addPending} label={addPending ? "Saving…" : "Add handle"} size="sm" />
            </div>
          </form>
        ) : (
          <p className="spread__meta">All supported platforms are added — remove one to swap it.</p>
        )}
      </div>
    </section>
  );
}

/* ------------------- Publish spread (summary) ------------------- */

function PublishSpread({
  profile,
}: {
  profile: { hasPublished: boolean; publishedVersion: number; draftAhead: boolean };
}) {
  return (
    <section className="spread" id="publish">
      <SpreadHeader
        num="05"
        title="Publish"
        meta="Publishing copies your draft to the public page. Same URL, new version. Controls are in the bar pinned at the bottom of this screen."
      />
      <div className="spread__body">
        <ul style={{ margin: 0, paddingLeft: 20, color: "var(--color-ink-secondary)", fontSize: 14, lineHeight: "22px" }}>
          <li>Draft state: <strong>{profile.draftAhead ? "ahead of published" : "in sync with published"}</strong></li>
          <li>Published version: <strong>{profile.hasPublished ? `v${profile.publishedVersion}` : "never"}</strong></li>
          <li>Discarding reverts your draft to the last published version. Non-destructive to visitor data.</li>
        </ul>
      </div>
    </section>
  );
}

/* ------------------- Publish bar (sticky) ------------------- */

function PublishBar({
  profile,
}: {
  profile: { hasPublished: boolean; publishedVersion: number; draftAhead: boolean };
}) {
  const [state, action, pending] = useActionState<ActionResult, FormData>(publishAction, EMPTY_RESULT);
  const [, discardAction, discarding] = useActionState<ActionResult, FormData>(discardDraftAction, EMPTY_RESULT);

  const status =
    !profile.hasPublished
      ? { tone: "neutral" as const, label: "Not yet published" }
      : profile.draftAhead
      ? { tone: "warning" as const, label: "Draft ahead of published" }
      : { tone: "success" as const, label: "In sync with public page" };

  return (
    <div className="publish-bar" role="status" aria-live="polite">
      <div className="publish-bar__status">
        <Badge tone={status.tone} label={status.label} />
        {state.ok && state.flash ? (
          <span style={{ color: "var(--color-success-500)", fontSize: 13 }}>{state.flash}</span>
        ) : !state.ok ? (
          <span style={{ color: "var(--color-danger-500)", fontSize: 13 }}>{state.message}</span>
        ) : (
          <span style={{ display: "none" }}>&nbsp;</span>
        )}
      </div>
      <div className="publish-bar__actions">
        {profile.hasPublished && profile.draftAhead ? (
          <form action={discardAction}>
            <SecondaryButton type="submit" tone="danger" size="sm" disabled={discarding} label="Discard draft" />
          </form>
        ) : null}
        <form action={action}>
          <PrimaryButton
            type="submit"
            disabled={pending || !profile.draftAhead}
            label={
              pending
                ? "Publishing…"
                : profile.hasPublished
                ? `Publish v${profile.publishedVersion + 1}`
                : "Publish your page"
            }
          />
        </form>
      </div>
    </div>
  );
}
