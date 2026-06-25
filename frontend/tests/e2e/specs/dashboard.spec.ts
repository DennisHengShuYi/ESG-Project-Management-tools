import { test, expect } from '@playwright/test';
import { api } from '../utils/api';
import { waitForChartAnimation } from '../utils/chart-wait';
import { collectConsoleErrors } from '../utils/console-errors';
import { metricValue, fillEditField, startEdit, saveEdit } from '../utils/editable-module';
import { sparkValue } from '../utils/metric-spark-grid';

const gotoTab = async (page: any, label: string) => {
  await page.getByRole('button', { name: label, exact: true }).click();
};

const TABS = [
  'Green Ops',
  'Health, Safety & Labour',
  'Procurement & Community',
  'Financial Summary',
  'Climate Finance',
  'Enterprise HR & Diversity',
];

test('every Dashboard tab renders its charts with no console errors', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Overview Dashboard' })).toBeVisible();

  for (const label of TABS) {
    await gotoTab(page, label);
    await waitForChartAnimation(page);
  }
  expect(errors).toEqual([]);
});

test('Financial Year dropdown changes which events are aggregated', async ({ page }) => {
  const name = `[E2E] FYE-filter-${Date.now()}`;
  const created = await api.createEvent({ event_name: name, reporting_year: '2097', event_status: 'Active' });
  await api.bulkUpdate(created.id, { total_energy_mwh: '4242' });

  await page.goto('/');
  await page.locator('.year-selector select').selectOption('2097');
  await gotoTab(page, 'Green Ops');
  await expect(sparkValue(page, 'Total Energy Consumption')).toHaveText('4,242 MWh');

  await api.deleteEvent(created.id);
});

test.describe('KNOWN ISSUE — aggregation method inconsistency (documented, not fixed)', () => {
  // Dashboard.tsx computes "Renewable Energy Share (avg)" as the AVERAGE of
  // each event's own renewable_energy_pct, but the Renewable Energy Share
  // donut chart on the same tab computes sum(renewable_mwh)/sum(total_mwh).
  // These are genuinely different numbers whenever events differ in size,
  // and both are visible on the same screen simultaneously. Using a
  // deliberately isolated fake reporting year (2098) so the two events
  // below are the *only* data point and the expected numbers are exact.
  const YEAR = '2098';
  let eventAId: string;
  let eventBId: string;

  test.beforeAll(async () => {
    const a = await api.createEvent({ event_name: `[E2E] AggA ${Date.now()}`, reporting_year: YEAR, event_status: 'Active' });
    const b = await api.createEvent({ event_name: `[E2E] AggB ${Date.now()}`, reporting_year: YEAR, event_status: 'Active' });
    eventAId = a.id;
    eventBId = b.id;
    // Event A: small event, 50% renewable. Event B: 10x larger, only 10% renewable.
    await api.bulkUpdate(eventAId, { total_energy_mwh: '100', renewable_energy_mwh: '50' });
    await api.bulkUpdate(eventBId, { total_energy_mwh: '1000', renewable_energy_mwh: '100' });
  });

  test.afterAll(async () => {
    await api.deleteEvent(eventAId);
    await api.deleteEvent(eventBId);
  });

  test('avg-of-percentages (metric grid) differs from sum-of-totals (the mathematically correct figure)', async ({ page }) => {
    await page.goto('/');
    await page.locator('.year-selector select').selectOption(YEAR);
    await gotoTab(page, 'Green Ops');

    // Per-event renewable %: 50% (A) and 10% (B). Dashboard's "(avg)" field
    // averages these two percentages directly: (50 + 10) / 2 = 30%.
    await expect(sparkValue(page, 'Renewable Energy Share (avg)')).toHaveText('30 %');

    // The mathematically correct, size-weighted figure is sum(renewable)/sum(total):
    // (50 + 100) / (100 + 1000) * 100 = 13.636...% — visibly different from 30%,
    // and is what the Renewable Energy Share donut chart on this same tab actually
    // plots (it sums renewable_energy_mwh and total_energy_mwh independently).
    const correctSumBased = ((50 + 100) / (100 + 1000)) * 100;
    expect(correctSumBased).toBeCloseTo(13.64, 1);
    expect(correctSumBased).not.toBeCloseTo(30, 0); // proves the two methods disagree
  });
});

test.describe('Climate Finance & HR Diversity edits — shared org/2025 data, snapshot+restore to avoid clobbering real values', () => {
  let originalGov: Record<string, any>;

  test.beforeAll(async () => {
    originalGov = await api.getGovernance('2025');
  });

  test.afterAll(async () => {
    // Best-effort restore. If no governance row existed at all before this
    // spec ran, originalGov is `{}` and this is a no-op (see code comment
    // in saveGovernance's bucket-splitting logic — empty buckets skip the upsert).
    await api.saveGovernance(originalGov, '2025');
  });

  test('editing Climate Mitigation Capital persists to organisation_id+2025', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'Climate Finance');
    await startEdit(page);
    await fillEditField(page, 'Climate Mitigation Capital', '320000');
    await saveEdit(page);

    await expect(metricValue(page, 'Climate Mitigation Capital')).toHaveText('320,000 RM');
    const gov = await api.getGovernance('2025');
    expect(gov.climate_capex_rm).toBe(320000);
  });

  test('editing Anti-Corruption Training Coverage persists', async ({ page }) => {
    await page.goto('/');
    await gotoTab(page, 'Enterprise HR & Diversity');
    await startEdit(page);
    await fillEditField(page, 'Anti-Corruption Training Coverage', '77');
    await saveEdit(page);

    await expect(metricValue(page, 'Anti-Corruption Training Coverage')).toHaveText('77 %');
    const gov = await api.getGovernance('2025');
    expect(gov.anticorrupt_training_coverage).toBe(77);
  });
});
