// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const raffle = '/napplets/dist/raffle/index.html';
const printer = '/napplets/dist/ticket-printer/index.html';

test('planner recalculates editable tiers and blocks invalid quantities', async ({ page }) => {
  await page.goto(raffle);
  await expect(page.locator('.big')).toHaveText('21');
  await expect(page.getByText('Prize pool: 2,520 sat', { exact: true })).toBeVisible();
  await page.getByLabel('Tickets 1', { exact: true }).fill('2');
  await expect(page.getByText('Prize pool: 4,620 sat', { exact: true })).toBeVisible();
  await page.getByLabel('Tickets 1', { exact: true }).fill('1.5');
  await expect(page.getByRole('button', { name: 'Open ticket printer' })).toBeDisabled();
  await expect(page.getByRole('status')).toContainText('whole numbers');
  await expect(page.getByRole('button', { name: 'Issue real tickets' })).toBeDisabled();
});

test('standalone handoff preserves the plan and exports a genuine preview PDF', async ({ page, baseURL }) => {
  const external: string[] = [];
  page.on('request', req => { if (new URL(req.url()).origin !== new URL(baseURL!).origin) external.push(req.url()); });
  await page.goto(raffle);
  await page.getByLabel('Raffle title').fill('Our rock party');
  await page.getByRole('button', { name: 'Open ticket printer' }).click();
  await expect(page).toHaveURL(new RegExp(`${printer}$`));
  await expect(page.locator('.ticket')).toHaveCount(21);
  await expect(page.locator('.print-controls')).toContainText('Our rock party');
  const downloaded = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download preview PDF' }).click();
  const file = await downloaded;
  expect(file.suggestedFilename()).toBe('600b-raffle-PREVIEW.pdf');
  const bytes = await readFile((await file.path())!);
  expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
  expect(bytes.length).toBeGreaterThan(1000);
  await expect(page.getByRole('status')).toContainText('no redeemable notes');
  expect(external).toEqual([]);
});

test('printer works alone and rejects a plan carrying bearer material', async ({ page }) => {
  await page.goto(printer);
  await expect(page.locator('.ticket')).toHaveCount(21);
  await page.getByLabel('Load a preview plan').setInputFiles({
    name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ version: 1, noteUrl: 'secret' }))
  });
  await expect(page.getByRole('status')).toContainText('Plan rejected');
  await expect(page.locator('.ticket')).toHaveCount(21);
});

for (const path of [raffle, printer]) {
  test(`mobile ${path} fits and has no asset errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('response', response => { if (response.status() >= 400) errors.push(response.url()); });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(path);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(errors).toEqual([]);
  });
}

test('embedded planner dispatches by archetype and a versioned preview convention', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).napplet = { intent: {
      available: async () => ({ available: true, candidates: [{ actions: ['open'], conventions: ['napplet:ticket-printer/preview-v1'] }] }),
      invoke: async (request: unknown) => { (window as any).receivedIntent = request; return { ok: true, handled: true }; }
    } };
  });
  await page.goto('/pebbles.html');
  await page.setContent(`<iframe sandbox="allow-scripts" src="${raffle}"></iframe>`);
  const frame = page.frameLocator('iframe');
  await frame.getByRole('button', { name: 'Open ticket printer' }).click();
  await expect(frame.getByRole('status')).toContainText('Plan sent');
  const dispatched = await frame.locator('body').evaluate(() => (window as any).receivedIntent);
  expect(dispatched.archetype).toBe('ticket-printer');
  expect(dispatched.convention).toBe('napplet:ticket-printer/preview-v1');
  expect(dispatched.handler).toBeUndefined();
  expect(dispatched.payload.version).toBe(1);
  expect(dispatched.payload.config.tiers).toHaveLength(2);
});

test('embedded printer accepts validated intent data and keeps direct export disabled', async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).napplet = { inc: { on: (topic: string, callback: unknown) => {
      (window as any).deliveryTopic = topic; (window as any).deliver = callback;
      return { close: () => {} };
    } } };
  });
  await page.goto('/pebbles.html');
  await page.setContent(`<iframe sandbox="allow-scripts" src="${printer}"></iframe>`);
  const frame = page.frameLocator('iframe');
  await expect(frame.getByRole('button', { name: 'Download preview PDF' })).toBeDisabled();
  await frame.locator('body').evaluate(() => (window as any).deliver({ payload: {
    version: 1, config: { title: 'Host party', showAmount: true, paper: 'a4', ticketPriceSat: 0,
      tiers: [{ id: 'test', count: 3, amountSat: 21, label: 'Rock' }] }
  } }));
  await expect(frame.locator('.ticket')).toHaveCount(3);
  await expect(frame.getByRole('status')).toContainText('No funds moved');
});
