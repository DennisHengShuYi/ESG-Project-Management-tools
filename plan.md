# Multi-User Accounts, Per-Module Permissions & Audit Trail

Status: **proposed — not yet implemented**
Origin: supervisor feedback — need to track who changes project data and when,
and need an admin-controlled way to manage what each account can access,
instead of everyone sharing one login.

---

## 1. Current state (verified in code, not assumed)

- `backend/src/routes/auth.js` — individual accounts already work today
  (`POST /api/auth/register`, `/login`), each row in a `users` table with
  `id, email, password_hash, organisation_id`. So separate logins are
  technically possible now.
- **But every user is identical.** No `role` column, no permission column.
  `backend/src/middleware/auth.js` only ever checks "is this JWT valid" —
  it never distinguishes one user from another beyond `organisation_id`.
  `requireEventOwnership.js` scopes access to *the organisation*, not the
  individual user. Any logged-in member of an org can create/edit/delete
  anything belonging to that org.
- **No audit trail exists anywhere.** Tables only have a generic
  `updated_at` trigger (`set_updated_at()` in `supabase/schema.sql`) — that
  records *when* a row last changed, never *who* or *what field changed
  from what to what*. `events.created_by uuid` exists as a column but
  `events.js`'s `POST /` handler never populates it — it's dead.
- **No admin UI.** `frontend/src/pages/Settings.tsx` is flat system config
  (carbon price, thresholds, framework toggles) — no user management, no
  activity log, anywhere in the app.
- **The `users` table itself is not in `supabase/schema.sql`.** It's
  referenced by `auth.js` but was created out-of-band (directly in
  Supabase), not through the tracked migration (`scripts/migrate.cjs` just
  applies `schema.sql`). This is a pre-existing drift risk independent of
  this feature — the migration below has to be additive/defensive since we
  can't be 100% sure of the live table's exact current columns.
- **Supabase RLS is wide open.** Every table has an `anon_all` policy
  (`using (true) with check (true)`) — all real enforcement today lives in
  the Express layer (organisation_id checks), not the database. This plan
  keeps that same pattern (enforce in Express) rather than introducing a
  second enforcement layer in RLS — noted as a separate, pre-existing gap,
  not something this plan fixes.

## 2. Decision locked in with the user

Permission model: **per-module**, not a flat Admin/Member split. Each
non-admin user gets an explicit set of modules they can write to. Modules
mirror the app's actual tab/module structure:

`events`, `green-ops`, `health-safety`, `procurement`, `financial`,
`timeline`, `attendance`, `governance`, `sdg`, `settings`

Scope simplification (flagged here, not yet separately confirmed): **read
access stays organisation-wide for everyone** (so reporting/dashboards
stay useful to the whole team); only **write** (create/update/delete) is
gated per module. Admins bypass all per-module checks and additionally get
user management + the activity log. If read access also needs to be
restricted per module, say so before Phase 2 — it changes several routes.

## 3. Data model changes (`supabase/schema.sql`)

All additive/idempotent (`if not exists`) so re-running is safe and it
doesn't fight whatever the live `users` table already has.

```sql
-- Defensive — in case the live table predates this file entirely.
create table if not exists public.users (
  id                uuid        default gen_random_uuid() primary key,
  email             text        not null unique,
  password_hash     text        not null,
  organisation_id   uuid        not null references public.organisations(id),
  created_at        timestamptz not null default now()
);

alter table public.users
  add column if not exists full_name          text,
  add column if not exists role               text not null default 'member'
    check (role in ('admin', 'member')),
  add column if not exists module_permissions jsonb not null default '{}'::jsonb,
  add column if not exists is_active          boolean not null default true,
  add column if not exists last_login_at      timestamptz;

create table if not exists public.audit_log (
  id               uuid        default gen_random_uuid() primary key,
  organisation_id  uuid        not null references public.organisations(id),
  user_id          uuid        references public.users(id),
  user_email       text        not null,   -- denormalised: survives user deletion
  action           text        not null check (action in ('create','update','delete')),
  module           text        not null,   -- same keys as module_permissions
  table_name       text        not null,
  record_id        uuid,
  changes          jsonb       not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists audit_log_org_time_idx
  on public.audit_log (organisation_id, created_at desc);
create index if not exists audit_log_record_idx
  on public.audit_log (record_id);
```

`changes` shape: for `update`, `{ field: { old, new } }` per changed field
only (not the whole row); for `create`/`delete`, the relevant row snapshot.

## 4. Backend changes

**`middleware/auth.js`** — after verifying the JWT, look up the user row
fresh (one extra `select` per request) rather than trusting stale claims,
so a permission change or deactivation takes effect immediately instead of
waiting out a 24h token:
- reject with 401 if `is_active = false`
- attach `req.user = { id, email, organisation_id, role, module_permissions }`

**New `middleware/requirePermission.js`**
```js
export const requirePermission = (moduleKey) => (req, res, next) => {
  if (req.user.role === 'admin' || req.user.module_permissions?.[moduleKey]) {
    return next();
  }
  res.status(403).json({ error: `No write access to ${moduleKey}.` });
};
```
Applied to every mutating route:
- `events.js`: `POST /`, `DELETE /:id` → `requirePermission('events')`
- per-module save routes (`saveGreenOps`, `saveHealthSafety`,
  `saveProcurement`, `saveEventFinancials`, `saveEventTimeline`,
  `saveEventAttendance`) → matching module key
- `governance.js` → `requirePermission('governance')`
- `settings.js` → `requirePermission('settings')` (this also covers the
  SDG per-year `tracked_sdgs_by_year` writes, since those live in
  `app_settings` — tag those specifically as module `'sdg'` in the audit
  log even though the route is shared with general settings)

**New `middleware/requireRole.js`** (`admin` only) for the admin routes.

**Audit logging helper (`utils/auditLog.js`)**
```js
export async function logAudit(req, { action, module, table, recordId, before, after }) {
  const changes =
    action === 'update' ? diffFields(before, after) :
    action === 'delete' ? before : after;
  await supabase.from('audit_log').insert({
    organisation_id: req.user.organisation_id,
    user_id: req.user.id,
    user_email: req.user.email,
    action, module, table_name: table, record_id: recordId, changes,
  });
}
```
Wired into every existing mutating route (events core + all 6 event
modules, governance, settings/SDG). For updates, the route fetches the
before-state first (already has to for most of these), diffs, then logs
after the write succeeds — never blocks the response on log failure
(log errors are caught/console'd, not surfaced to the user).

**New `routes/admin.js`** (`requireAuth` + `requireRole('admin')`):
- `GET  /api/admin/users` — list org's users + role + permissions + active
- `POST /api/admin/users` — admin creates a teammate directly (email, temp
  password, role, initial module_permissions) — bypasses the public
  self-serve `/register` flow, which currently gives everyone equal access
- `PATCH /api/admin/users/:id` — update role / module_permissions / is_active
- `GET  /api/admin/audit-log` — paginated, filters: `?module=`, `?user_id=`,
  `?from=`, `?to=`

## 5. Frontend changes

- **`contexts/AuthContext.tsx`** — extend `UserPayload` with `role` and
  `module_permissions`; add `isAdmin` and `can(moduleKey)` helpers.
- **`components/Layout.tsx`** — "Admin" nav tab, rendered only when `isAdmin`.
- **New `pages/Admin.tsx`** (reuses Events.tsx's existing table/modal
  visual patterns):
  - **Team** tab — table of users (email, name, role, active toggle) with
    a per-module permission checkbox grid; "Add Teammate" modal.
  - **Activity Log** tab — table of audit entries (When / Who / Module /
    Record / What Changed, rendered as `field: old → new`), filterable,
    with CSV export (reusing the existing export pattern from
    `Reporting.tsx`).
- **Write-action gating** — hide "New Event"/"Delete"/"Save" etc. when
  `!can(moduleKey)`. Backend is the real enforcement; this just avoids
  people hitting 403s on buttons they can't use.
- **"Last edited by" attribution** — Event Detail and Governance pages show
  `Last edited by {email} · {relative time}`, sourced from the latest
  `audit_log` row for that record. Answers "who changed this" inline
  without opening the full admin log.

## 6. Build order (each phase independently shippable)

1. **Schema + audit logging plumbing** — add tables/columns, wire
   `logAudit()` into every existing mutating route. Invisible to users;
   every edit from this point on starts getting recorded, before any
   permission enforcement exists.
2. **Roles + permission enforcement (backend only)** — role/module_permissions
   columns, `requirePermission`/`requireRole` middleware on every write
   route, `/api/admin/*` routes. Existing users default to full access on
   all modules so nothing breaks until an admin actually restricts someone.
3. **Admin UI** — Team management + Activity Log pages.
4. **Frontend gating + "last edited by" polish.**

## 7. Open items before starting Phase 2+

- **Who gets `role = 'admin'` first?** Need at least one email address to
  promote manually right after migration — everyone else defaults to
  `member` with empty `module_permissions` (i.e. no write access anywhere,
  read-only, until an admin grants modules) — confirm that's the right
  default vs. defaulting existing users to full access on all modules so
  nothing breaks the day this ships.
- **Settings module scope** — is "Settings" (carbon price, thresholds,
  framework toggles) something any granted user should touch, or should it
  always be admin-only regardless of `module_permissions`? Leaning
  admin-only since it's system-wide config, not project data.
- Confirm the module list above matches what the team actually thinks of
  as separate access boundaries (e.g. should Green Ops / Health & Safety /
  Procurement / Financial / Timeline / Attendance really be six separate
  toggles, or would that be too fine-grained in practice and better
  collapsed to one "Events" toggle covering all of a given event's data)?
