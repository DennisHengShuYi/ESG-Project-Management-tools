import { test, expect } from '@playwright/test';
import { api } from '../utils/api';
import { collectConsoleErrors } from '../utils/console-errors';

test('page loads, summary chip counts add up to total tracked, no console errors', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto('/sdg');
  await expect(page.getByRole('heading', { name: 'UN SDG Impact Dashboard' })).toBeVisible();

  const achieved = await page.locator('.chip-achieved').innerText();
  const partial = await page.locator('.chip-partial').innerText();
  const notStarted = await page.locator('.chip-none').innerText();
  const total = await page.locator('.chip-total').innerText();

  const num = (s: string) => parseInt(s.match(/\d+/)?.[0] || '0', 10);
  expect(num(achieved) + num(partial) + num(notStarted)).toBe(num(total));
  expect(errors).toEqual([]);
});

test('SDG 7 (Affordable & Clean Energy): >=30% renewable share is marked Achieved with a 100% progress bar', async ({ page }) => {
  const YEAR = '2092'; // isolated fake year, no other data to interfere
  const created = await api.createEvent({ event_name: `[E2E] SDG7 ${Date.now()}`, reporting_year: YEAR, event_status: 'Active' });
  await api.bulkUpdate(created.id, { total_energy_mwh: '100', renewable_energy_mwh: '30' });

  await page.goto('/sdg');
  await page.locator('select').first().selectOption(YEAR);

  const card = page.locator('.sdg-card').filter({ has: page.getByText('Affordable & Clean Energy') });
  await expect(card.getByText('Achieved', { exact: true })).toBeVisible();
  await expect(card.getByText('100% toward target')).toBeVisible();

  await api.deleteEvent(created.id);
});

test('SDG 3 (Good Health): zero fatalities and zero LTIR for the period is marked Achieved', async ({ page }) => {
  const YEAR = '2091';
  const created = await api.createEvent({ event_name: `[E2E] SDG3 ${Date.now()}`, reporting_year: YEAR, event_status: 'Active' });
  await api.bulkUpdate(created.id, { fatalities_count: '0', lti_count: '0', man_hours_actual: '1000' });

  await page.goto('/sdg');
  await page.locator('select').first().selectOption(YEAR);

  const card = page.locator('.sdg-card').filter({ has: page.getByText('Good Health & Well-being') });
  await expect(card.getByText('LTIR = 0, Zero fatalities')).toBeVisible();
  await expect(card.getByText('Achieved', { exact: true })).toBeVisible();

  await api.deleteEvent(created.id);
});
