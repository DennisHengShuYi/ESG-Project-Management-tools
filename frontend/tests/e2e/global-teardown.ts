import fs from 'fs';
import { TEST_USER_PATH } from '../../playwright.config';
import { deleteUserByEmail } from './utils/supabase-admin';

/**
 * Best-effort cleanup of the throwaway test user created in global-setup.
 * There is no DELETE /api/users endpoint, so this talks to Supabase's
 * PostgREST interface directly using the service key from backend/.env.
 * Wrapped so a failure here (e.g. no outbound network access, or the
 * service key being unavailable) never fails the test run — it only
 * leaves one harmless extra row in `users` for a human to clean up later.
 */
export default async function globalTeardown() {
  if (!fs.existsSync(TEST_USER_PATH)) return;
  const { email } = JSON.parse(fs.readFileSync(TEST_USER_PATH, 'utf-8'));
  await deleteUserByEmail(email);
}
