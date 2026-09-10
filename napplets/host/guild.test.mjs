// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GuildStore } from './guild-store.mjs';
import { ExternalJournal, canonicalDigest } from './external-journal.mjs';
import { guildCapability } from './guild-capability.mjs';
import { nip07RecoverySigner } from './recovery-followups.mjs';

const members = [{ id: 'officer', roles: ['member', 'officer'] }, { id: 'member', roles: ['member'] }];
const officer = { memberId: 'officer', version: 1 };
const member = { memberId: 'member', version: 1 };
const command = (requestId, action, input) => ({ requestId, action, input });
const group = { requestId: 'invitation-1', groupId: 'group-1', memberId: 'member', role: '' };
function fixture(t, adapters = {}) {
  const store = new GuildStore(':memory:', members, () => 1);
  const journal = new ExternalJournal(':memory:');
  t.after(() => { store.close(); journal.close(); });
  return { store, journal, tool: (name, actor = officer) => guildCapability(store, journal, () => actor, name, adapters) };
}

test('duties, identity epoch and per-tool grants all gate mutations and retries', async t => {
  let epoch = 1;
  const store = new GuildStore(':memory:', members, () => epoch); t.after(() => store.close());
  const c = command('create', 'task.create', { title: 'Meet up' });
  assert.throws(() => store.command(member, c), /Duty/);
  store.command(officer, c);
  epoch = 2;
  assert.throws(() => store.command(officer, c), /revoked/);
  const f = fixture(t);
  await assert.rejects(() => f.tool('calendar').command(c), /capability/);
  assert.throws(() => f.store.command(officer, command('role', 'role.set', { memberId: 'member', role: 'officer', enabled: true })), /cannot/);
  f.store.command(officer, command('grant', 'role.set', { memberId: 'member', role: 'event_organizer', enabled: true }));
  f.store.command(member, c);
  f.store.command(officer, command('revoke', 'role.set', { memberId: 'member', role: 'event_organizer', enabled: false }));
  assert.throws(() => f.store.command(member, c), /Duty/);
});

test('SQLite restart preserves exact command deduplication and optimistic task updates', t => {
  const path = join(mkdtempSync(join(tmpdir(), '600b-guild-')), 'guild.sqlite');
  let store = new GuildStore(path, members, () => 1);
  const c = command('create', 'task.create', { title: 'Chairs' });
  const item = store.command(officer, c); store.close();
  store = new GuildStore(path, [], () => 1); t.after(() => store.close());
  assert.deepEqual(store.command(officer, c), item);
  assert.equal(store.read(officer, 'task').length, 1);
  assert.throws(() => store.command(officer, command('create', 'task.create', { title: 'Other' })), /another command/);
  const done = store.command(officer, command('complete', 'task.complete', { id: item.id, revision: 1 }));
  assert.equal(done.state, 'done');
  assert.throws(() => store.command(officer, command('stale', 'task.complete', { id: item.id, revision: 1 })), /changed/);
});

test('events require known chapters and UTC dates; previews cannot create authority', t => {
  const { store } = fixture(t);
  const event = { title: 'Stammtisch', chapterId: 'missing', startsAt: '2026-09-21T18:00:00Z' };
  assert.throws(() => store.command(officer, command('event', 'event.create', event)), /chapter/);
  const chapter = store.command(officer, command('chapter', 'chapter.create', { title: 'Vienna', location: 'Vienna' }));
  event.chapterId = chapter.id;
  assert.throws(() => store.command(officer, command('bad-time', 'event.create', { ...event, startsAt: 'tomorrow' })), /UTC/);
  store.command(officer, command('event', 'event.create', event));
  assert.throws(() => store.command(member, command('extra', 'cosmetic.preview', { title: 'Plain stone', role: 'elder' })), /fields/);
  store.command(member, command('preview', 'cosmetic.preview', { title: 'Polished stone' }));
  store.command(member, command('preview-2', 'cosmetic.preview', { title: 'Engraved stone' }));
  assert.equal(store.read(member, 'cosmetic').length, 1);
  assert.equal(store.read(officer, 'cosmetic').length, 0);
  assert.deepEqual(store.authorize(member).roles, ['member']);
});

test('Marmot absence, group permission and self-join are enforced in the host', async t => {
  const f = fixture(t);
  assert.equal((await f.tool('group-invite').read()).available, false);
  await assert.rejects(() => f.tool('group-invite').group(group), /unavailable/);
  let executions = 0;
  const adapters = { marmot: { protocol: 'marmot', authorize: async () => false, execute: async () => { executions++; }, status: async () => ({}) } };
  const secured = fixture(t, adapters);
  await assert.rejects(() => secured.tool('group-invite').group(group), /not authorized/);
  await assert.rejects(() => secured.tool('group-join').group(group), /current member/);
  await assert.rejects(() => secured.tool('tasks').group(group), /No group authority/);
  assert.equal(executions, 0);
});

test('uncertain external jobs survive restart, restore only to their actor and reconcile without resend', async t => {
  const path = join(mkdtempSync(join(tmpdir(), '600b-jobs-')), 'jobs.sqlite');
  let journal = new ExternalJournal(path); let executed = 0; let queried = 0;
  const request = { ...group, action: 'invite', actorId: 'officer', identityVersion: 1 };
  const adapter = { execute: async () => { executed++; throw Error('response lost'); }, status: async () => { queried++; return { confirmed: true, receiptId: 'mls-commit-42' }; } };
  assert.deepEqual(await journal.run(request, adapter, async () => {}), { state: 'uncertain' });
  journal.close(); journal = new ExternalJournal(path); t.after(() => journal.close());
  assert.deepEqual(journal.pending(officer, 'invite'), [group]);
  assert.deepEqual(journal.pending(member, 'invite'), []);
  assert.deepEqual(journal.pending({ ...officer, version: 2 }, 'invite'), []);
  assert.equal((await journal.run(request, adapter, async () => {})).state, 'confirmed');
  assert.equal((await journal.run(request, adapter, async () => {})).state, 'confirmed');
  assert.equal(executed, 1); assert.equal(queried, 1);
  assert.deepEqual(journal.pending(officer, 'invite'), []);
  await assert.rejects(() => journal.run({ ...request, memberId: 'other' }, adapter, async () => {}), /conflicts/);
  await assert.rejects(() => journal.run(request, adapter, async () => { throw Error('revoked'); }), /revoked/);
});

test('concurrent duplicate never executes twice and late failure does not erase confirmation', async t => {
  const { journal } = fixture(t); let executeCount = 0; let release; let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const wait = new Promise(resolve => { release = resolve; });
  const adapter = { execute: async () => { executeCount++; entered(); await wait; throw Error('lost'); }, status: async () => ({ confirmed: true, receiptId: 'receipt' }) };
  const first = journal.run(group, adapter, async () => {}); await started;
  assert.equal((await journal.run(group, adapter, async () => {})).state, 'confirmed');
  release(); await first;
  assert.equal((await journal.run(group, adapter, async () => {})).state, 'confirmed');
  assert.equal(executeCount, 1);
});

test('account switches during adapter authorization or reading discard results', async t => {
  const f = fixture(t); let actor = officer; let executions = 0;
  const marmot = { protocol: 'marmot', authorize: async () => { actor = member; return true; }, execute: async () => { executions++; }, status: async () => ({}) };
  const cap = guildCapability(f.store, f.journal, () => actor, 'group-invite', { marmot });
  await assert.rejects(() => cap.group(group), /Identity changed/);
  assert.equal(executions, 0);
  actor = officer;
  const treasury = guildCapability(f.store, f.journal, () => actor, 'treasury', { treasury: { read: async () => { actor = member; return { assets: [] }; } } });
  await assert.rejects(() => treasury.read(), /Identity changed/);
});

test('shuffled request keys share a digest; retry uses status and confirms once', async t => {
  const { journal } = fixture(t); let executed = 0; let queried = 0;
  const adapter = { execute: async () => { executed++; throw Error('response lost'); }, status: async () => { queried++; return { confirmed: true, receiptId: 'mls-commit-7' }; } };
  const request = { requestId: 'invite-order', groupId: 'group-1', memberId: 'member', role: '', action: 'invite', actorId: 'officer', identityVersion: 1 };
  const shuffled = { identityVersion: 1, actorId: 'officer', action: 'invite', role: '', memberId: 'member', groupId: 'group-1', requestId: 'invite-order' };
  assert.deepEqual(await journal.run(request, adapter, async () => {}), { state: 'uncertain' });
  assert.equal((await journal.run(shuffled, adapter, async () => {})).state, 'confirmed');
  assert.equal((await journal.run({ ...shuffled, role: '' }, adapter, async () => {})).state, 'confirmed');
  assert.equal(executed, 1); assert.equal(queried, 1);
  const followup = { requestId: 'case-1-sessions', task: 'revoke-old-sessions', caseId: 'case-1', memberId: 'm0', oldKey: 'aa', newKey: 'bb', identityVersion: 2 };
  const followupShuffled = { identityVersion: 2, newKey: 'bb', oldKey: 'aa', memberId: 'm0', caseId: 'case-1', task: 'revoke-old-sessions', requestId: 'case-1-sessions' };
  executed = queried = 0;
  assert.deepEqual(await journal.run(followup, adapter, async () => {}), { state: 'uncertain' });
  assert.equal((await journal.run(followupShuffled, adapter, async () => {})).state, 'confirmed');
  assert.equal(executed, 1); assert.equal(queried, 1);
});

test('authorize failure after insert is not uncertain and a new requestId can execute', async t => {
  const { journal } = fixture(t); let calls = 0; let executions = 0; let queries = 0;
  const authorize = async () => { calls++; if (calls === 2) throw Error('Marmot group action not authorized'); };
  const adapter = { execute: async () => { executions++; return { confirmed: true, receiptId: 'ok' }; }, status: async () => { queries++; return { confirmed: true, receiptId: 'ok' }; } };
  const first = { ...group, requestId: 'invite-a', action: 'invite', actorId: 'officer', identityVersion: 1 };
  await assert.rejects(() => journal.run(first, adapter, authorize), /not authorized/);
  assert.equal(executions, 0); assert.equal(queries, 0);
  assert.deepEqual(journal.pending(officer, 'invite'), []);
  const second = { ...first, requestId: 'invite-b' };
  assert.equal((await journal.run(second, adapter, async () => {})).state, 'confirmed');
  assert.equal(executions, 1); assert.equal(queries, 0);
  await assert.rejects(() => journal.run(first, adapter, async () => {}), /rejected|authorized/);
});

test('prepared row resumes to execute exactly once', async t => {
  const path = join(mkdtempSync(join(tmpdir(), '600b-prepared-')), 'jobs.sqlite');
  const { DatabaseSync } = await import('node:sqlite');
  const schema = new ExternalJournal(path); schema.close();
  const request = { ...group, action: 'invite', actorId: 'officer', identityVersion: 1 };
  const db = new DatabaseSync(path);
  db.prepare("INSERT INTO external_jobs VALUES (?,?,'prepared',NULL,?)").run(request.requestId, canonicalDigest(request), JSON.stringify(request));
  db.close();
  const journal = new ExternalJournal(path); t.after(() => journal.close());
  let executed = 0; let queried = 0;
  const adapter = { execute: async () => { executed++; return { confirmed: true, receiptId: 'prepared-1' }; }, status: async () => { queried++; return { confirmed: true, receiptId: 'prepared-1' }; } };
  assert.equal((await journal.run(request, adapter, async () => {})).state, 'confirmed');
  assert.equal((await journal.run(request, adapter, async () => {})).state, 'confirmed');
  assert.equal(executed, 1); assert.equal(queried, 0);
});

test('two requestIds for one groupId cannot execute in parallel', async t => {
  const { journal } = fixture(t); let executeCount = 0; let release; let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const wait = new Promise(resolve => { release = resolve; });
  const adapter = {
    execute: async request => { executeCount++; entered(); await wait; return { confirmed: true, receiptId: `r-${request.requestId}` }; },
    status: async () => ({}),
  };
  const first = journal.run({ ...group, requestId: 'invite-a', action: 'invite', actorId: 'officer', identityVersion: 1 }, adapter, async () => {});
  await started;
  await assert.rejects(() => journal.run({ ...group, requestId: 'invite-b', action: 'invite', actorId: 'officer', identityVersion: 1 }, adapter, async () => {}), /in flight/);
  assert.equal(executeCount, 1);
  release();
  assert.equal((await first).state, 'confirmed');
  assert.equal((await journal.run({ ...group, requestId: 'invite-b', action: 'invite', actorId: 'officer', identityVersion: 1 }, adapter, async () => {})).state, 'confirmed');
  assert.equal(executeCount, 2);
  let recoveryRuns = 0;
  const recoveryAdapter = { execute: async () => { recoveryRuns++; return { confirmed: true, receiptId: `rec-${recoveryRuns}` }; }, status: async () => ({}) };
  const a = journal.run({ requestId: 'case-sessions', task: 'revoke-old-sessions', caseId: 'c1', memberId: 'm0', oldKey: 'aa', newKey: 'bb', identityVersion: 2 }, recoveryAdapter, async () => {});
  const b = journal.run({ requestId: 'case-marmot', task: 'renew-marmot-access', caseId: 'c1', memberId: 'm0', oldKey: 'aa', newKey: 'bb', identityVersion: 2 }, recoveryAdapter, async () => {});
  assert.deepEqual([await a, await b].map(result => result.state), ['confirmed', 'confirmed']);
  assert.equal(recoveryRuns, 2);
});

test('cancel removes pending group jobs and allows a new request', async t => {
  const { journal, tool } = fixture(t, { marmot: { protocol: 'marmot', authorize: async () => true, execute: async () => { throw Error('response lost'); }, status: async () => ({}) } });
  const request = { ...group, action: 'invite', actorId: 'officer', identityVersion: 1 };
  const adapter = { execute: async () => { throw Error('response lost'); }, status: async () => ({}) };
  assert.deepEqual(await journal.run(request, adapter, async () => {}), { state: 'uncertain' });
  assert.deepEqual(journal.pending(officer, 'invite'), [group]);
  assert.throws(() => journal.cancel(request.requestId, member), /Not authorized/);
  assert.deepEqual(journal.cancel(request.requestId, officer), { state: 'cancelled' });
  assert.deepEqual(journal.pending(officer, 'invite'), []);
  assert.throws(() => journal.cancel(request.requestId, officer), /cancelled/);
  const next = { ...request, requestId: 'invitation-2' };
  const done = { execute: async () => ({ confirmed: true, receiptId: 'after-cancel' }), status: async () => ({}) };
  assert.equal((await journal.run(next, done, async () => {})).state, 'confirmed');
  assert.throws(() => journal.cancel(next.requestId, officer), /cannot be cancelled/);
  await assert.rejects(() => tool('tasks').cancel({ requestId: next.requestId }), /No group authority/);
  const invite = tool('group-invite');
  assert.deepEqual(await invite.group({ ...group, requestId: 'invitation-3' }), { state: 'uncertain' });
  assert.deepEqual(await invite.cancel({ requestId: 'invitation-3' }), { state: 'cancelled' });
  assert.deepEqual((await invite.read()).pending, []);
  const join = tool('group-join');
  assert.deepEqual(await join.group({ requestId: 'join-1', groupId: 'group-1', memberId: 'officer', role: '' }), { state: 'uncertain' });
  await assert.rejects(() => invite.cancel({ requestId: 'join-1' }), /cannot cancel/);
  assert.deepEqual(await join.cancel({ requestId: 'join-1' }), { state: 'cancelled' });
});

test('cancel during execute does not report confirmed', async t => {
  const { journal } = fixture(t);
  let release; let entered;
  const started = new Promise(resolve => { entered = resolve; });
  const wait = new Promise(resolve => { release = resolve; });
  const request = { ...group, action: 'invite', actorId: 'officer', identityVersion: 1 };
  const adapter = {
    execute: async () => { entered(); await wait; return { confirmed: true, receiptId: 'too-late' }; },
    status: async () => ({}),
  };
  const running = journal.run(request, adapter, async () => {});
  await started;
  assert.deepEqual(await journal.run(request, adapter, async () => {}), { state: 'uncertain' });
  assert.deepEqual(journal.cancel(request.requestId, officer), { state: 'cancelled' });
  const next = { ...request, requestId: 'invite-after-cancel-race' };
  await assert.rejects(() => journal.run(next, adapter, async () => {}), /in flight/);
  release();
  await assert.rejects(() => running, /cancelled/);
  assert.deepEqual(journal.pending(officer, 'invite'), []);
  assert.equal((await journal.run(next, { execute: async () => ({ confirmed: true, receiptId: 'fresh' }), status: async () => ({}) }, async () => {})).state, 'confirmed');
});

test('stale identityVersion jobs do not deadlock a groupId queue', async t => {
  const { journal } = fixture(t);
  const v1 = { ...group, action: 'invite', actorId: 'officer', identityVersion: 1 };
  await journal.run(v1, { execute: async () => { throw Error('lost'); }, status: async () => ({}) }, async () => {});
  const v2 = { ...group, requestId: 'invite-v2', action: 'invite', actorId: 'officer', identityVersion: 2 };
  assert.equal((await journal.run(v2, { execute: async () => ({ confirmed: true, receiptId: 'epoch-2' }), status: async () => ({}) }, async () => {})).state, 'confirmed');
  assert.deepEqual(journal.cancel(v1.requestId, { memberId: 'officer', version: 2 }), { state: 'cancelled' });
});

test('adapter receipts require confirmed plus receiptId; unconfirmed results stay uncertain', async t => {
  const { journal } = fixture(t);
  const missing = { ...group, requestId: 'missing-receipt', groupId: 'group-a' };
  const falseFlag = { ...group, requestId: 'false-flag', groupId: 'group-b' };
  const queued = { ...group, requestId: 'queued', groupId: 'group-c' };
  assert.deepEqual(await journal.run(missing, { execute: async () => ({ confirmed: true }), status: async () => ({ confirmed: true }) }, async () => {}), { state: 'uncertain' });
  assert.deepEqual(await journal.run(falseFlag, { execute: async () => ({ confirmed: false, receiptId: 'nope' }), status: async () => ({ confirmed: false, receiptId: 'nope' }) }, async () => {}), { state: 'uncertain' });
  assert.deepEqual(await journal.run(queued, { execute: async () => ({ queued: true, receiptId: 'http-200' }), status: async () => ({ ok: true, receiptId: 'http-200' }) }, async () => {}), { state: 'uncertain' });
  assert.equal((await journal.run(missing, { execute: async () => ({ confirmed: true, receiptId: 'late' }), status: async () => ({ confirmed: true, receiptId: 'late' }) }, async () => {})).receiptId, 'late');
});

test('NIP-07 requires explicit consent and a stable signer before and after signing', async () => {
  let key = 'key-a'; let signed = 0;
  const extension = { getPublicKey: async () => key, signEvent: async event => { signed++; return event; } };
  const template = { pubkey: key, content: 'proof' };
  await assert.rejects(() => nip07RecoverySigner(extension, async () => false).signEvent(template), /declined/);
  await assert.rejects(() => nip07RecoverySigner(extension, async () => { key = 'key-b'; return true; }).signEvent(template), /changed/);
  assert.equal(signed, 0); key = 'key-a';
  assert.deepEqual(await nip07RecoverySigner(extension, async event => { event.content = 'mutated'; return true; }).signEvent(template), template);
  extension.signEvent = async event => { key = 'key-b'; return event; };
  await assert.rejects(() => nip07RecoverySigner(extension, async () => true).signEvent(template), /changed/);
});
