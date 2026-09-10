// SPDX-License-Identifier: MIT
import { defineConfig } from '@playwright/test';
const port = Number(process.env.GUILD_PORT ?? 4175);
export default defineConfig({
  testDir: './tests', testMatch: 'guild-workspace.browser.ts', workers: 1,
  timeout: 60000, use: { baseURL: `http://127.0.0.1:${port}`, trace: 'retain-on-failure' },
  webServer: process.env.GUILD_EXTERNAL_HOST ? undefined : {
    command: 'node scripts/guild-workspace.mjs', url: `http://127.0.0.1:${port}`,
    env: { GUILD_DEMO_DB: ':memory:', MARMOT_RELAYS: 'off', GUILD_PORT: String(port) }, reuseExistingServer: false,
  },
});
