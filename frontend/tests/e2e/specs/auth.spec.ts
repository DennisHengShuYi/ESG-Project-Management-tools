import { test, expect } from '@playwright/test';
import { BACKEND_URL } from '../../../playwright.config';
import { deleteUserByEmail } from '../utils/supabase-admin';

// This spec exercises the logged-out flow, so it must not inherit the
// pre-authenticated storageState the rest of the suite uses.
test.use({ storageState: { cookies: [], origins: [] } });

const createdEmails: string[] = [];

test.afterAll(async () => {
  await Promise.all(createdEmails.map(deleteUserByEmail));
});

/** A structurally-valid (3-segment, decodable payload) but unsigned JWT —
 * enough for AuthContext's decodeToken() to optimistically accept it
 * client-side, while the backend's jwt.verify() correctly rejects it. */
function buildFakeJWT(payload: object): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${body}.fakesignature`;
}

test('unauthenticated user sees the Sign In form', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Green Generation' })).toBeVisible();
  await expect(page.locator('button.auth-tab', { hasText: 'Sign In' })).toHaveClass(/active/);
});

test('FIXED: an invalid/expired token auto-logs-out with a clear message instead of failing silently', async ({ page }) => {
  // Regression test: db.ts had no 401 handling at all — AuthContext's
  // decodeToken() only parses the JWT payload, it never validates the
  // signature or expiry, so the UI optimistically rendered the Dashboard
  // shell while every API call failed silently in the console with no
  // indication to the user why nothing was loading.
  const fakeToken = buildFakeJWT({
    id: 'fake-id',
    email: 'fake@example.com',
    organisation_id: '00000000-0000-0000-0000-000000000001',
  });
  // Set the token via evaluate (one-time) rather than addInitScript, which
  // re-injects on every navigation — including the one this fix itself
  // triggers, which would re-plant the fake token right after it's cleared
  // and loop forever instead of settling on the logged-out state.
  await page.goto('/');
  await page.evaluate((t) => window.localStorage.setItem('token', t), fakeToken);
  await page.reload();

  await expect(page.getByText('Your session has expired. Please log in again.')).toBeVisible({ timeout: 10000 });
  await expect(page.locator('button.auth-tab', { hasText: 'Sign In' })).toBeVisible();
  const token = await page.evaluate(() => window.localStorage.getItem('token'));
  expect(token).toBeNull();
});

test('FIXED: empty fields now show the custom JS validation message', async ({ page }) => {
  // Regression test: the inputs used to have a plain `required` attribute,
  // and native browser validation intercepted submission before handleAuth's
  // own `if (!email || !password)` check ever ran, making this message
  // unreachable. `required` has been removed so the custom, styled error
  // alert is what the user actually sees.
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign In', exact: true }).last().click();
  await expect(page.getByText('Please fill in all fields.')).toBeVisible();
});

test('short password is rejected client-side', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email Address').fill('someone@example.com');
  await page.getByLabel('Password', { exact: true }).fill('123');
  await page.getByRole('button', { name: 'Sign In', exact: true }).last().click();
  await expect(page.getByText('Password must be at least 6 characters.')).toBeVisible();
});

test('invalid credentials show the server error message', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Email Address').fill('nonexistent-e2e-user@example.com');
  await page.getByLabel('Password', { exact: true }).fill('wrongpassword');
  await page.getByRole('button', { name: 'Sign In', exact: true }).last().click();
  await expect(page.getByText('Invalid email or password.')).toBeVisible();
});

test('register form: password mismatch is rejected', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await page.getByLabel('Email Address').fill('mismatch-e2e@example.com');
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await page.getByLabel('Confirm Password').fill('different123');
  await page.getByLabel('Organization Code / ID').fill('00000000-0000-0000-0000-000000000001');
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page.getByText('Passwords do not match.')).toBeVisible();
});

test('FIXED: missing org code now shows the custom JS validation message', async ({ page }) => {
  // Regression test, same root cause as the empty-fields test above.
  await page.goto('/');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await page.getByLabel('Email Address').fill('noorg-e2e@example.com');
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await page.getByLabel('Confirm Password').fill('password123');
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page.getByText('Organization Code / ID is required.')).toBeVisible();
});

test('register form: invalid org code shows server error', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await page.getByLabel('Email Address').fill(`badorg-e2e-${Date.now()}@example.com`);
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await page.getByLabel('Confirm Password').fill('password123');
  await page.getByLabel('Organization Code / ID').fill('not-a-real-org-id');
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page.getByText('Invalid Organization Code / ID.')).toBeVisible();
});

test('successful registration logs the user in', async ({ page }) => {
  const orgsRes = await fetch(`${BACKEND_URL}/api/auth/organisations`);
  const orgs = await orgsRes.json();
  const organisation_id = orgs[0].id;
  const email = `e2e-register-${Date.now()}@example.com`;
  createdEmails.push(email);

  await page.goto('/');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await page.getByLabel('Email Address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await page.getByLabel('Confirm Password').fill('password123');
  await page.getByLabel('Organization Code / ID').fill(organisation_id);
  await page.getByRole('button', { name: 'Create Account' }).click();

  await expect(page.getByRole('heading', { name: 'Overview Dashboard' })).toBeVisible({ timeout: 10000 });
});

test('registering with an already-used email is rejected, then login with correct password succeeds', async ({ page }) => {
  const orgsRes = await fetch(`${BACKEND_URL}/api/auth/organisations`);
  const orgs = await orgsRes.json();
  const organisation_id = orgs[0].id;
  const email = `e2e-duplicate-${Date.now()}@example.com`;
  const password = 'password123';
  createdEmails.push(email);

  // Register once via API directly to seed the duplicate-email scenario.
  await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, organisation_id }),
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await page.getByLabel('Email Address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Confirm Password').fill(password);
  await page.getByLabel('Organization Code / ID').fill(organisation_id);
  await page.getByRole('button', { name: 'Create Account' }).click();
  await expect(page.getByText('Email is already registered.')).toBeVisible();

  // Now log in with the same credentials instead.
  await page.getByRole('button', { name: 'Sign In', exact: true }).first().click();
  await page.getByLabel('Email Address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Sign In', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Overview Dashboard' })).toBeVisible({ timeout: 10000 });
});
