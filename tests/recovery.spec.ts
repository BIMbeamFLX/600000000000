// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
const recovery = '/napplets/dist/key-recovery/index.html';

test('recovery fails closed without an authorized host and fits mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(recovery);
  await expect(page.getByRole('status')).toContainText('not available');
  await expect(page.getByRole('button', { name: 'Start with my current signer' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Load case' })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('injected recovery host cannot activate or hand off a wallet restore', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).called = false;
    (window as any).napplet = {
      guildRecovery: {
        prepare: async () => { (window as any).called = true; return { caseId: 'case-123' }; },
        read: async () => { (window as any).called = true; return {}; },
        attest: async () => { (window as any).called = true; return {}; },
        activate: async () => { (window as any).called = true; return {}; }
      },
      inc: { on: (_topic: string, callback: unknown) => { (window as any).deliver = callback; return { close() {} }; } },
      intent: { available: async () => ({ available: true, candidates: [] }), invoke: async () => { (window as any).called = true; } }
    };
  });
  await page.goto('/pebbles.html');
  await page.setContent(`<iframe sandbox="allow-scripts" src="${recovery}"></iframe>`);
  const frame = page.frameLocator('iframe');
  await expect(frame.getByRole('status')).toContainText('not available');
  await expect(frame.getByRole('button', { name: 'Start with my current signer' })).toBeDisabled();
  await expect(frame.getByRole('button', { name: 'Load case' })).toBeDisabled();
  await expect(frame.getByRole('button', { name: 'Activate approved key' })).toHaveCount(0);
  await expect(frame.getByRole('button', { name: 'Open separate wallet recovery' })).toHaveCount(0);
  await expect(frame.getByLabel('Stable member ID')).toBeDisabled();
  expect(await frame.locator('body').evaluate(() => (window as any).called)).toBeFalsy();
});
