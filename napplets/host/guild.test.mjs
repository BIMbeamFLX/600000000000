// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { GuildStore } from './guild-store.mjs';
import { ExternalJournal } from './external-journal.mjs';
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
