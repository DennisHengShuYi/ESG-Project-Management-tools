import { Page } from '@playwright/test';

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** View-mode metric box for an exact field label (`.metric-label` holds only
 * the label text, no unit suffix, so an exact-anchored match never collides
 * with a similarly-named field, e.g. "Hazardous Waste" vs "Non-Hazardous Waste"). */
export function metricBox(page: Page, label: string) {
  return page
    .locator('.metric-box')
    .filter({ has: page.locator('.metric-label', { hasText: new RegExp(`^${escapeRegExp(label)}$`) }) });
}

export function metricValue(page: Page, label: string) {
  return metricBox(page, label).locator('.metric-value');
}

/** Edit-mode field input for a label. `.edit-label` text is the label
 * immediately followed by a unit-hint span with no separator, so the match
 * is start-anchored rather than exact (still collision-safe: "Non-Hazardous
 * Waste" never starts with "Hazardous Waste"). */
export function editFieldInput(page: Page, label: string) {
  return page
    .locator('.edit-field')
    .filter({ has: page.locator('.edit-label', { hasText: new RegExp(`^${escapeRegExp(label)}`) }) })
    .locator('input, textarea');
}

export async function fillEditField(page: Page, label: string, value: string) {
  await editFieldInput(page, label).fill(value);
}

export async function startEdit(page: Page) {
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
}

export async function saveEdit(page: Page) {
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  // EditableModule's handleSave fires onSave(draft) then immediately flips
  // back to view mode — it does NOT await the parent's async save+refetch.
  // Reading a value right after click() can race ahead of that refetch, so
  // wait for in-flight requests (the save POST + the GET refetch) to settle.
  await page.waitForLoadState('networkidle');
}

export async function cancelEdit(page: Page) {
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
}

/** Strips unit/currency text from a displayed metric value, e.g. "25.0 %" -> 25 */
export function parseMetricNumber(text: string): number {
  return parseFloat(text.replace(/[^0-9.-]/g, ''));
}
