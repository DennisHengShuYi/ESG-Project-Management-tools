import { test, expect } from '@playwright/test';
import { api } from '../utils/api';

// Governance.tsx saves to the same organisation_id+'2025' row that Dashboard's
// Climate Finance tab also writes to (both edit module_climate_finance directly).
// Snapshot/restore protects whatever real data already exists there.
let originalGov: Record<string, any>;

test.beforeAll(async () => {
  originalGov = await api.getGovernance('2025');
});

test.afterAll(async () => {
  await api.saveGovernance(originalGov, '2025');
});

// FIXED (see final report): Governance.tsx's data-loading useEffect now has
// a mount-guard (`let active = true; ... return () => { active = false; }`),
// so React.StrictMode's dev-mode double-invoke can no longer let a stale
// fetch overwrite an in-progress edit — only the latest effect invocation's
// fetch is ever allowed to call setFormData. See the dedicated regression
// test below, which edits and saves with no settling wait at all.
const gotoGovernance = async (page: any) => {
  await page.goto('/governance');
  await expect(page.getByRole('heading', { name: 'Corporate Governance' })).toBeVisible();
  await page.waitForLoadState('networkidle');
};

test.beforeEach(async ({ page }) => {
  await gotoGovernance(page);
});

const saveAndAcceptAlert = async (page: any) => {
  // handleSave is `async () => { await saveCorporateGovernance(formData); alert(...); }`
  // — the alert only fires once the save has resolved. Registering a handler
  // without awaiting the dialog event itself means the test can race ahead
  // (e.g. reload or hit the API) before the save has actually completed.
  const dialogPromise = page.waitForEvent('dialog');
  await page.getByRole('button', { name: 'Save Data' }).click();
  const dialog = await dialogPromise;
  await dialog.accept();
};

test('FIXED: an edit made immediately after navigation (no settling wait) is not lost to the StrictMode double-fetch', async ({ page }) => {
  // Deliberately does NOT use gotoGovernance()'s networkidle wait — this is
  // exactly the race window the bug used to occupy.
  await page.goto('/governance');
  await expect(page.getByRole('heading', { name: 'Corporate Governance' })).toBeVisible();

  const value = `E2E immediate-edit ${Date.now()}`;
  await page.locator('input[name="gov_committee_name"]').fill(value);
  await saveAndAcceptAlert(page);

  const gov = await api.getGovernance('2025');
  expect(gov.gov_committee_name).toBe(value);
});

test('Sustainability Committee Name persists', async ({ page }) => {
  const value = `E2E Committee ${Date.now()}`;
  await page.locator('input[name="gov_committee_name"]').fill(value);
  await saveAndAcceptAlert(page);

  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('input[name="gov_committee_name"]')).toHaveValue(value);

  const gov = await api.getGovernance('2025');
  expect(gov.gov_committee_name).toBe(value);
});

test('Board Oversight Description is persisted wrapped in <p> tags (existing behavior)', async ({ page }) => {
  const value = `E2E oversight text ${Date.now()}`;
  const textarea = page.locator('textarea').nth(0); // Board Oversight Description is the first textarea
  await textarea.fill(value);
  await saveAndAcceptAlert(page);

  const gov = await api.getGovernance('2025');
  expect(gov.gov_board_oversight_text).toBe(`<p>${value}</p>`);

  // The page strips tags back out for display, so the textarea should show plain text on reload.
  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('textarea').nth(0)).toHaveValue(value);
});

test('ERM Integration Status select persists', async ({ page }) => {
  await page.locator('select[name="risk_erm_integration_status"]').selectOption('Partially Integrated');
  await saveAndAcceptAlert(page);

  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('select[name="risk_erm_integration_status"]')).toHaveValue('Partially Integrated');
  const gov = await api.getGovernance('2025');
  expect(gov.risk_erm_integration_status).toBe('Partially Integrated');
});

test('Climate Finance numeric fields persist and accept negative values without crashing', async ({ page }) => {
  await page.locator('input[name="climate_transition_risk_rm"]').fill('150000');
  await page.locator('input[name="climate_physical_risk_rm"]').fill('-500');
  await saveAndAcceptAlert(page);

  await page.reload();
  await page.waitForLoadState('networkidle');
  await expect(page.locator('input[name="climate_transition_risk_rm"]')).toHaveValue('150000');
  await expect(page.locator('input[name="climate_physical_risk_rm"]')).toHaveValue('-500');

  const gov = await api.getGovernance('2025');
  expect(gov.climate_transition_risk_rm).toBe(150000);
  expect(gov.climate_physical_risk_rm).toBe(-500);
});

test('clearing a numeric field saves as 0, not NaN', async ({ page }) => {
  await page.locator('input[name="climate_capex_rm"]').fill('1000');
  await saveAndAcceptAlert(page);
  await page.reload();
  await page.waitForLoadState('networkidle');

  await page.locator('input[name="climate_capex_rm"]').fill('');
  await saveAndAcceptAlert(page);

  const gov = await api.getGovernance('2025');
  expect(gov.climate_capex_rm).toBe(0);
});
