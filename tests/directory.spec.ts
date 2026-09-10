// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
const directory = '/napplets/dist/member-directory/index.html';

test('directory searches public founders and distinguishes missing keys on mobile', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(directory);
  await expect(page.locator('.member-list button')).toHaveCount(30);
  await page.getByLabel('Find a member').fill('m@bol.tz');
  await page.getByRole('button', { name: 'michael1011', exact: true }).click();
  await expect(page.getByRole('complementary')).toContainText('Signature review pending');
  await page.getByLabel('Find a member').fill('');
  await page.getByLabel('Missing recorded key only').check();
  await expect(page.locator('.member-list button')).toHaveCount(1);
  await page.getByRole('button', { name: 'Gadaj', exact: true }).click();
  await expect(page.getByRole('complementary')).toContainText('Recorded key missing');
  await expect(page.getByRole('button', { name: 'Open identity review' })).toBeDisabled();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(errors).toEqual([]);
});

test('sandbox copies isolate selection and dispatch only stable identity context', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).napplet = {
      inc: { on: (_topic: string, deliver: unknown) => { (window as any).deliver = deliver; return { close() {} }; } },
      intent: {
        available: async () => ({ available: true, candidates: [{ actions: ['open'], conventions: ['napplet:identity-review/open-v1'] }] }),
        invoke: async (request: unknown) => { (window as any).received = request; return { ok: true, handled: true }; }
      }
    };
  });
  await page.goto('/pebbles.html');
  await page.setContent(`<iframe id="first" sandbox="allow-scripts" src="${directory}"></iframe><iframe id="second" sandbox="allow-scripts" src="${directory}"></iframe>`);
  const first = page.frameLocator('#first'); const second = page.frameLocator('#second');
  await first.getByRole('button', { name: 'Gadaj', exact: true }).click();
  await expect(second.getByRole('complementary').getByRole('heading')).toHaveText('dni');
  await first.getByRole('button', { name: 'Open identity review' }).click();
  expect(await first.locator('body').evaluate(() => (window as any).received)).toEqual({
    archetype: 'identity-review', action: 'open', convention: 'napplet:identity-review/open-v1',
    payload: { version: 1, guildId: '600b', memberId: 'founder-gadaj' }
  });
  await first.locator('body').evaluate(() => (window as any).deliver({ payload: { version: 1, guildId: 'wrong', memberId: 'founder-dni' } }));
  await expect(first.getByRole('complementary')).toContainText('Open request rejected');
  await expect(first.getByRole('complementary').getByRole('heading')).toHaveText('Gadaj');
  await first.locator('body').evaluate(() => (window as any).deliver({ payload: { version: 1, guildId: '600b', memberId: 'founder-flx' } }));
  await expect(first.getByRole('complementary').getByRole('heading')).toHaveText('flx');
  await page.locator('#first').evaluate(node => node.remove());
  await second.getByLabel('Find a member').fill('flx');
  await expect(second.locator('.member-list button')).toHaveCount(1);
});

test('missing review handler leaves browsing available', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).napplet = { intent: { available: async () => ({ available: false, candidates: [] }) } };
  });
  await page.goto('/pebbles.html');
  await page.setContent(`<iframe sandbox="allow-scripts" src="${directory}"></iframe>`);
  const frame = page.frameLocator('iframe');
  await frame.getByRole('button', { name: 'Open identity review' }).click();
  await expect(frame.getByRole('complementary')).toContainText('No compatible identity review installed');
  await frame.getByRole('button', { name: 'flx', exact: true }).click();
  await expect(frame.getByRole('complementary').getByRole('heading')).toHaveText('flx');
});
