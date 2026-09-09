// SPDX-License-Identifier: MIT
import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('../docs/images/', import.meta.url));
await mkdir(output, { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1, reducedMotion: 'reduce' });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`);
  });
  await page.goto('http://127.0.0.1:4173/pebbles.html');
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${output}/welcome-desktop.png` });
  await page.locator('#guild').screenshot({ path: `${output}/guild-overview.png` });
  await page.setViewportSize({ width: 390, height: 1100 });
  await page.evaluate(() => scrollTo(0, 0));
  await page.screenshot({ path: `${output}/welcome-mobile.png` });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto('http://127.0.0.1:4173/elders.html');
  await page.locator('#founder-list li').first().waitFor();
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${output}/elders-desktop.png` });
  await page.goto('http://127.0.0.1:4173/docs/guild-architecture.html');
  await page.screenshot({ path: `${output}/architecture.png`, fullPage: true });
  await page.goto('http://127.0.0.1:4173/napplets/dist/raffle/index.html');
  await page.screenshot({ path: `${output}/raffle-desktop.png`, fullPage: true });
  await page.getByRole('button', { name: 'Open ticket printer' }).click();
  await page.locator('.ticket').first().waitFor();
  await page.screenshot({ path: `${output}/ticket-printer.png` });
  if (errors.length) throw new Error(errors.join('\n'));
} finally {
  await browser.close();
}
