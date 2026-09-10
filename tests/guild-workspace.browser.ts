// SPDX-License-Identifier: MIT
import { test, expect } from '@playwright/test';

test('chapters, events and tasks persist and work after a sibling is unmounted', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  const chapter = page.frameLocator('[data-tool="chapters"]');
  const calendar = page.frameLocator('[data-tool="calendar"]');
  const tasks = page.frameLocator('[data-tool="tasks"]');
  const suffix = Date.now().toString();
  await chapter.getByLabel('Title', { exact: true }).fill(`Vienna ${suffix}`);
  await chapter.getByLabel('Place or city').fill('Vienna');
  await chapter.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(chapter.getByRole('heading', { name: `Vienna ${suffix}`, exact: true })).toBeVisible();
  const id = (await chapter.locator('article').filter({ hasText: `Vienna ${suffix}` }).locator('small').innerText()).slice('Chapter ID: '.length);
  await calendar.getByLabel('Title', { exact: true }).fill(`Stammtisch ${suffix}`);
  await calendar.getByLabel('Chapter ID (optional)').fill(id);
  await calendar.getByLabel('Starts at').fill('2026-09-21T18:00');
  await calendar.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(calendar.getByRole('heading', { name: `Stammtisch ${suffix}` })).toBeVisible();
  await page.locator('[data-tool="chapters"]').evaluate(node => node.remove());
  await tasks.getByLabel('Title', { exact: true }).fill(`Bring chairs ${suffix}`);
  await tasks.getByRole('button', { name: 'Save', exact: true }).click();
  const card = tasks.locator('article').filter({ hasText: `Bring chairs ${suffix}` });
  await card.getByRole('button', { name: 'Mark done' }).click();
  await expect(card.getByText('done', { exact: true })).toBeVisible();
  await page.reload();
  await expect(chapter.getByRole('heading', { name: `Vienna ${suffix}`, exact: true })).toBeVisible();
  await expect(card.getByText('done', { exact: true })).toBeVisible();
  expect(errors).toEqual([]);
});

test('duties and cosmetic previews are separate, while purchases stay closed', async ({ page }) => {
  await page.goto('/?tools=roles,cosmetics');
  const duties = page.frameLocator('[data-tool="roles"]');
  await duties.getByLabel('Member ID').fill('demo-member');
  await duties.getByRole('combobox', { name: 'Duty' }).selectOption('treasurer');
  await duties.getByRole('button', { name: 'Assign duty' }).click();
  await expect(duties.locator('article').filter({ hasText: 'demo-member' })).toContainText('treasurer');
  const polish = page.frameLocator('[data-tool="cosmetics"]');
  await polish.getByRole('button', { name: 'Polished stone', exact: true }).click();
  await expect(polish.getByRole('heading', { name: 'Polished stone', exact: true })).toBeVisible();
  await expect(polish.getByRole('button', { name: /checkout unavailable/ })).toBeDisabled();
  await duties.getByRole('button', { name: 'Remove duty' }).click();
  await expect(duties.locator('article').filter({ hasText: 'demo-member' })).not.toContainText('treasurer');
});

test('all four Marmot tools and external status views fail closed without adapters', async ({ page }) => {
  await page.goto('/?tools=group-create,group-invite,group-join,group-remove,group-roles,group-chat,treasury,fips');
  for (const mode of ['group-create', 'group-invite', 'group-join', 'group-remove', 'group-roles']) {
    const frame = page.frameLocator(`[data-tool="${mode}"]`);
    await expect(frame.getByRole('status')).toHaveText('Marmot client unavailable.');
    await expect(frame.getByRole('button', { name: /^Request / })).toBeDisabled();
  }
  const chat = page.frameLocator('[data-tool="group-chat"]');
  await expect(chat.getByRole('status')).toHaveText('Marmot client unavailable.');
  await expect(chat.getByRole('button', { name: 'Send message' })).toBeDisabled();
  await expect(page.frameLocator('[data-tool="fips"]').getByRole('status')).toHaveText('fips adapter unavailable');
  await expect(page.frameLocator('[data-tool="treasury"]').getByRole('status')).toHaveText('treasury adapter unavailable');
});

test('each independent tool fits mobile and has no stand-alone capability', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const mode of ['chapters', 'calendar', 'tasks', 'roles', 'cosmetics', 'treasury', 'fips', 'group-create', 'group-invite', 'group-join', 'group-remove', 'group-roles', 'group-chat']) {
    await page.goto(`/?tools=${mode}`);
    const frame = page.frameLocator('iframe');
    await expect(frame.getByRole('heading', { level: 1 })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await frame.locator('body').evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  }
  await page.goto('/tool/tasks');
  await expect(page.getByRole('status')).toContainText('Open in the guild workspace');
  await expect(page.getByRole('button', { name: 'Save', exact: true })).toBeDisabled();
});

test('demo API rejects calls without its host token or with another origin', async ({ request }) => {
  const data = { tool: 'roles', method: 'read' };
  expect((await request.post('/api', { data })).status()).toBe(403);
  expect((await request.post('/api', { data, headers: { Origin: 'https://evil.invalid', 'X-Guild-Demo': 'fake' } })).status()).toBe(403);
  expect((await request.get('/tool/../private.sqlite')).status()).toBe(404);
});

test('Marmot UI restores an uncertain request and reconciles its original ID', async ({ page }) => {
  let pending: Record<string, unknown> | undefined; const calls: Record<string, unknown>[] = [];
  await page.exposeFunction('fixtureRead', () => ({ available: true, pending: pending ? [pending] : [] }));
  await page.exposeFunction('fixtureGroup', (request: Record<string, unknown>) => {
    calls.push(request);
    if (!pending) { pending = request; return { state: 'uncertain' }; }
    pending = undefined; return { state: 'confirmed', receiptId: 'fixture-mls-commit' };
  });
  await page.exposeFunction('fixtureCancel', () => ({ state: 'cancelled' }));
  await page.addInitScript(() => {
    const fixture = window as any;
    Object.defineProperty(window, 'napplet', { configurable: true, get: () => ({ guild: {
      read: () => fixture.fixtureRead(), group: (request: unknown) => fixture.fixtureGroup(request),
      cancel: (request: unknown) => fixture.fixtureCancel(request),
    } }), set: () => {} });
  });
  await page.goto('/?tools=group-invite');
  const frame = page.frameLocator('iframe');
  await frame.getByLabel('Host group reference').fill('group-1');
  await frame.getByLabel('Member ID').fill('demo-member');
  await frame.getByRole('button', { name: 'Request invite', exact: true }).click();
  await expect(frame.getByRole('status')).toContainText('Outcome uncertain');
  await page.reload();
  await expect(frame.getByRole('status')).toContainText('Pending request restored');
  await expect(frame.getByLabel('Host group reference')).toBeDisabled();
  await frame.getByRole('button', { name: 'Check pending request' }).click();
  await expect(frame.getByRole('status')).toHaveText('Confirmed by the Marmot client.');
  expect(calls).toHaveLength(2); expect(calls[1]).toEqual(calls[0]);
});

test('Marmot UI cancels a pending request and allows a new one', async ({ page }) => {
  let pending: Record<string, unknown> | undefined; const calls: Record<string, unknown>[] = [];
  await page.exposeFunction('fixtureRead', () => ({ available: true, pending: pending ? [pending] : [] }));
  await page.exposeFunction('fixtureGroup', (request: Record<string, unknown>) => {
    calls.push(request);
    pending = request; return { state: 'uncertain' };
  });
  await page.exposeFunction('fixtureCancel', (request: Record<string, unknown>) => {
    calls.push({ method: 'cancel', ...request });
    pending = undefined; return { state: 'cancelled' };
  });
  await page.addInitScript(() => {
    const fixture = window as any;
    Object.defineProperty(window, 'napplet', { configurable: true, get: () => ({ guild: {
      read: () => fixture.fixtureRead(), group: (request: unknown) => fixture.fixtureGroup(request),
      cancel: (request: unknown) => fixture.fixtureCancel(request),
    } }), set: () => {} });
  });
  await page.goto('/?tools=group-invite');
  const frame = page.frameLocator('iframe');
  await frame.getByLabel('Host group reference').fill('group-1');
  await frame.getByLabel('Member ID').fill('demo-member');
  await frame.getByRole('button', { name: 'Request invite', exact: true }).click();
  await expect(frame.getByRole('status')).toContainText('Outcome uncertain');
  await expect(frame.getByLabel('Host group reference')).toBeDisabled();
  await frame.getByRole('button', { name: 'Cancel pending request' }).click();
  await expect(frame.getByRole('status')).toContainText('cancelled');
  await expect(frame.getByLabel('Host group reference')).toBeEnabled();
  await frame.getByLabel('Member ID').fill('other-member');
  await frame.getByRole('button', { name: 'Request invite', exact: true }).click();
  await expect(frame.getByRole('status')).toContainText('Outcome uncertain');
  expect(calls[0]).toMatchObject({ groupId: 'group-1', memberId: 'demo-member' });
  expect(calls.at(-1)).toMatchObject({ groupId: 'group-1', memberId: 'other-member' });
});

test('group chat fails closed without adapter and shows a fixture send', async ({ page }) => {
  await page.goto('/?tools=group-chat');
  const closed = page.frameLocator('iframe');
  await expect(closed.getByRole('status')).toHaveText('Marmot client unavailable.');
  await expect(closed.getByRole('button', { name: 'Send message' })).toBeDisabled();
  const history: { id: string; groupId: string; pubkey: string; content: string; createdAt: number }[] = [];
  await page.exposeFunction('fixtureRead', () => ({
    available: true,
    groups: [{ groupId: 'group-1', name: 'clan' }],
    messages: history,
    pending: [],
  }));
  await page.exposeFunction('fixtureChat', (request: Record<string, unknown>) => {
    history.push({
      id: String(request.requestId), groupId: String(request.groupId), pubkey: 'aa'.repeat(32),
      content: String(request.content), createdAt: 1_700_000_000,
    });
    return { state: 'sent', receiptId: String(request.requestId) };
  });
  await page.exposeFunction('fixtureCancel', () => ({ state: 'cancelled' }));
  await page.addInitScript(() => {
    const fixture = window as any;
    Object.defineProperty(window, 'napplet', { configurable: true, get: () => ({ guild: {
      read: () => fixture.fixtureRead(), chat: (request: unknown) => fixture.fixtureChat(request),
      group: () => Promise.reject(Error('No group authority for this tool')),
      cancel: (request: unknown) => fixture.fixtureCancel(request),
    } }), set: () => {} });
  });
  await page.goto('/?tools=group-chat');
  const frame = page.frameLocator('iframe');
  await expect(frame.getByRole('status')).toContainText('Marmot host connected');
  await frame.getByLabel('Message').fill('hello from fixture');
  await frame.getByRole('button', { name: 'Send message' }).click();
  await expect(frame.getByRole('status')).toHaveText('Message sent.');
  await expect(frame.getByText('hello from fixture')).toBeVisible();
});
