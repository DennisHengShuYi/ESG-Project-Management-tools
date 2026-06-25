import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { FRONTEND_URL, BACKEND_URL, AUTH_STATE_PATH, TEST_USER_PATH } from '../../playwright.config';

/**
 * Registers a throwaway test account against the real backend/Supabase
 * (there is no test/staging environment in this repo — see report caveat),
 * then saves a logged-in browser storageState plus the raw credentials so
 * individual specs can also hit the API directly for persistence checks.
 */
export default async function globalSetup() {
  const orgsRes = await fetch(`${BACKEND_URL}/api/auth/organisations`).catch(() => null);
  if (!orgsRes || !orgsRes.ok) {
    throw new Error(
      `Backend not reachable at ${BACKEND_URL}. Start it first (cd backend && npm run dev) before running the E2E suite.`
    );
  }
  const orgs = await orgsRes.json();
  if (!Array.isArray(orgs) || orgs.length === 0) {
    throw new Error('No organisations found via /api/auth/organisations — cannot register a test user.');
  }
  const organisation_id = orgs[0].id;

  const email = `e2e-${Date.now()}@example.com`;
  const password = 'E2eTestPass123!';

  const regRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, organisation_id }),
  });
  const regData = await regRes.json();
  if (!regRes.ok) {
    throw new Error(`Failed to register E2E test user: ${regData.error || regRes.status}`);
  }

  const { token, user } = regData;

  const authDir = path.dirname(AUTH_STATE_PATH);
  fs.mkdirSync(authDir, { recursive: true });

  fs.writeFileSync(
    TEST_USER_PATH,
    JSON.stringify({ email, password, token, organisation_id, user_id: user.id }, null, 2)
  );

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(FRONTEND_URL);
  await page.evaluate((t) => window.localStorage.setItem('token', t), token);
  await page.context().storageState({ path: AUTH_STATE_PATH });
  await browser.close();
}
