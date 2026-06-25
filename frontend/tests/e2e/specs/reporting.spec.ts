import { test, expect } from '@playwright/test';
import { api } from '../utils/api';

// Reporting.tsx's year <select> only ever offers years that either have at
// least one event OR equal the current calendar year (see its availableYears
// computation) — there is no way to select an arbitrary year that was never
// an option to begin with. So a guaranteed-empty-but-selectable year can only
// ever be the current year, and only for as long as nothing has tagged it yet.
// That's no longer a safe assumption now that the reporting-year auto-fill
// fix is tagging real events with the current year — so this checks the
// actual event count for the current year live, instead of assuming it's 0.
async function pickEmptyYearOrSkipReason(): Promise<{ year: string; trulyEmpty: boolean }> {
  const year = String(new Date().getFullYear());
  const events = await api.getEvents();
  const trulyEmpty = !events.some((e: any) => e.reporting_year === year);
  return { year, trulyEmpty };
}

test('shows the 3 report cards with completeness badges', async ({ page }) => {
  await page.goto('/reporting');
  await expect(page.getByRole('heading', { name: 'Compliance & Reporting' })).toBeVisible();
  await expect(page.getByText('Bursa Malaysia Sustainability Statement')).toBeVisible();
  await expect(page.getByText('IFRS S1 & S2 Disclosure')).toBeVisible();
  await expect(page.getByText('GRI Standards Report')).toBeVisible();
});

test('completeness badge reflects whether events exist for the selected year (no events -> Missing Mandatory Data)', async ({ page }) => {
  // FINDING: "Missing Mandatory Data" doesn't actually check any field-level
  // completeness — Reporting.tsx's isComplete is just `currentEvents.length > 0`.
  // The label implies a content check; the real check is just "any event exists?".
  const name = `[E2E] ReportingCompleteness ${Date.now()}`;
  const created = await api.createEvent({ event_name: name, reporting_year: '2096', event_status: 'Active' });
  const { year: emptyYear, trulyEmpty } = await pickEmptyYearOrSkipReason();

  // availableYears is computed from events fetched at mount time, so the
  // newly-created year must exist in state before the page loads, not after.
  await page.goto('/reporting');
  await expect(page.getByRole('heading', { name: 'Compliance & Reporting' })).toBeVisible();

  await page.locator('select').first().selectOption('2096');
  await expect(page.getByText('Data Complete')).toBeVisible();

  await page.locator('select').first().selectOption(emptyYear);
  if (trulyEmpty) {
    await expect(page.getByText('Missing Mandatory Data')).toBeVisible();
  } else {
    // Real events now exist for the current year (expected, post auto-fill-fix) —
    // the only year guaranteed selectable without data is no longer guaranteed
    // empty. Assert the badge still correctly reflects "has events" either way.
    await expect(page.getByText('Data Complete')).toBeVisible();
  }

  await api.deleteEvent(created.id);
});

test('Export buttons are disabled when the completeness check fails, enabled otherwise', async ({ page }) => {
  const name = `[E2E] ExportButtons ${Date.now()}`;
  const created = await api.createEvent({ event_name: name, reporting_year: '2094', event_status: 'Active' });
  const { year: emptyYear, trulyEmpty } = await pickEmptyYearOrSkipReason();

  await page.goto('/reporting');
  await expect(page.getByRole('heading', { name: 'Compliance & Reporting' })).toBeVisible();

  await page.locator('select').first().selectOption('2094');
  await expect(page.getByRole('button', { name: 'Export PDF' })).toBeEnabled();

  await page.locator('select').first().selectOption(emptyYear);
  if (trulyEmpty) {
    await expect(page.getByRole('button', { name: 'Export PDF' })).toBeDisabled();
  } else {
    await expect(page.getByRole('button', { name: 'Export PDF' })).toBeEnabled();
  }

  await api.deleteEvent(created.id);
});
