import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let cachedEnv: Record<string, string> | null = null;

function loadBackendEnv(): Record<string, string> {
  if (cachedEnv) return cachedEnv;
  const envPath = path.resolve(__dirname, '../../../../backend/.env');
  const env: Record<string, string> = {};
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
      const m = line.match(/^([A-Z_]+)=(.*)$/);
      if (m) env[m[1]] = m[2].trim();
    }
  }
  cachedEnv = env;
  return env;
}

/** Best-effort direct delete via Supabase PostgREST + service key.
 * Used to remove throwaway test users that have no DELETE route in the
 * app's own API. Never throws — see global-teardown.ts for rationale. */
export async function deleteUserByEmail(email: string): Promise<void> {
  try {
    const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = loadBackendEnv();
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;
    await fetch(`${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`, {
      method: 'DELETE',
      headers: {
        apikey: SUPABASE_SERVICE_KEY,
        Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
    });
  } catch {
    // best-effort only
  }
}

const ALL_MODULES = [
  'events', 'green-ops', 'health-safety', 'procurement', 'financial',
  'timeline', 'attendance', 'governance', 'hr-diversity', 'climate-finance', 'sdg',
];

/** Grants full read+write on every module to a freshly-registered test user.
 * Needed because RBAC (added after this harness was first written) now
 * defaults new members to module_permissions '{}' — a zero-access account
 * would fail almost every existing spec, which assumes full access like
 * every user had before RBAC existed. */
export async function grantFullPermissions(userId: string): Promise<void> {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = loadBackendEnv();
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;
  const module_permissions: Record<string, { read: boolean; write: boolean }> = {};
  for (const m of ALL_MODULES) module_permissions[m] = { read: true, write: true };
  await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ module_permissions }),
  });
}

/** Sets a user's role directly (bypasses the app's own admin-only PATCH
 * route). Used only to bootstrap the very first dedicated test-admin
 * account, since creating an admin normally requires an existing admin to
 * do it via the Admin UI — and this suite has no credentials for the real
 * admin@gmail.com account. */
export async function setUserRole(userId: string, role: 'admin' | 'member'): Promise<void> {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = loadBackendEnv();
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;
  await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${encodeURIComponent(userId)}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ role }),
  });
}

/** Creates a throwaway organisation for tests that need an isolated
 * admin-count (e.g. the last-admin guard), so they never have to touch the
 * real shared org's real admin@gmail.com account. Returns the new org id. */
export async function createOrganisation(name: string): Promise<string> {
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = loadBackendEnv();
  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) throw new Error('Missing Supabase service key');
  const res = await fetch(`${SUPABASE_URL}/rest/v1/organisations`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
    },
    body: JSON.stringify({ name }),
  });
  const [org] = await res.json();
  return org.id;
}

export async function deleteOrganisation(id: string): Promise<void> {
  try {
    const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = loadBackendEnv();
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;
    await fetch(`${SUPABASE_URL}/rest/v1/organisations?id=eq.${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { apikey: SUPABASE_SERVICE_KEY, Authorization: `Bearer ${SUPABASE_SERVICE_KEY}` },
    });
  } catch {
    // best-effort only
  }
}

/** Self-healing sweep: deletes any e2e-*@example.com user older than
 * maxAgeMs. Orphaned accounts accumulate when a run is killed/crashes
 * before global-teardown runs (the single TEST_USER_PATH file only ever
 * tracks the most recent run, so an interrupted run's account becomes
 * untraceable once the next run overwrites it). Running this at the start
 * of every global-setup means the backlog can never grow past ~1 run. */
export async function purgeStaleE2EUsers(maxAgeMs = 60 * 60 * 1000): Promise<void> {
  try {
    const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = loadBackendEnv();
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) return;
    const cutoff = new Date(Date.now() - maxAgeMs).toISOString();
    await fetch(
      `${SUPABASE_URL}/rest/v1/users?email=ilike.e2e-*@example.com&created_at=lt.${encodeURIComponent(cutoff)}`,
      {
        method: 'DELETE',
        headers: {
          apikey: SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
        },
      }
    );
  } catch {
    // best-effort only
  }
}
