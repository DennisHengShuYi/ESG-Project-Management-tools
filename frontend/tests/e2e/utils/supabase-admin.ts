import fs from 'fs';
import path from 'path';

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
