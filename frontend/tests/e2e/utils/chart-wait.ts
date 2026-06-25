import { Page } from '@playwright/test';

/**
 * Recharts entrance animations run ~800ms by default. Asserting on chart
 * SVG content (arc paths, bar heights) immediately after a tab switch or
 * navigation catches the animation mid-sweep and looks like a rendering
 * bug (confirmed firsthand earlier in this project — see chat history).
 * Always wait this out before screenshotting or measuring chart geometry.
 */
export async function waitForChartAnimation(page: Page) {
  await page.waitForTimeout(1000);
}
