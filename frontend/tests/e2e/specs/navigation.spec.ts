import { test, expect } from '@playwright/test';
import { collectConsoleErrors } from '../utils/console-errors';
import { api } from '../utils/api';

let navEventId: string;

test.beforeAll(async () => {
  const created = await api.createEvent({
    event_name: '[E2E] Navigation Test Event',
    event_status: 'Draft',
  });
  navEventId = created.id;
});

test.afterAll(async () => {
  if (navEventId) await api.deleteEvent(navEventId);
});

const PAGES: { path: string; heading: string; ignore?: RegExp[] }[] = [
  { path: '/', heading: 'Overview Dashboard' },
  { path: '/events', heading: 'Events & Projects' },
  { path: '/governance', heading: 'Corporate Governance' },
  { path: '/reporting', heading: 'Compliance & Reporting' },
  { path: '/sdg', heading: 'UN SDG Impact Dashboard' },
];

for (const { path, heading, ignore } of PAGES) {
  test(`${path} loads with no console errors`, async ({ page }) => {
    const errors = collectConsoleErrors(page, ignore);
    await page.goto(path);
    // Governance/Settings gate their entire page behind a data fetch (no
    // skeleton), which can occasionally take longer than the default 5s.
    await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 15000 });
    await page.waitForTimeout(1500); // let async data fetches resolve and settle
    expect(errors, `console errors on ${path}: ${JSON.stringify(errors)}`).toEqual([]);
  });
}

test('/events/:id loads with no console errors', async ({ page }) => {
  const errors = collectConsoleErrors(page);
  await page.goto(`/events/${navEventId}`);
  await expect(page.getByRole('heading', { name: '[E2E] Navigation Test Event' })).toBeVisible();
  await page.waitForTimeout(1500);
  expect(errors, `console errors on /events/:id: ${JSON.stringify(errors)}`).toEqual([]);
});

test('top nav links navigate to the correct pages', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('link', { name: 'Events', exact: true }).click();
  await expect(page).toHaveURL(/\/events$/);
  await expect(page.getByRole('heading', { name: 'Events & Projects' })).toBeVisible();

  await page.getByRole('link', { name: 'Governance', exact: true }).click();
  await expect(page).toHaveURL(/\/governance$/);

  await page.getByRole('link', { name: 'SDG', exact: true }).click();
  await expect(page).toHaveURL(/\/sdg$/);

  await page.getByRole('link', { name: 'Dashboard', exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
});

test('user avatar dropdown shows email and a log-out control', async ({ page }) => {
  await page.goto('/');
  await page.locator('.avatar-btn').click();
  await expect(page.locator('.dropdown-menu')).toBeVisible();
  await expect(page.getByText('Signed in as')).toBeVisible();
  await expect(page.getByRole('button', { name: /Log Out/i })).toBeVisible();
});
