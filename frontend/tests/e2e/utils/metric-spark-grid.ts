import { Page } from '@playwright/test';

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Dashboard's aggregate tabs (Green Ops / Health / Procurement / Financial)
 * render via MetricSparkGrid, not EditableModule — different CSS classes
 * (`.spark-label`/`.spark-value` vs `.metric-label`/`.metric-value`). */
export function sparkValue(page: Page, label: string) {
  return page
    .locator('.spark-card')
    .filter({ has: page.locator('.spark-label', { hasText: new RegExp(`^${escapeRegExp(label)}$`) }) })
    .locator('.spark-value');
}
