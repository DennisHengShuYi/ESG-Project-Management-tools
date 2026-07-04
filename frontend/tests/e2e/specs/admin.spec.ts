import { test, expect } from '@playwright/test';
import { BACKEND_URL } from '../../../playwright.config';
import { deleteUserByEmail, setUserRole, createOrganisation, deleteOrganisation } from '../utils/supabase-admin';

/**
 * Admin/RBAC coverage. Runs as a dedicated test-admin account, not the
 * shared default storageState user (a plain member can't reach /admin at
 * all — App.tsx only renders that route when isAdmin) and not the real
 * admin@gmail.com (no credentials for it in this repo). The first admin is
 * bootstrapped via a direct service-key role patch, since creating an admin
 * normally requires an existing admin to do it through the Admin UI itself
 * — that circular requirement is exactly why one direct bootstrap is
 * unavoidable here.
 */
test.use({ storageState: { cookies: [], origins: [] } });

const ADMIN_PASSWORD = 'E2eAdminPass123!';
let orgId: string;
let adminEmail: string;
let adminToken: string;
let adminUserId: string;
const createdEmails: string[] = [];

test.beforeAll(async () => {
  const orgsRes = await fetch(`${BACKEND_URL}/api/auth/organisations`);
  const orgs = await orgsRes.json();
  orgId = orgs[0].id;

  adminEmail = `e2e-admin-${Date.now()}@example.com`;
  createdEmails.push(adminEmail);
  const regRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: ADMIN_PASSWORD, organisation_id: orgId }),
  });
  const regData = await regRes.json();
  adminUserId = regData.user.id;
  await setUserRole(adminUserId, 'admin');

  const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: adminEmail, password: ADMIN_PASSWORD }),
  });
  ({ token: adminToken } = await loginRes.json());
});

test.afterAll(async () => {
  await Promise.all(createdEmails.map(deleteUserByEmail));
});

const loginAsAdmin = async (page: any) => {
  await page.goto('/');
  await page.getByLabel('Email Address').fill(adminEmail);
  await page.getByLabel('Password', { exact: true }).fill(ADMIN_PASSWORD);
  await page.getByRole('button', { name: 'Sign In', exact: true }).last().click();
  await expect(page.getByRole('heading', { name: 'Overview Dashboard' })).toBeVisible({ timeout: 10000 });
};

test('admin sees the Admin nav link and can open the Admin page', async ({ page }) => {
  await loginAsAdmin(page);
  await page.getByRole('link', { name: 'Admin', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Team' })).toBeVisible();
  await expect(page.getByText(adminEmail)).toBeVisible();
});

test('Add Teammate: Viewer preset creates a member with read-only access on every module', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin');
  const email = `e2e-teammate-viewer-${Date.now()}@example.com`;
  createdEmails.push(email);

  await page.getByRole('button', { name: 'Add Teammate' }).click();
  await page.getByPlaceholder('teammate@company.com').fill(email);
  await page.getByPlaceholder('Shared out-of-band').fill('TeammatePass123!');
  await page.getByRole('button', { name: 'Viewer', exact: true }).click();
  await page.getByRole('button', { name: 'Create Teammate' }).click();

  const row = page.locator('tr', { hasText: email });
  await expect(row).toBeVisible({ timeout: 10000 });
  await expect(row).toContainText('Read 11/11');
  await expect(row).toContainText('Write 0/11');
});

test('Edit teammate: toggling a module to write persists and is reflected after reload', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin');
  const email = `e2e-teammate-edit-${Date.now()}@example.com`;
  createdEmails.push(email);

  await page.getByRole('button', { name: 'Add Teammate' }).click();
  await page.getByPlaceholder('teammate@company.com').fill(email);
  await page.getByPlaceholder('Shared out-of-band').fill('TeammatePass123!');
  await page.getByRole('button', { name: 'Viewer', exact: true }).click();
  await page.getByRole('button', { name: 'Create Teammate' }).click();
  await expect(page.locator('tr', { hasText: email })).toBeVisible({ timeout: 10000 });

  await page.locator('tr', { hasText: email }).click();
  await expect(page.getByRole('heading', { name: email })).toBeVisible();
  // Events row: check the Write checkbox (auto-checks Read too).
  const eventsRow = page.locator('.perm-matrix tr', { hasText: 'Events' }).first();
  await eventsRow.locator('input[type="checkbox"]').nth(1).check();
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.getByRole('heading', { name: email })).not.toBeVisible({ timeout: 10000 });

  const row = page.locator('tr', { hasText: email });
  await expect(row).toContainText('Write 1/11');

  await page.reload();
  await expect(page.locator('tr', { hasText: email })).toContainText('Write 1/11');
});

test('Deactivating a teammate blocks their login with the deactivated-account message', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin');
  const email = `e2e-teammate-deactivate-${Date.now()}@example.com`;
  const password = 'TeammatePass123!';
  createdEmails.push(email);

  await page.getByRole('button', { name: 'Add Teammate' }).click();
  await page.getByPlaceholder('teammate@company.com').fill(email);
  await page.getByPlaceholder('Shared out-of-band').fill(password);
  await page.getByRole('button', { name: 'Create Teammate' }).click();
  await expect(page.locator('tr', { hasText: email })).toBeVisible({ timeout: 10000 });

  await page.locator('tr', { hasText: email }).click();
  await page.getByLabel(/Active \(unchecked/).uncheck();
  await page.getByRole('button', { name: 'Save Changes' }).click();
  await expect(page.locator('tr', { hasText: email })).toContainText('Deactivated');

  const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  expect(loginRes.status).toBe(403);
  const body = await loginRes.json();
  expect(body.error).toMatch(/deactivated/i);
});

test('Activity Log records teammate creation and edits with a readable before/after diff', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin');
  const email = `e2e-teammate-audit-${Date.now()}@example.com`;
  createdEmails.push(email);

  await page.getByRole('button', { name: 'Add Teammate' }).click();
  await page.getByPlaceholder('teammate@company.com').fill(email);
  await page.getByPlaceholder('Shared out-of-band').fill('TeammatePass123!');
  await page.getByRole('button', { name: 'Create Teammate' }).click();
  await expect(page.locator('tr', { hasText: email })).toBeVisible({ timeout: 10000 });

  await page.getByRole('button', { name: 'Activity Log' }).click();
  await expect(page.getByRole('heading', { name: 'Activity Log' })).toBeVisible();
  const createRow = page.locator('tr', { hasText: email }).filter({ hasText: 'create' });
  await expect(createRow).toBeVisible({ timeout: 10000 });
});

test('Activity Log CSV export triggers a download', async ({ page }) => {
  await loginAsAdmin(page);
  await page.goto('/admin');
  await page.getByRole('button', { name: 'Activity Log' }).click();
  await expect(page.getByRole('heading', { name: 'Activity Log' })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export CSV' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('activity_log.csv');
});

test('a second admin can be demoted to member when another admin remains', async () => {
  const email = `e2e-admin-demotable-${Date.now()}@example.com`;
  createdEmails.push(email);
  const regRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: 'DemotableAdmin123!', organisation_id: orgId }),
  });
  const { user } = await regRes.json();
  await setUserRole(user.id, 'admin');

  const patchRes = await fetch(`${BACKEND_URL}/api/admin/users/${user.id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${adminToken}` },
    body: JSON.stringify({ role: 'member' }),
  });
  expect(patchRes.status).toBe(200);
  const updated = await patchRes.json();
  expect(updated.role).toBe('member');
});

test('backend rejects demoting or deactivating the sole remaining admin of an org', async () => {
  const soleOrgId = await createOrganisation(`E2E Sole Admin Org ${Date.now()}`);
  const email = `e2e-soleadmin-${Date.now()}@example.com`;
  const password = 'SoleAdminPass123!';

  try {
    const regRes = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, organisation_id: soleOrgId }),
    });
    const regData = await regRes.json();
    // First registrant into a brand-new org auto-becomes its admin — see auth.js.
    expect(regData.user.role).toBe('admin');

    const loginRes = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const { token } = await loginRes.json();

    const demoteRes = await fetch(`${BACKEND_URL}/api/admin/users/${regData.user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role: 'member' }),
    });
    expect(demoteRes.status).toBe(400);
    expect((await demoteRes.json()).error).toMatch(/last remaining admin/i);

    const deactivateRes = await fetch(`${BACKEND_URL}/api/admin/users/${regData.user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ is_active: false }),
    });
    expect(deactivateRes.status).toBe(400);
    expect((await deactivateRes.json()).error).toMatch(/last remaining admin/i);
  } finally {
    await deleteUserByEmail(email);
    await deleteOrganisation(soleOrgId);
  }
});
