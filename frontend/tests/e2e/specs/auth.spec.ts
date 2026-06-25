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

test('unauthenticated user sees the Sign In form', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Green Generation' })).toBeVisible();
  await expect(page.locator('button.auth-tab', { hasText: 'Sign In' })).toHaveClass(/active/);
});

test('FINDING: submitting with empty fields is blocked by native HTML5 validation, not the custom JS message', async ({ page }) => {
  // Auth.tsx's handleAuth has `if (!email || !password) setError('Please fill in
  // all fields.')`, but both inputs also have a plain `required` attribute. The
  // browser's native constraint validation intercepts an empty-required-field
  // submit before the onSubmit handler ever runs, so this custom message is
  // unreachable via the UI for a fully-empty form. Asserting the actual behavior.
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign In', exact: true }).last().click();
  const emailValid = await page.locator('#email').evaluate((el: HTMLInputElement) => el.validity.valid);
  expect(emailValid).toBe(false);
  await expect(page.getByText('Please fill in all fields.')).not.toBeVisible();
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

test('FINDING: missing org code is also blocked by native HTML5 validation, not the custom JS message', async ({ page }) => {
  // Same root cause as the empty-fields test above: orgId's `required`
  // attribute triggers native validation before handleAuth's own
  // `if (!orgId.trim())` check ever gets a chance to run.
  await page.goto('/');
  await page.getByRole('button', { name: 'Register', exact: true }).click();
  await page.getByLabel('Email Address').fill('noorg-e2e@example.com');
  await page.getByLabel('Password', { exact: true }).fill('password123');
  await page.getByLabel('Confirm Password').fill('password123');
  await page.getByRole('button', { name: 'Create Account' }).click();
  const orgIdValid = await page.locator('#orgId').evaluate((el: HTMLInputElement) => el.validity.valid);
  expect(orgIdValid).toBe(false);
  await expect(page.getByText('Organization Code / ID is required.')).not.toBeVisible();
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
