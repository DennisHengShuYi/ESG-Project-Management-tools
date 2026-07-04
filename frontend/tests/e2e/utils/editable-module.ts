import { Page, expect } from '@playwright/test';

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
  const input = editFieldInput(page, label);
  await input.fill(value);
  // Confirms the DOM (and thus React's onChange -> setDraft) actually picked
  // up the value before moving on — under load, a Save click immediately
  // after fill() can otherwise race ahead of React processing the input event.
  await expect(input).toHaveValue(value);
}

export async function startEdit(page: Page) {
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeVisible();
}

export async function saveEdit(page: Page) {
  // EditableModule's handleSave fires onSave(draft) then immediately flips
  // back to view mode — it does NOT await the parent's async save+refetch.
  // `waitForLoadState('networkidle')` alone is not reliable here: Playwright
  // only tracks requests already in flight (or a completed navigation) at
  // the moment it's called, so if there's any render/microtask gap between
  // the click and the save's fetch() actually being dispatched, networkidle
  // can resolve *before* that fetch even starts — the assertion then reads
  // the API immediately after, racing ahead of the save landing server-side.
  // Registering the response wait before the click closes that gap.
  const savePromise = page.waitForResponse(res => {
    if (res.request().method() !== 'POST') return false;
    const pathname = new URL(res.url()).pathname;
    // EventDetail's per-module routes (/api/events/:id/<module>) or
    // Dashboard's Climate Finance/HR Diversity edits (/api/governance).
    return /\/api\/events\/[^/]+\/[a-z-]+$/i.test(pathname) || pathname === '/api/governance';
  });
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await savePromise;
  // The save is followed by the module's own refetch (a GET) — wait for
  // that to settle too so a subsequent read sees fully up-to-date data.
  await page.waitForLoadState('networkidle');
}

export async function cancelEdit(page: Page) {
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
}

/** Strips unit/currency text from a displayed metric value, e.g. "25.0 %" -> 25 */
export function parseMetricNumber(text: string): number {
  return parseFloat(text.replace(/[^0-9.-]/g, ''));
}
