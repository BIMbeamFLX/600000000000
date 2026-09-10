// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { schnorr } from '@noble/curves/secp256k1.js';
import { RecoveryLedger, recoveryEvent } from './recovery.mjs';
import { recoveryCapability } from './recovery-capability.mjs';
import { ExternalJournal } from './external-journal.mjs';
import { synchronizeRecovery } from './recovery-followups.mjs';

const secrets = Array.from({ length: 10 }, (_, i) => Buffer.from((i + 1).toString(16).padStart(64, '0'), 'hex'));
const keys = secrets.map(secret => Buffer.from(schnorr.getPublicKey(secret)).toString('hex'));
const start = 1800000000; const delay = 42 * 3600;
function fixture(path = ':memory:') {
  let now = start;
  const ledger = new RecoveryLedger(path, { guildId: '600b', domain: 'https://600.wtf', approvalPercent: 85,
    delaySeconds: delay, expiresSeconds: 7 * 86400, guardians: ['m1', 'm2', 'm3', 'm4', 'm5', 'm6'],
    members: keys.slice(0, 7).map((pubkey, i) => ({ memberId: `m${i}`, pubkey, verified: true, claimed: i === 0 })) }, () => now);
  return { ledger, time: value => { now = value; }, sign: (record, purpose, index) => {
    const event = recoveryEvent(record, purpose, keys[index], now);
    const bytes = createHash('sha256').update(JSON.stringify([0, event.pubkey, event.created_at, event.kind, event.tags, event.content])).digest();
    return { ...event, id: bytes.toString('hex'), sig: Buffer.from(schnorr.sign(bytes, secrets[index])).toString('hex') };
  } };
}
function approve(f, record) {
  f.ledger.submit(record.caseId, 'possession', f.sign(record, 'possession', 7));
  f.ledger.submit(record.caseId, 'notice', f.sign(record, 'notice', 1));
  for (let i = 1; i <= 6; i++) f.ledger.submit(record.caseId, 'approve', f.sign(record, 'approve', i));
}

test('recovery follow-ups revoke first, reconcile partial completion and publish last', async t => {
  const f = fixture(); const journal = new ExternalJournal(':memory:');
  t.after(() => { f.ledger.close(); journal.close(); });
  const r = f.ledger.prepare('m0', keys[7]); approve(f, r);
  await assert.rejects(() => synchronizeRecovery(f.ledger, journal, r.caseId, {}), /not been activated/);
  f.time(start + delay); f.ledger.activate(r.caseId);
  assert.throws(() => f.ledger.sessionVersion('m0'), /synchronization pending/);
  assert.deepEqual(await synchronizeRecovery(f.ledger, journal, r.caseId, {}), { state: 'blocked', task: 'revoke-old-sessions' });
  const order = []; let removed = false;
  const adapter = name => ({ protocol: 'marmot', execute: async () => {
    order.push(name); if (name === 'marmot' && !removed) throw Error('lost response');
    return { confirmed: true, receiptId: name };
  }, status: async () => ({ confirmed: removed, receiptId: name }) });
  const adapters = { sessions: adapter('sessions'), marmot: adapter('marmot'), publication: adapter('publication') };
  const connected = recoveryCapability(f.ledger, { getPublicKey: async () => keys[7] }, undefined,
    caseId => synchronizeRecovery(f.ledger, journal, caseId, adapters));
  assert.equal((await connected.activate({ caseId: r.caseId })).followupPending, true);
  assert.deepEqual(order, ['sessions', 'marmot']);
  assert.equal(f.ledger.inspect(r.caseId).followupPending, true);
  removed = true;
  assert.equal((await synchronizeRecovery(f.ledger, journal, r.caseId, adapters)).state, 'confirmed');
  assert.deepEqual(order, ['sessions', 'marmot', 'publication']);
  assert.equal(f.ledger.inspect(r.caseId).followupPending, false);
  assert.equal(f.ledger.sessionVersion('m0'), 2);
  assert.equal(f.ledger.member('m0').claimed, true);
  await synchronizeRecovery(f.ledger, journal, r.caseId, adapters);
  assert.deepEqual(order, ['sessions', 'marmot', 'publication']);
});
test('real signatures plus 85% quorum and notice delay rotate identity once, preserving claims', () => {
  const f = fixture(); const record = f.ledger.prepare('m0', keys[7]); approve(f, record);
  assert.equal(f.ledger.inspect(record.caseId).required, 6);
  assert.throws(() => f.ledger.activate(record.caseId), /delay/);
  f.time(start + delay); f.ledger.activate(record.caseId); f.ledger.activate(record.caseId);
  assert.deepEqual(f.ledger.member('m0'), { pubkey: keys[7], version: 2, claimed: true, history: [keys[0]] });
  assert.equal(f.ledger.outbox().length, 1); f.ledger.close();
});
test('rejects forged signatures, different case/purpose, duplicate votes and self approval', () => {
  const f = fixture(); const r = f.ledger.prepare('m0', keys[7]);
  assert.throws(() => f.ledger.submit(r.caseId, 'possession', { ...f.sign(r, 'possession', 7), sig: '0'.repeat(128) }));
  f.ledger.submit(r.caseId, 'possession', f.sign(r, 'possession', 7));
  assert.throws(() => f.ledger.submit(r.caseId, 'approve', f.sign(r, 'approve', 0)), /Unauthorized/);
  assert.throws(() => f.ledger.submit(r.caseId, 'approve', f.sign(r, 'notice', 1)), /purpose/);
  assert.throws(() => f.ledger.submit(r.caseId, 'approve', f.sign({ ...r, newKey: keys[8] }, 'approve', 1)), /case/);
  const vote = f.sign(r, 'approve', 1); f.ledger.submit(r.caseId, 'approve', vote);
  assert.throws(() => f.ledger.submit(r.caseId, 'approve', vote), /already voted/);
  f.time(start + delay); assert.throws(() => f.ledger.activate(r.caseId), /Missing/); f.ledger.close();
});
test('competing cases and historical keys cannot recreate membership or reset claims', () => {
  const f = fixture(); const a = f.ledger.prepare('m0', keys[7]); const b = f.ledger.prepare('m0', keys[8]);
  approve(f, a); f.time(start + delay); f.ledger.activate(a.caseId);
  assert.throws(() => f.ledger.activate(b.caseId), /superseded/);
  assert.throws(() => f.ledger.prepare('m0', keys[0]), /history/); f.ledger.close();
});
test('expiry and future timestamps never satisfy a recovery', () => {
  const f = fixture(); const r = f.ledger.prepare('m0', keys[7]);
  f.time(start + 120); const future = f.sign(r, 'possession', 7); f.time(start);
  assert.throws(() => f.ledger.submit(r.caseId, 'possession', future), /future/);
  approve(f, r); f.time(r.expiresAt); assert.throws(() => f.ledger.activate(r.caseId), /Expired/); f.ledger.close();
});
test('restart retains approvals, activated identity and pending publication work', () => {
  const path = join(mkdtempSync(join(tmpdir(), '600b-recovery-')), 'state.sqlite');
  const f = fixture(path); const r = f.ledger.prepare('m0', keys[7]); approve(f, r); f.ledger.close();
  const restarted = new RecoveryLedger(path, undefined, () => start + delay);
  restarted.activate(r.caseId); assert.equal(restarted.member('m0').claimed, true);
  assert.equal(restarted.inspect(r.caseId).followupPending, true); restarted.close();
});
test('guardian key rotation blocks stale policy approvals', () => {
  const f = fixture(); const target = f.ledger.prepare('m0', keys[8]);
  const guardian = f.ledger.prepare('m1', keys[7]);
  f.ledger.submit(target.caseId, 'possession', f.sign(target, 'possession', 8));
  f.ledger.submit(guardian.caseId, 'possession', f.sign(guardian, 'possession', 7));
  f.ledger.submit(guardian.caseId, 'notice', f.sign(guardian, 'notice', 2));
  for (let i = 2; i <= 6; i++) f.ledger.submit(guardian.caseId, 'approve', f.sign(guardian, 'approve', i));
  f.time(start + delay); f.ledger.activate(guardian.caseId);
  assert.throws(() => f.ledger.submit(target.caseId, 'approve', f.sign(target, 'approve', 1)), /Unauthorized/);
  assert.throws(() => f.ledger.prepare('m0', keys[9]), /renewal/); f.ledger.close();
});
test('host capability scopes reads and rejects a signer changing accounts mid-confirmation', async () => {
  const f = fixture(); const record = f.ledger.prepare('m0', keys[7]);
  const stranger = recoveryCapability(f.ledger, { getPublicKey: async () => keys[9] });
  await assert.rejects(() => stranger.read({ caseId: record.caseId }), /Not authorized/);
  let current = keys[7];
  const capability = recoveryCapability(f.ledger, {
    getPublicKey: async () => current,
    signEvent: async () => { current = keys[8]; return f.sign(record, 'possession', 7); },
  }, () => start);
  await assert.rejects(() => capability.attest({ caseId: record.caseId, purpose: 'possession' }), /account changed/);
  assert.equal(f.ledger.inspect(record.caseId).possession, false);
  const valid = recoveryCapability(f.ledger, { getPublicKey: async () => keys[7], signEvent: async () => f.sign(record, 'possession', 7) }, () => start);
  assert.equal((await valid.attest({ caseId: record.caseId, purpose: 'possession' })).possession, true);
  f.ledger.close();
});
