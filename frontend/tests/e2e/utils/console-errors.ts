import { Page } from '@playwright/test';

/**
 * Attaches console/page-error collection to a page. Call before navigating.
 * `ignorePatterns` lets a spec allowlist a known, pre-existing React warning
 * (e.g. Settings' checkbox controlled/uncontrolled warning) without that
 * becoming an unrelated false failure in an unrelated assertion.
 */
export function collectConsoleErrors(page: Page, ignorePatterns: RegExp[] = []) {
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const text = msg.text();
    if (ignorePatterns.some((p) => p.test(text))) return;
    errors.push(text);
  });

  page.on('pageerror', (err) => {
    errors.push(`pageerror: ${err.message}`);
  });

  return errors;
}
