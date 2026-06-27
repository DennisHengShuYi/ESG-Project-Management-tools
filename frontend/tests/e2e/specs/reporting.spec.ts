import { test, expect } from '@playwright/test';
import { api } from '../utils/api';

test('shows the 3 report cards with completeness badges', async ({ page }) => {
  await page.goto('/reporting');
  await expect(page.getByRole('heading', { name: 'Compliance & Reporting' })).toBeVisible();
  await expect(page.getByText('Bursa Malaysia Sustainability Statement')).toBeVisible();
  await expect(page.getByText('IFRS S1 & S2 Disclosure')).toBeVisible();
  await expect(page.getByText('GRI Standards Report')).toBeVisible();
});

test('FIXED: completeness now requires actual reported data, not just an event existing', async ({ page }) => {
  // Regression test: isComplete used to be `currentEvents.length > 0` — an
  // event with every metric left at 0 still showed "Data Complete". It now
  // additionally requires every mandatory pillar (Green Ops / Health & Safety
  // / Procurement / Financial) to have at least one event with a nonzero value.
  const complete = await api.createEvent({ event_name: `[E2E] ReportingComplete ${Date.now()}`, reporting_year: '2096', event_status: 'Active' });
  await api.bulkUpdate(complete.id, {
    total_energy_mwh: '100',
    man_hours_actual: '500',
    procurement_total_rm: '1000',
    budget_actual: '5000',
  });

  const incomplete = await api.createEvent({ event_name: `[E2E] ReportingIncomplete ${Date.now()}`, reporting_year: '2095', event_status: 'Active' });
  // Left with all mandatory-pillar fields at their zero default — no bulkUpdate call.

  await page.goto('/reporting');
  await expect(page.getByRole('heading', { name: 'Compliance & Reporting' })).toBeVisible();

  await page.locator('select').first().selectOption('2096');
  await expect(page.getByText('Data Complete')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export PDF' })).toBeEnabled();

  await page.locator('select').first().selectOption('2095');
  await expect(page.getByText('Missing Mandatory Data')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export PDF' })).toBeDisabled();

  await api.deleteEvent(complete.id);
  await api.deleteEvent(incomplete.id);
});
