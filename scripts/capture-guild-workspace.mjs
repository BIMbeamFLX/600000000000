// SPDX-License-Identifier: MIT
import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
import { chromium } from '@playwright/test';

const server = spawn(process.execPath, ['scripts/guild-workspace.mjs'], {
  windowsHide: true, stdio: 'ignore', env: { ...process.env, GUILD_PORT: '4185', GUILD_DEMO_DB: ':memory:' },
});
let browser;
try {
  let ready = false;
  for (let attempt = 0; attempt < 40; attempt++) {
    if (server.exitCode !== null) throw Error('Screenshot host failed to start');
    try { ready = (await fetch('http://127.0.0.1:4185', { signal: AbortSignal.timeout(500) })).ok; } catch {}
    if (ready) break; await setTimeout(100);
  }
  if (!ready) throw Error('Screenshot host unavailable');
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1260 } });
  await page.goto('http://127.0.0.1:4185');
  const chapter = page.frameLocator('[data-tool="chapters"]');
  await chapter.getByLabel('Title', { exact: true }).fill('Vienna stone circle');
  await chapter.getByLabel('Place or city').fill('Vienna · Austria');
  await chapter.getByRole('button', { name: 'Save', exact: true }).click();
  await chapter.getByRole('heading', { name: 'Vienna stone circle' }).waitFor();
  const calendar = page.frameLocator('[data-tool="calendar"]');
  await calendar.getByLabel('Title', { exact: true }).fill('Bring your own rock');
  await calendar.getByLabel('Starts at').fill('2026-09-21T18:00');
  await calendar.getByRole('button', { name: 'Save', exact: true }).click();
  await calendar.getByRole('heading', { name: 'Bring your own rock' }).waitFor();
  const tasks = page.frameLocator('[data-tool="tasks"]');
  await tasks.getByLabel('Title', { exact: true }).fill('Set up the meetup table');
  await tasks.getByRole('button', { name: 'Save', exact: true }).click();
  await tasks.getByRole('heading', { name: 'Set up the meetup table' }).waitFor();
  await page.screenshot({ path: 'docs/images/guild-workspace-desktop.png', fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://127.0.0.1:4185/?tools=tasks');
  await page.frameLocator('iframe').getByRole('heading', { name: 'Set up the meetup table' }).waitFor();
  await page.screenshot({ path: 'docs/images/guild-workspace-mobile.png', fullPage: true });
} finally { await browser?.close(); server.kill(); }
