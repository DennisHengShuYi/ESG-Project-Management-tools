import { Page } from '@playwright/test';

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Events.tsx's create/edit modal uses plain sibling <label>/<input> pairs
 * with no htmlFor/id association, so getByLabel() can't find them. Same
 * pattern as EditableModule's edit fields — match by the .input-group
 * wrapper's .input-label text instead. */
export function modalField(page: Page, label: string) {
  return page
    .locator('.input-group')
    .filter({ has: page.locator('.input-label', { hasText: new RegExp(`^${escapeRegExp(label)}`) }) })
    .locator('input, select, textarea');
}
