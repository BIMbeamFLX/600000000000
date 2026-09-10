// SPDX-License-Identifier: MIT
// Local integration fixture only. All keys below are disposable test keys; no relay or mint is used.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { schnorr } from '../napplets/node_modules/@noble/curves/secp256k1.js';
import { RecoveryLedger } from '../napplets/host/recovery.mjs';
import { recoveryCapability } from '../napplets/host/recovery-capability.mjs';

const bearlett = process.argv[2];
if (!bearlett) throw Error('Usage: node scripts/test-recovery-integration.mjs <built Bearlett repository>');
const secrets = Array.from({ length: 8 }, (_, i) => Buffer.from((i + 100).toString(16).padStart(64, '0'), 'hex'));
const keys = secrets.map(secret => Buffer.from(schnorr.getPublicKey(secret)).toString('hex'));
let clock = 1800000000; let signerIndex = 7;
const ledger = new RecoveryLedger(':memory:', {
  guildId: '600b', domain: 'https://600.wtf', approvalPercent: 85, delaySeconds: 42 * 3600,
  expiresSeconds: 7 * 86400, guardians: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'],
  members: keys.slice(0, 7).map((pubkey, i) => ({ memberId: `m${i}`, pubkey, verified: true, claimed: true })),
}, () => clock);
const capability = recoveryCapability(ledger, {
  getPublicKey: async () => keys[signerIndex],
  signEvent: async template => {
    const bytes = createHash('sha256').update(JSON.stringify([0, template.pubkey, template.created_at, template.kind, template.tags, template.content])).digest();
    return { ...template, id: bytes.toString('hex'), sig: Buffer.from(schnorr.sign(bytes, secrets[signerIndex])).toString('hex') };
  },
}, () => clock);
const record = await capability.prepare({ memberId: 'm0' });
await capability.attest({ caseId: record.caseId, purpose: 'possession' });
for (signerIndex = 1; signerIndex <= 6; signerIndex++) await capability.attest({ caseId: record.caseId, purpose: 'approve' });
signerIndex = 1; await capability.attest({ caseId: record.caseId, purpose: 'notice' });
signerIndex = 7; clock += 42 * 3600;

const server = spawn(process.execPath, [resolve(bearlett, 'scripts/napplet-host.mjs')], {
  cwd: resolve(bearlett), env: { ...process.env, PORT: '4191' }, stdio: 'ignore', windowsHide: true,
});
let browser;
try {
  let ready = false;
  for (let i = 0; i < 40; i++) {
    try { if ((await fetch('http://127.0.0.1:4191/wallet')).ok) { ready = true; break; } } catch { /* Wait for local fixture only. */ }
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  assert.ok(ready, 'Bearlett fixture server started');
  browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.exposeBinding('recoveryFixture', async (_source, action, payload) => {
    assert.ok(['prepare', 'read', 'attest', 'activate'].includes(action));
    return capability[action](payload);
  });
  await page.exposeBinding('walletFixture', async (_source, request) => {
    assert.deepEqual(request, { archetype: 'wallet', action: 'open', convention: 'napplet:wallet/recovery-v1',
      payload: { version: 1, guildId: '600b', memberId: 'm0', caseId: record.caseId } });
    await page.evaluate(request => window.deliverNapplet(request.convention, request.payload, 'guild-recovery'), request);
    return { ok: true, handled: true };
  });
  await page.addInitScript(() => {
    if (location.pathname !== '/guild-recovery') return;
    window.napplet = {
      guildRecovery: Object.fromEntries(['prepare', 'read', 'attest', 'activate'].map(action => [action, payload => window.recoveryFixture(action, payload)])),
      intent: {
        available: async () => ({ available: true, candidates: [{ actions: ['open'], conventions: ['napplet:wallet/recovery-v1'] }] }),
        invoke: request => window.walletFixture(request),
      },
    };
  });
  const html = await readFile(new URL('../napplets/dist/key-recovery/index.html', import.meta.url), 'utf8');
  await page.route('**/guild-recovery', route => route.fulfill({ contentType: 'text/html', body: html }));
  await page.goto('http://127.0.0.1:4191/wallet');
  const wallet = page.frameLocator('#wallet');
  await wallet.getByLabel('Wallet password', { exact: true }).fill('disposable fixture password');
  await wallet.getByLabel('Repeat password').fill('disposable fixture password');
  await wallet.getByLabel('I have saved my recovery phrase').check();
  await wallet.getByRole('button', { name: 'Create wallet' }).click();
  await wallet.getByRole('heading', { name: 'Your notes' }).waitFor();
  const before = await page.evaluate(() => JSON.stringify([...window.hostStores.wallet]));
  await page.evaluate(() => {
    const frame = document.createElement('iframe'); frame.id = 'recovery'; frame.sandbox = 'allow-scripts';
    frame.src = '/guild-recovery'; frame.style.cssText = 'width:100%;height:1100px'; document.body.prepend(frame);
  });
  const recovery = page.frameLocator('#recovery');
  await recovery.getByLabel('Recovery case ID').fill(record.caseId);
  await recovery.getByRole('button', { name: 'Load case' }).click();
  await recovery.getByRole('button', { name: 'Activate approved key' }).click();
  await recovery.getByText('Identity mapping activated.', { exact: false }).waitFor();
  assert.equal(ledger.member('m0').pubkey, keys[7]); assert.equal(ledger.member('m0').claimed, true);
  await recovery.getByRole('button', { name: 'Open separate wallet recovery' }).click();
  await wallet.getByRole('heading', { name: 'Restore your wallet separately' }).waitFor();
  await wallet.getByRole('button', { name: 'Open backup and restore' }).click();
  await wallet.getByRole('heading', { name: 'Import a napplet backup' }).waitFor();
  assert.equal(await page.evaluate(() => JSON.stringify([...window.hostStores.wallet])), before);
  assert.equal(await page.evaluate(() => window.hostCalls.filter(call => call.type === 'resource.bytes').length), 0);
  await page.locator('#recovery').evaluate(frame => { frame.style.height = '1600px'; });
  await recovery.locator('body').evaluate(() => window.scrollTo(0, 0));
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: 'docs/images/recovery-bearlett-integration.png', fullPage: true });
  console.log('PASS: real signed recovery -> SQLite activation -> recovery napplet -> Bearlett restore review; wallet unchanged.');
} finally { await browser?.close(); server.kill(); ledger.close(); }
