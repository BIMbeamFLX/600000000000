// SPDX-License-Identifier: MIT
import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: './tests', testMatch: 'guild-workspace.browser.ts', workers: 1,
  timeout: 30000, use: { baseURL: 'http://127.0.0.1:4175', trace: 'retain-on-failure' },
  webServer: process.env.GUILD_EXTERNAL_HOST ? undefined : {
    command: 'node scripts/guild-workspace.mjs', url: 'http://127.0.0.1:4175',
    env: { GUILD_DEMO_DB: ':memory:' }, reuseExistingServer: false,
  },
});
