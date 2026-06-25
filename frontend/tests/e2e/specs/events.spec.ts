import { test, expect } from '@playwright/test';
import { api } from '../utils/api';
import { modalField } from '../utils/event-modal';

const tag = (name: string) => `[E2E] ${name} ${Date.now()}`;

// Tracks every event created during a test so afterEach can always clean
// up — even if the test fails partway through, before its own cleanup step.
let createdIds: string[] = [];
test.afterEach(async () => {
  await Promise.all(createdIds.map((id) => api.deleteEvent(id).catch(() => {})));
  createdIds = [];
});

test.beforeEach(async ({ page }) => {
  await page.goto('/events');
});

test('New Event button opens the create modal', async ({ page }) => {
  await page.getByRole('button', { name: 'New Event' }).click();
  await expect(page.getByRole('heading', { name: 'New Event / Project' })).toBeVisible();
});

test('empty event name is rejected client-side and nothing is persisted', async ({ page }) => {
  const before = await api.getEvents();
  await page.getByRole('button', { name: 'New Event' }).click();
  await page.getByRole('button', { name: 'Create Event' }).click();
  await expect(page.getByText('Event name is required.')).toBeVisible();
  const after = await api.getEvents();
  expect(after.length).toBe(before.length);
});

test('FINDING: creating an event with no Start/End Date crashes the backend (500)', async ({ page }) => {
  // EMPTY_EVENT defaults event_start_date/event_end_date to '' (not null/undefined).
  // POST /api/events (backend/src/server.js CORE_FIELDS passthrough) forwards that
  // empty string straight into a Postgres `date` column, which rejects it outright:
  // "invalid input syntax for type date: \"\"" — a 500, surfaced to the user only
  // as the generic "Failed to save. Please try again." with no indication why.
  const name = tag('NoDates');
  await page.getByRole('button', { name: 'New Event' }).click();
  await modalField(page, 'Event Name').fill(name);
  await page.getByRole('button', { name: 'Create Event' }).click();
  await expect(page.getByText('Failed to save. Please try again.')).toBeVisible();
  const serverEvents = await api.getEvents();
  expect(serverEvents.find((e: any) => e.event_name === name)).toBeUndefined();
});

test('creating an event persists it in the backend, not just in the UI', async ({ page }) => {
  const name = tag('Create');
  await page.getByRole('button', { name: 'New Event' }).click();
  await modalField(page, 'Event Name').fill(name);
  await modalField(page, 'Client / Organisation').fill('Acme Corp');
  await modalField(page, 'Location').fill('Penang');
  // Dates filled to dodge the empty-date 500 above — this test is about
  // name/client/location persistence, not date handling.
  await modalField(page, 'Start Date').fill('2026-01-01');
  await modalField(page, 'End Date').fill('2026-01-02');
  await page.getByRole('button', { name: 'Create Event' }).click();

  // UI reflects it immediately
  await expect(page.getByRole('cell', { name })).toBeVisible();

  // Confirm via a direct, independent API call (not the same optimistic state)
  const serverEvents = await api.getEvents();
  const match = serverEvents.find((e: any) => e.event_name === name);
  expect(match, 'event should exist via direct API fetch').toBeTruthy();
  expect(match.client_name).toBe('Acme Corp');
  expect(match.event_location).toBe('Penang');
  createdIds.push(match.id);
});

test('setting a Start Date auto-fills Reporting Year, and it persists', async ({ page }) => {
  const name = tag('AutoYear');
  await page.getByRole('button', { name: 'New Event' }).click();
  await modalField(page, 'Event Name').fill(name);
  await modalField(page, 'Start Date').fill('2026-06-24');
  await modalField(page, 'End Date').fill('2026-06-25'); // avoid the empty-date 500 (see FINDING test above)
  await page.getByRole('button', { name: 'Create Event' }).click();

  const row = page.getByRole('row', { name });
  await expect(row).toContainText('2026');

  const serverEvents = await api.getEvents();
  const match = serverEvents.find((e: any) => e.event_name === name);
  expect(match.reporting_year).toBe('2026');
  expect(match.event_start_date).toBe('2026-06-24');
  createdIds.push(match.id);
});

test('a far-future Start Date still auto-fills the matching Reporting Year (no hardcoded year ceiling)', async ({ page }) => {
  const name = tag('FarFuture');
  await page.getByRole('button', { name: 'New Event' }).click();
  await modalField(page, 'Event Name').fill(name);
  await modalField(page, 'Start Date').fill('2031-01-15');
  await modalField(page, 'End Date').fill('2031-01-16'); // avoid the empty-date 500 (see FINDING test above)
  await page.getByRole('button', { name: 'Create Event' }).click();

  const serverEvents = await api.getEvents();
  const match = serverEvents.find((e: any) => e.event_name === name);
  expect(match.reporting_year).toBe('2031');
  createdIds.push(match.id);

  // And it should now be selectable on the Dashboard's Financial Year dropdown.
  await page.goto('/');
  await expect(page.locator('.year-selector select')).toContainText('FYE 2031');
});

test('editing an event persists the change after reload', async ({ page }) => {
  const original = tag('EditMe');
  const updated = `${original}-updated`;
  const created = await api.createEvent({ event_name: original, event_status: 'Draft' });
  createdIds.push(created.id);
  await page.reload();

  const row = page.getByRole('row', { name: original });
  await row.getByTitle('Edit').click();
  await expect(page.getByRole('heading', { name: 'Edit Event' })).toBeVisible();
  await modalField(page, 'Event Name').fill(updated);
  await modalField(page, 'Status').selectOption('Active');
  await page.getByRole('button', { name: 'Save Changes' }).click();

  await page.reload();
  await expect(page.getByRole('cell', { name: updated })).toBeVisible();
  const detail = await api.getEventDetail(created.id);
  expect(detail.event_name).toBe(updated);
  expect(detail.event_status).toBe('Active');
});

test('deleting an event: cancel keeps it, confirm removes it server-side (soft delete)', async ({ page }) => {
  const name = tag('DeleteMe');
  const created = await api.createEvent({ event_name: name, event_status: 'Draft' });
  await page.reload();

  const row = page.getByRole('row', { name });
  await row.getByTitle('Delete').click();
  await expect(page.getByText(/cannot be undone/)).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('cell', { name })).toBeVisible();

  await row.getByTitle('Delete').click();
  // Scoped to the modal: every table row also has its own icon button whose
  // accessible name is "Delete" (via title=), so an unscoped lookup is ambiguous.
  await page.locator('.modal-footer').getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(page.getByRole('cell', { name })).not.toBeVisible();

  const serverEvents = await api.getEvents();
  expect(serverEvents.find((e: any) => e.id === created.id)).toBeUndefined();
  // Not pushed to createdIds — it's already deleted, a second delete is unnecessary.
});

test('search box filters the table by name and client', async ({ page }) => {
  const name = tag('SearchTarget');
  const created = await api.createEvent({ event_name: name, client_name: 'UniqueClientXYZ', event_status: 'Draft' });
  createdIds.push(created.id);
  await page.reload();

  await page.getByPlaceholder('Search events or clients…').fill('UniqueClientXYZ');
  await expect(page.getByRole('cell', { name })).toBeVisible();
  const rows = page.locator('tbody tr');
  await expect(rows).toHaveCount(1);

  await page.getByPlaceholder('Search events or clients…').fill('NoSuchClientWillMatch');
  await expect(page.getByText('No events match your search')).toBeVisible();
});

test('status filter chips show correct counts and filter the table', async ({ page }) => {
  const name = tag('StatusFilter');
  const created = await api.createEvent({ event_name: name, event_status: 'Completed' });
  createdIds.push(created.id);
  await page.reload();

  const allCount = await api.getEvents().then((evts: any[]) => evts.length);
  await expect(page.locator('.summary-chip', { hasText: 'All' })).toContainText(String(allCount));

  await page.locator('.summary-chip', { hasText: 'Completed' }).click();
  await expect(page.getByRole('cell', { name })).toBeVisible();
  const rows = page.locator('tbody tr');
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    await expect(rows.nth(i)).toContainText('Completed');
  }
});
