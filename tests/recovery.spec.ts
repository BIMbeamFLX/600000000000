// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
const recovery = '/napplets/dist/key-recovery/index.html';

test('recovery fails closed without an authorized host and fits mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(recovery);
  await expect(page.getByRole('status')).toContainText('host unavailable');
  await expect(page.getByRole('button', { name: 'Start with my current signer' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Load case' })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test('host case status gates wallet handoff and passes only a reference', async ({ page }) => {
  await page.addInitScript(() => {
    const view = { version: 1, guildId: '600b', memberId: 'founder-dni', caseId: 'case-123',
      oldKey: 'a'.repeat(64), newKey: 'b'.repeat(64), status: 'pending', approvals: 5, required: 6,
      possession: true, notified: true, readyAt: 1800000000, expiresAt: 1900000000, followupPending: false };
    (window as any).napplet = {
      guildRecovery: {
        prepare: async () => ({ caseId: 'case-123' }), read: async () => view,
        attest: async () => view, activate: async () => ({ ...view, status: 'activated', approvals: 6, followupPending: true })
      },
      inc: { on: (_topic: string, callback: unknown) => { (window as any).deliver = callback; return { close() {} }; } },
      intent: {
        available: async () => ({ available: true, candidates: [{ actions: ['open'], conventions: ['napplet:wallet/recovery-v1'] }] }),
        invoke: async (request: unknown) => { (window as any).sent = request; return { ok: true, handled: true }; }
      }
    };
  });
  await page.goto('/pebbles.html');
  await page.setContent(`<iframe sandbox="allow-scripts" src="${recovery}"></iframe>`);
  const frame = page.frameLocator('iframe');
  await frame.getByLabel('Recovery case ID').fill('case-123');
  await frame.getByRole('button', { name: 'Load case' }).click();
  await expect(frame.getByRole('button', { name: 'Open separate wallet recovery' })).toBeDisabled();
  await frame.locator('body').evaluate(() => (window as any).deliver({ payload: { version: 1, guildId: 'other', caseId: 'case-123' } }));
  await expect(frame.getByRole('status')).toContainText('navigation rejected');
  await frame.getByRole('button', { name: 'Activate approved key' }).click();
  await expect(frame.getByText('Identity mapping activated.', { exact: false })).toBeVisible();
  await frame.getByRole('button', { name: 'Open separate wallet recovery' }).click();
  await expect(frame.getByRole('status')).toContainText('Restore remains a separate action');
  expect(await frame.locator('body').evaluate(() => (window as any).sent)).toEqual({
    archetype: 'wallet', action: 'open', convention: 'napplet:wallet/recovery-v1',
    payload: { version: 1, guildId: '600b', memberId: 'founder-dni', caseId: 'case-123' }
  });
});
