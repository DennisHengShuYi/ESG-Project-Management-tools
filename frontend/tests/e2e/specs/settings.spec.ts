import { test, expect } from '@playwright/test';
import { api } from '../utils/api';

/**
 * KNOWN LIMITATION (see final report): GET/POST /api/settings
 * (backend/src/server.js) read/write a single global `app_settings` row
 * with NO organisation_id filter — unlike Governance, which is correctly
 * scoped per organisation_id+reporting_year. Every organisation using this
 * backend shares one settings row. This can't be demonstrated with a
 * single-org E2E fixture (there is only one organisation seeded in this
 * database), so it's flagged here and in the report rather than asserted.
 * Snapshot/restore below protects whatever real settings already exist.
 */
let originalSettings: Record<string, any>;

test.beforeAll(async () => {
  originalSettings = await api.getSettings();
});

test.afterAll(async () => {
  await api.saveSettings(originalSettings);
});

// Same StrictMode double-fetch race as Governance.tsx (see governance.spec.ts) —
// Settings.tsx's load useEffect has the identical no-guard pattern. Wait for
// network idle so both dev-mode duplicate fetches resolve before interacting.
test.beforeEach(async ({ page }) => {
  await page.goto('/settings');
  await expect(page.getByRole('heading', { name: 'Settings & Admin' })).toBeVisible();
  await page.waitForLoadState('networkidle');
});

const saveAndAcceptAlert = async (page: any) => {
  // See governance.spec.ts for why this must await the dialog event itself,
  // not just register a handler — handleSave's alert() fires only after the
  // save's await resolves, so awaiting it is what guarantees the save landed.
  const dialogPromise = page.waitForEvent('dialog');
  await page.getByRole('button', { name: 'Save Settings' }).click();
  const dialog = await dialogPromise;
  await dialog.accept();
};

test('Internal Carbon Price persists, including a decimal value', async ({ page }) => {
  await page.locator('input[name="internal_carbon_price"]').fill('87.5');
  await saveAndAcceptAlert(page);

  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('input[name="internal_carbon_price"]')).toHaveValue('87.5');
  const settings = await api.getSettings();
  expect(settings.internal_carbon_price).toBe(87.5);
});

test('Grid Emission Factor accepts the documented default and small step values', async ({ page }) => {
  await page.locator('input[name="grid_emission_factor"]').fill('0.694');
  await saveAndAcceptAlert(page);

  const settings = await api.getSettings();
  expect(settings.grid_emission_factor).toBe(0.694);
});

test('a framework toggle checkbox persists its checked state', async ({ page }) => {
  const checkbox = page.locator('input[name="framework_ifrs1"]');
  const wasChecked = await checkbox.isChecked();

  await checkbox.setChecked(!wasChecked);
  await saveAndAcceptAlert(page);

  const settings = await api.getSettings();
  expect(settings.frameworks?.ifrs1).toBe(!wasChecked);

  // restore immediately so other tests in this file see a consistent starting point
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.locator('input[name="framework_ifrs1"]').setChecked(wasChecked);
  await saveAndAcceptAlert(page);
});

test('the Bursa Malaysia PN9-A toggle is permanently disabled and always checked', async ({ page }) => {
  const lockedToggle = page.locator('.toggle-item', { hasText: 'Bursa Malaysia PN9-A' }).locator('input[type="checkbox"]');
  await expect(lockedToggle).toBeDisabled();
  await expect(lockedToggle).toBeChecked();
});

test('negative LTIR threshold is accepted without crashing (no business-rule validation)', async ({ page }) => {
  await page.locator('input[name="ltir_threshold"]').fill('-1');
  await saveAndAcceptAlert(page);

  const settings = await api.getSettings();
  expect(settings.ltir_threshold).toBe(-1);
});
