const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 375, height: 800 } });
  await page.goto('http://localhost:5183/auth', { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  await page.screenshot({ path: '_scratch_auth-375.png' });

  await page.setViewportSize({ width: 320, height: 800 });
  await page.waitForTimeout(300);
  await page.screenshot({ path: '_scratch_auth-320.png' });

  const overflow320 = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
  console.log('Auth page horizontal overflow at 320px:', overflow320);

  await browser.close();
})();
