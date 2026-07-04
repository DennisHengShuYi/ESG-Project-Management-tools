# Multi-User Accounts, Per-Module Permissions & Audit Trail

Status: **implemented (Phases 1–4 complete in code) — pending live DB migration**
Origin: supervisor feedback — need to track who changes project data and
when, and need an admin-controlled way to manage what each account can
access, instead of everyone sharing one login.

Revision 3 — marks the full build (schema, backend enforcement, Admin UI,
frontend gating) as done and records what actually shipped vs. the
original design, including where implementation diverged slightly from
earlier revisions.

---

## 1. Current state (verified in code, not assumed)

- `backend/src/routes/auth.js` — individual accounts already worked before
  this feature (`POST /api/auth/register`, `/login`), each row in a `users`
  table with `id, email, password_hash, organisation_id`.
- Before this change, every user was identical — no `role`, no permission
  column, `middleware/auth.js` only checked "is this JWT valid." Any
  logged-in member of an org could read/create/edit/delete anything
  belonging to that org.
- No audit trail existed anywhere — tables only had a generic `updated_at`
  trigger. `events.created_by uuid` existed as a column but was never
  populated.
- `frontend/src/pages/Settings.tsx` was flat system config, not even linked
  in `Layout.tsx`'s nav — a dead/orphaned route.
- The `users` table itself was not in `supabase/schema.sql` — created
  out-of-band, not through the tracked migration.
- Supabase RLS is (and remains) wide open (`anon_all` policy) — all
  enforcement lives in the Express layer, same as before this feature.
  Not fixed here; a separate pre-existing gap.
- `governance.js` already split one merged payload into `STRATEGY_KEYS` /
  `HR_KEYS` / `CLIMATE_KEYS` for three tables — reused directly for
  permission enforcement and redaction (see `utils/fieldRedaction.js`).
- Each event sub-module already had its own save endpoint — reused
  directly for per-module write gating.

## 2. Decisions made

- **Permission granularity: fully granular, per module, per user, with
  independent Read and Write flags.** 11 modules: `events`, `green-ops`,
  `health-safety`, `procurement`, `financial`, `timeline`, `attendance`,
  `governance`, `hr-diversity`, `climate-finance`, `sdg`. Admins bypass all
  per-module checks entirely.
- **`Settings.tsx` is retired.** Its content now lives in an admin-only
  **Org Settings** tab inside `pages/Admin.tsx`. `Settings.tsx` /
  `Settings.css` were deleted; the `/settings` route is gone.
- **Who becomes admin first — resolved via automatic bootstrap**, not a
  manual email handoff:
  - `supabase/schema.sql` migration: for any organisation with zero admins,
    promote its earliest-created user to admin (safe to re-run — no-op
    once an org has an admin).
  - `auth.js` register: the first person to register into an org with no
    admin yet automatically becomes that org's admin.
- **Rollout risk — resolved in favour of the softer option.** The
  migration back-fills full read+write on every module for every user that
  already exists as of the migration (guarded by
  `where module_permissions = '{}'`, so it never overwrites a
  deliberately-configured user). New users created afterward via
  Admin → Team default to **zero** permissions until an admin grants them —
  least-privilege only applies going forward, not retroactively.
- **Module list finalized as originally scoped** — `hr-diversity` and
  `climate-finance` kept separate from `governance`, matching their
  separate backend tables.

## 3. Data model (`supabase/schema.sql`) — shipped

- `users` gains `full_name`, `role` (`admin`/`member`, check constraint),
  `module_permissions jsonb default '{}'`, `is_active`, `last_login_at`.
- New `audit_log` table (`organisation_id`, `user_id`, `user_email`,
  `action`, `module`, `table_name`, `record_id`, `changes jsonb`,
  `created_at`), indexed on `(organisation_id, created_at desc)` and
  `record_id`, RLS enabled with the same `anon_all` pattern as other
  tables.
- Bootstrap + rollout-safety `do $$ ... $$` blocks described above,
  appended at the end of the migrations section — all idempotent.

`module_permissions` shape: `{ moduleKey: { read: bool, write: bool } }`.
`audit_log.changes` shape: `{ field: { old, new } }` per changed field for
updates; a row snapshot for create/delete.

**Not yet done: this migration has not been applied to the live Supabase
database.** `scripts/migrate.cjs` needs `DB_PASSWORD`, which isn't
available in this environment — you need to run it yourself. Until then,
`middleware/auth.js`'s per-request `role`/`module_permissions` lookup will
fail for every request (see §4), so **the backend must not be restarted
against the live DB until the migration has run.**

## 4. Backend — shipped

- **`middleware/auth.js`** — after JWT verification, looks up
  `role, module_permissions, is_active, full_name` fresh from `users` on
  every request (not trusted from the JWT), rejects with 401 if
  `is_active = false` or the user row is gone.
- **`middleware/permissions.js`** (not `requirePermission.js` as first
  sketched — merged `requirePermission`, `requireRole`, and a shared
  `hasPermission(user, moduleKey, level)` helper into one file since
  `governance.js` and the bulk-update route need the raw check, not just
  the middleware wrapper).
- **`utils/fieldRedaction.js`** — `STRATEGY_KEYS`/`HR_KEYS`/`CLIMATE_KEYS`
  moved here from `governance.js` (single source of truth, imported back
  into `governance.js`), plus `redactGovernanceFields()` and
  `redactEventFields()` with a `FIELD_MODULE_MAP` mirroring
  `frontend/src/utils/db.ts`'s `CSV_FIELDS` module tagging.
- **Write gating applied**: `events.js` (core create/update/delete, all 6
  per-module save routes, bulk-update requires write on all 6 modules at
  once), `governance.js` (per-touched-group check, rejects the whole save
  if any group lacks write), `settings.js` (now gated on `sdg`
  read/write — its only remaining consumer is `SDGDashboard.tsx`).
- **Read gating applied**: `events.js` `GET /`, `/full`, `/:id` all require
  `events` read, with `/full` and `/:id` additionally redacting
  per-module fields; `governance.js` `GET /` redacts per-group.
- **`routes/admin.js`** (new, `requireRole('admin')` on everything):
  `GET/POST /users`, `PATCH /users/:id` (blocks demoting/deactivating the
  last admin), `GET /audit-log` (paginated, filterable by module/user/date
  range), `GET/POST /org-settings` (merges into the shared `app_settings`
  row rather than overwriting it, so it can't wipe out SDG settings stored
  in the same blob).
- **`auth.js`** — `register`/`login` now return `role`, `module_permissions`,
  `full_name`; `login` rejects deactivated accounts and updates
  `last_login_at` (fire-and-forget); new `GET /me` for rehydrating a
  session's permissions on page reload without re-logging-in.
- **"Last edited by"** — `events.js GET /:id` and `governance.js GET /`
  each attach `_last_edited: { user_email, module, created_at }` from the
  most recent matching `audit_log` row.
- Verified: every backend file passes `node --check`; the server boots
  clean with all new routes/middleware wired (`server.js` mounts
  `/api/admin`).

## 5. Admin configuration — recommendations (implemented as designed)

All six recommendations from the prior revision were built as specified:
least-privilege default for new users, a single permission matrix (not
per-module screens), presets (Viewer / Full Editor / Event Staff) as a
fill-in layer over the same matrix, "copy permissions from…" on the add-
teammate form, backend-enforced last-admin guardrail, and a compact
"Read N/11 · Write N/11" summary chip per row in the Team table. Bulk
matrix-wide actions ("grant read to all") were not built — a manual matrix
still requires per-cell clicks; flagged as a possible future refinement,
not done.

## 6. Frontend — shipped

- **`contexts/AuthContext.tsx`** — `UserPayload` extended with `role` /
  `module_permissions` / `full_name`; added `isAdmin`, `canRead(moduleKey)`,
  `canWrite(moduleKey)`. On mount, after decoding the JWT, calls
  `GET /api/auth/me` to refresh permissions from the backend (so a
  mid-session permission change or deactivation reflects without a
  re-login).
- **`components/Layout.tsx`** — "Admin" nav tab, rendered only when
  `isAdmin`.
- **`pages/Admin.tsx`** (new) + `Admin.css` (new) — Team / Activity Log /
  Org Settings tabs, built per §5. Reuses the Events.tsx modal/table
  visual language (portal-rendered modals, solid-in-light-mode cards).
- **`pages/Settings.tsx` and `Settings.css` deleted.**
- **Write/read gating applied across every page**:
  - `Events.tsx` — "New Event", bulk-select checkboxes, per-row Edit/Delete
    all hidden without `canWrite('events')`; whole page shows an
    access-denied message without `canRead('events')`.
  - `EventDetail.tsx` — module tabs filtered to `canRead(moduleId)`; the
    active `EditableModule` gets a read-only banner instead of Edit/Save
    when `!canWrite`; CSV upload (bulk-update) hidden unless the user has
    write on all 6 sub-modules; shows "Last edited by" from `_last_edited`.
  - `Governance.tsx` — access-denied gate on `!canRead('governance')`,
    every input/textarea/select disabled and the Save button hidden
    without `canWrite('governance')`, "Last edited by" shown.
  - `Dashboard.tsx` — the Climate Finance and HR & Diversity tabs (the only
    two with an actual write action) are hidden entirely without read
    access, and their `EditableModule`s get the same read-only banner
    treatment without write; the four aggregate-only tabs stay visible
    since their data is already server-redacted per field.
  - `SDGDashboard.tsx` — "Manage Goals" and the per-card threshold pencil
    buttons hidden without `canWrite('sdg')`.
- Verified end-to-end with Playwright against a mocked backend: admin sees
  Team/Activity Log/Org Settings all functioning (create teammate with a
  preset, activity log renders `field: old → new`, org settings load/save);
  a read-only member sees no Admin tab, no write controls anywhere, but
  still sees the data they're permitted to read.

## 7. Build order — all four phases complete

1. Schema + audit logging plumbing — done.
2. Roles + read/write permission enforcement (backend) — done, including
   the bootstrap/rollout SQL from §2.
3. Admin UI — done, `Settings.tsx` deleted.
4. Frontend read/write gating + "last edited by" — done.

## 8. Remaining before this is live

- **Run the migration.** `supabase/schema.sql` has not been applied to the
  live Supabase database — needs `DB_PASSWORD`, which isn't available in
  this environment. Run `node scripts/migrate.cjs` yourself.
- **Restart the backend after migrating, not before.** `middleware/auth.js`
  now selects `role`/`module_permissions`/`is_active` on every request;
  those columns don't exist on the live DB until the migration runs, so
  every authenticated request will 401 if the backend restarts first.
- **Not built:** matrix-wide bulk actions ("grant read to all modules" /
  "revoke all write" in one click) mentioned in §5 as a nice-to-have — the
  matrix still requires per-checkbox clicks today.
- **Not built:** email-based invites — `Admin → Team → Add Teammate`
  creates the account directly with a temporary password shared
  out-of-band, there's no email/invite-link flow.
