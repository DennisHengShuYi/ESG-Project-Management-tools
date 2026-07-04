import { test, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { BACKEND_URL } from '../../../playwright.config';
import { deleteUserByEmail } from '../utils/supabase-admin';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadSupabaseServiceCreds() {
  const envPath = path.resolve(__dirname, '../../../../backend/.env');
  const envText = fs.readFileSync(envPath, 'utf-8');
  const SUPABASE_URL = envText.match(/^SUPABASE_URL=(.*)$/m)?.[1].trim();
  const SUPABASE_SERVICE_KEY = envText.match(/^SUPABASE_SERVICE_KEY=(.*)$/m)?.[1].trim();
  return { SUPABASE_URL, SUPABASE_SERVICE_KEY };
}

/**
 * Verifies the RBAC gating a limited-permission member actually experiences
 * — both the UI (hidden controls, no-access screens) and the real backend
 * 403s underneath them, using an isolated existing seed event so it doesn't
 * touch anything another spec might be reading concurrently.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const PASSWORD = 'LimitedPass123!';
let email: string;
let seedEventId: string;

test.beforeAll(async () => {
  const orgsRes = await fetch(`${BACKEND_URL}/api/auth/organisations`);
  const orgs = await orgsRes.json();
  const organisation_id = orgs[0].id;

  email = `e2e-limited-${Date.now()}@example.com`;
  const regRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD, organisation_id }),
  });
  const regData = await regRes.json();

  // Grant only events:read — no write, no other module at all. Registration
  // itself already defaults new members to module_permissions '{}', so this
  // sets exactly the one permission this spec needs, directly via the
  // service key (there is no self-serve "grant myself access" flow, nor
  // should there be — that's the entire point of RBAC).
  const { SUPABASE_URL, SUPABASE_SERVICE_KEY } = loadSupabaseServiceCreds();
  await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${regData.user.id}`, {
    method: 'PATCH',
    headers: {
      apikey: SUPABASE_SERVICE_KEY!,
      Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    },
    body: JSON.stringify({ module_permissions: { events: { read: true, write: false } } }),
  });

  const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const { token } = await loginRes.json();
  const eventsRes = await fetch(`${BACKEND_URL}/api/events`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const events = await eventsRes.json();
  seedEventId = events[0].id;
});

test.afterAll(async () => {
  await deleteUserByEmail(email);
});

const login = async (page: any) => {
  await page.goto('/');
  await page.getByLabel('Email Address').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign In', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Overview Dashboard' })).toBeVisible({ timeout: 10000 });
};

test('no Admin nav link for a non-admin member', async ({ page }) => {
  await login(page);
  await expect(page.getByRole('link', { name: 'Admin', exact: true })).toHaveCount(0);
});

test('Events page shows data but hides New Event, checkboxes, and row actions', async ({ page }) => {
  await login(page);
  await page.goto('/events');
  await expect(page.getByRole('heading', { name: 'Events & Projects' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'New Event' })).toHaveCount(0);
  await expect(page.locator('thead input[type="checkbox"]')).toHaveCount(0);
  await expect(page.locator('tbody tr').first()).toBeVisible();
});

test('Governance page shows the no-access message, not the form', async ({ page }) => {
  await login(page);
  await page.goto('/governance');
  await expect(page.getByText("You don't have access to Governance. Ask an admin to grant you read access.")).toBeVisible();
  await expect(page.locator('input[name="gov_committee_name"]')).toHaveCount(0);
});

test('SDG dashboard shows the no-access message, not the goal cards', async ({ page }) => {
  await login(page);
  await page.goto('/sdg');
  await expect(page.getByText("You don't have access to the SDG dashboard. Ask an admin to grant you read access.")).toBeVisible();
  await expect(page.getByRole('button', { name: 'Manage Goals' })).toHaveCount(0);
});

test('EventDetail shows the all-modules-blocked message when no sub-module permission is granted', async ({ page }) => {
  await login(page);
  await page.goto(`/events/${seedEventId}`);
  await expect(page.getByText("You don't have read access to any module of this event.")).toBeVisible();
});

test('Dashboard hides Climate Finance and HR & Diversity tabs without their read permission', async ({ page }) => {
  await login(page);
  await page.goto('/');
  await expect(page.getByRole('button', { name: 'Climate Finance' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Enterprise HR & Diversity' })).toHaveCount(0);
});

test('backend rejects a governance read with 403 for a user with no governance permission', async ({ page }) => {
  await login(page);
  const token = await page.evaluate(() => window.localStorage.getItem('token'));
  const res = await fetch(`${BACKEND_URL}/api/governance?year=2025`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(res.status).toBe(403);
});

test('backend rejects creating an event with 403 for a user with events read but not write', async ({ page }) => {
  await login(page);
  const token = await page.evaluate(() => window.localStorage.getItem('token'));
  const res = await fetch(`${BACKEND_URL}/api/events`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ event_name: 'Should Be Rejected', event_status: 'Draft' }),
  });
  expect(res.status).toBe(403);
});
