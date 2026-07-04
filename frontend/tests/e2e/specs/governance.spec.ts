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
  // The page's year-default heuristic can land on a year other than 2025
  // (e.g. if any event exists with the current OS-clock year) — pin
  // explicitly so these tests don't depend on which year that heuristic picks.
  await page.locator('.header-actions select').selectOption('2025');
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
  // Deliberately does NOT use gotoGovernance()'s networkidle wait, and
  // deliberately does NOT pin the year via the dropdown either — both are
  // real async state transitions, and triggering one mid-edit would just
  // substitute a different race for the one this test exists to guard
  // against. Whichever year the page lands on by default, read it back
  // from the dropdown so the assertion targets the same row that was saved.
  await page.goto('/governance');
  await expect(page.getByRole('heading', { name: 'Corporate Governance' })).toBeVisible();

  const value = `E2E immediate-edit ${Date.now()}`;
  await page.locator('input[name="gov_committee_name"]').fill(value);

  // Snapshot whichever year the page actually landed on, right before the
  // save lands — beforeAll only protects year 2025, but the default-year
  // heuristic can pick a different year (e.g. if any event has the current
  // OS-clock year), and this test deliberately doesn't pin one.
  const year = await page.locator('.header-actions select').inputValue();
  const preSave = await api.getGovernance(year);

  await saveAndAcceptAlert(page);

  const gov = await api.getGovernance(year);
  expect(gov.gov_committee_name).toBe(value);

  await api.saveGovernance(preSave, year);
});

test('Sustainability Committee Name persists', async ({ page }) => {
  const value = `E2E Committee ${Date.now()}`;
  await page.locator('input[name="gov_committee_name"]').fill(value);
  await saveAndAcceptAlert(page);

  // A full reload remounts the page, which resets selectedYear back to
  // whatever the year-default heuristic picks — re-pin to 2025.
  await page.reload();
  await page.locator('.header-actions select').selectOption('2025');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('input[name="gov_committee_name"]')).toHaveValue(value);

  const gov = await api.getGovernance('2025');
  expect(gov.gov_committee_name).toBe(value);
});

test('Board Oversight Description persists as plain text', async ({ page }) => {
  const value = `E2E oversight text ${Date.now()}`;
  const textarea = page.locator('textarea').nth(0); // Board Oversight Description is the first textarea
  await textarea.fill(value);
  await saveAndAcceptAlert(page);

  const gov = await api.getGovernance('2025');
  expect(gov.gov_board_oversight_text).toBe(value);

  // A full reload remounts the page, which resets selectedYear back to
  // whatever the year-default heuristic picks — re-pin to 2025.
  await page.reload();
  await page.locator('.header-actions select').selectOption('2025');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('textarea').nth(0)).toHaveValue(value);
});

test('ERM Integration Status select persists', async ({ page }) => {
  await page.locator('select[name="risk_erm_integration_status"]').selectOption('Partially Integrated');
  await saveAndAcceptAlert(page);

  // A full reload remounts the page, which resets selectedYear back to
  // whatever the year-default heuristic picks — re-pin to 2025.
  await page.reload();
  await page.locator('.header-actions select').selectOption('2025');
  await page.waitForLoadState('networkidle');
  await expect(page.locator('select[name="risk_erm_integration_status"]')).toHaveValue('Partially Integrated');
  const gov = await api.getGovernance('2025');
  expect(gov.risk_erm_integration_status).toBe('Partially Integrated');
});

// Climate Finance numeric-field tests (negative values, clear-saves-as-0)
// moved to dashboard.spec.ts — those fields live on Dashboard's Climate
// Finance tab, not on this page.
