// SPDX-License-Identifier: MIT
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';
import { schnorr } from '@noble/curves/secp256k1.js';

const hex = /^[a-f0-9]{64}$/;
const id = /^[a-zA-Z0-9_-]{1,128}$/;
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const requireThat = (test, reason) => { if (!test) throw Error(reason); };
const keyValid = key => {
  requireThat(typeof key === 'string' && hex.test(key), 'Invalid public key');
  schnorr.utils.lift_x(BigInt(`0x${key}`));
};

/** NIP-01 event template: sign in the host, never in a sandboxed napplet. */
export function recoveryEvent(record, purpose, pubkey, createdAt) {
  requireThat(['possession', 'approve', 'notice'].includes(purpose), 'Unknown proof purpose');
  return { kind: 1, created_at: createdAt, pubkey,
    tags: [['t', '600b-avatar-recovery-v1'], ['purpose', purpose], ['case', record.caseId]],
    content: JSON.stringify(record) };
}

/** Verify the complete event and its case/purpose binding; untrusted payloads confer no rights. */
function verify(record, purpose, event, now) {
  requireThat(event && typeof event === 'object' && !Array.isArray(event), 'Missing signed event');
  const template = recoveryEvent(record, purpose, event.pubkey, event.created_at);
  requireThat(Object.keys(event).sort().join(',') === 'content,created_at,id,kind,pubkey,sig,tags', 'Unexpected event fields');
  keyValid(event.pubkey);
  requireThat(Number.isSafeInteger(event.created_at) && event.created_at >= record.createdAt
    && event.created_at <= now + 60 && now < record.expiresAt, 'Stale or future proof');
  requireThat(event.kind === template.kind && event.content === template.content
    && JSON.stringify(event.tags) === JSON.stringify(template.tags), 'Wrong case or proof purpose');
  const digest = hash([0, event.pubkey, event.created_at, event.kind, event.tags, event.content]);
  requireThat(event.id === digest && typeof event.sig === 'string' && /^[a-f0-9]{128}$/.test(event.sig)
    && schnorr.verify(Buffer.from(event.sig, 'hex'), Buffer.from(digest, 'hex'), Buffer.from(event.pubkey, 'hex')), 'Invalid signature');
}

/** Local host library. The embedding service must authenticate reads and protect this DB. */
export class RecoveryLedger {
  #db; #now;
  constructor(path, bootstrap, now = () => Math.floor(Date.now() / 1000)) {
    this.#now = now;
    this.#db = new DatabaseSync(path);
    this.#db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS recovery_state (id INTEGER PRIMARY KEY CHECK(id=1), data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS recovery_audit (id INTEGER PRIMARY KEY, at INTEGER NOT NULL, action TEXT NOT NULL, data TEXT NOT NULL);`);
    if (!this.#db.prepare('SELECT id FROM recovery_state').get()) {
      requireThat(bootstrap, 'Explicit trusted bootstrap required');
      const { guildId, domain, guardians, members, delaySeconds, expiresSeconds, approvalPercent } = bootstrap;
      requireThat(id.test(guildId) && new URL(domain).origin === domain && domain.startsWith('https://'), 'Invalid guild domain');
      requireThat(approvalPercent === 85 && Number.isSafeInteger(delaySeconds) && delaySeconds >= 42 * 3600
        && Number.isSafeInteger(expiresSeconds) && expiresSeconds > delaySeconds && expiresSeconds <= 30 * 86400, 'Invalid recovery policy');
      requireThat(Array.isArray(guardians) && guardians.length >= 3 && guardians.length <= 600
        && new Set(guardians).size === guardians.length, 'Distinct designated guardians required');
      requireThat(Array.isArray(members) && members.length > 0, 'Verified member bootstrap required');
      const roster = {};
      const keys = new Set();
      for (const member of members) {
        requireThat(id.test(member.memberId) && !Object.hasOwn(roster, member.memberId)
          && !['__proto__', 'constructor', 'prototype'].includes(member.memberId), 'Invalid member ID');
        keyValid(member.pubkey);
        requireThat(!keys.has(member.pubkey) && member.verified === true && typeof member.claimed === 'boolean', 'Verified unique membership required');
        keys.add(member.pubkey);
        roster[member.memberId] = { pubkey: member.pubkey, version: 1, claimed: member.claimed, history: [] };
      }
      requireThat(guardians.every(memberId => typeof memberId === 'string' && Object.hasOwn(roster, memberId)), 'Guardian must be a verified member');
      const policy = { guildId, domain, approvalPercent, delaySeconds, expiresSeconds,
        guardians: guardians.map(memberId => ({ memberId, pubkey: roster[memberId].pubkey })) };
      this.#db.prepare('INSERT INTO recovery_audit(at,action,data) VALUES (?,?,?)').run(now(), 'bootstrap', JSON.stringify(policy));
      this.#db.prepare('INSERT INTO recovery_state VALUES (1,?)').run(JSON.stringify({ policy, members: roster, cases: {}, outbox: [] }));
    }
  }
  close() { this.#db.close(); }
  #load() { return JSON.parse(this.#db.prepare('SELECT data FROM recovery_state WHERE id=1').get().data); }
  #write(action, change) {
    this.#db.exec('BEGIN IMMEDIATE');
    try {
      const state = this.#load(); const result = change(state, this.#now());
      this.#db.prepare('INSERT INTO recovery_audit(at,action,data) VALUES (?,?,?)').run(this.#now(), action, JSON.stringify(result));
      this.#db.prepare('UPDATE recovery_state SET data=? WHERE id=1').run(JSON.stringify(state));
      this.#db.exec('COMMIT'); return result;
    } catch (error) { this.#db.exec('ROLLBACK'); throw error; }
  }
  /** Prepare an inert case; the host rate-limits requests. This never freezes the member. */
  prepare(memberId, newKey) {
    keyValid(newKey);
    return this.#write('prepare', (state, now) => {
      requireThat(Object.hasOwn(state.members, memberId), 'Unknown member');
      const member = state.members[memberId]; const policy = state.policy;
      requireThat(!Object.values(state.members).some(m => m.pubkey === newKey || m.history.includes(newKey)), 'Key already belongs to membership history');
      const guardians = policy.guardians.filter(g => g.memberId !== memberId);
      requireThat(guardians.length >= 3 && guardians.every(g => state.members[g.memberId].pubkey === g.pubkey), 'Guardian policy needs authorized renewal');
      const record = { version: 1, guildId: policy.guildId, domain: policy.domain, caseId: randomUUID(),
        memberId, oldKey: member.pubkey, newKey, expectedVersion: member.version,
        policyDigest: hash(policy), createdAt: now, expiresAt: now + policy.expiresSeconds };
      state.cases[record.caseId] = { record, guardians, required: Math.ceil(guardians.length * 85 / 100),
        status: 'prepared', votes: {}, possession: null, notice: null, quorumAt: null };
      return record;
    });
  }
  /** Store a signed new-key proof, guardian approval, or notification attestation exactly once. */
  submit(caseId, purpose, event) {
    return this.#write(purpose, (state, now) => {
      requireThat(Object.hasOwn(state.cases, caseId), 'Unknown case'); const c = state.cases[caseId];
      requireThat(c.status !== 'activated' && state.members[c.record.memberId].version === c.record.expectedVersion, 'Case already resolved or superseded');
      verify(c.record, purpose, event, now);
      if (purpose === 'possession') {
        requireThat(event.pubkey === c.record.newKey, 'New key possession required');
        requireThat(!c.possession, 'Proof already recorded'); c.possession = event; c.status = 'pending';
      } else {
        requireThat(c.possession, 'Prove new key first');
        const guardian = c.guardians.find(g => g.pubkey === event.pubkey);
        requireThat(guardian && state.members[guardian.memberId].pubkey === guardian.pubkey, 'Unauthorized guardian');
        if (purpose === 'approve') {
          requireThat(!Object.hasOwn(c.votes, guardian.memberId), 'Guardian already voted');
          c.votes[guardian.memberId] = event;
          if (Object.keys(c.votes).length >= c.required && c.quorumAt === null) c.quorumAt = now;
        } else {
          requireThat(purpose === 'notice' && !c.notice, 'Notice already recorded');
          c.notice = { at: now, event };
        }
      }
      return { caseId, purpose, eventId: event.id };
    });
  }
  /** Atomically change only the identity mapping; durable outbox records required follow-up work. */
  activate(caseId) {
    return this.#write('activate', (state, now) => {
      requireThat(Object.hasOwn(state.cases, caseId), 'Unknown case'); const c = state.cases[caseId];
      if (c.status === 'activated') return { caseId, status: 'activated', version: c.record.expectedVersion + 1 };
      const member = state.members[c.record.memberId];
      requireThat(now < c.record.expiresAt && member.pubkey === c.record.oldKey
        && member.version === c.record.expectedVersion, 'Expired or superseded case');
      requireThat(c.possession && c.notice && c.quorumAt !== null
        && Object.keys(c.votes).length >= c.required, 'Missing proof, notice or quorum');
      requireThat(c.guardians.every(g => state.members[g.memberId].pubkey === g.pubkey), 'Guardian policy changed');
      requireThat(now >= Math.max(c.quorumAt, c.notice.at) + state.policy.delaySeconds, 'Notification delay not elapsed');
      requireThat(!Object.values(state.members).some(m => m.pubkey === c.record.newKey || m.history.includes(c.record.newKey)), 'New key no longer available');
      member.history.push(member.pubkey); member.pubkey = c.record.newKey; member.version++;
      c.status = 'activated';
      state.outbox.push({ caseId, memberId: c.record.memberId, version: member.version,
        tasks: ['publish-current-identity', 'revoke-old-sessions', 'renew-marmot-access'], status: 'pending' });
      return { caseId, status: c.status, version: member.version };
    });
  }
  /** Return a scoped projection; enforce caller authorization in the embedding host. */
  inspect(caseId) {
    const state = this.#load(); requireThat(Object.hasOwn(state.cases, caseId), 'Unknown case'); const c = state.cases[caseId];
    return { ...c.record, status: c.status, approvals: Object.keys(c.votes).length, required: c.required,
      possession: !!c.possession, notified: !!c.notice,
      readyAt: c.quorumAt !== null && c.notice ? Math.max(c.quorumAt, c.notice.at) + state.policy.delaySeconds : null,
      followupPending: state.outbox.some(task => task.caseId === caseId && task.status === 'pending') };
  }
  /** Host authorization must compare the current identity version on every protected operation. */
  member(memberId) { const members = this.#load().members; requireThat(Object.hasOwn(members, memberId), 'Unknown member'); return members[memberId]; }
  /** Gate ordinary guild sessions until the current rotation has all external receipts. */
  sessionVersion(memberId) {
    const state = this.#load(); requireThat(Object.hasOwn(state.members, memberId), 'Unknown member');
    const member = state.members[memberId];
    const pending = state.outbox.some(job => job.status === 'pending'
      && state.cases[job.caseId].record.memberId === memberId
      && state.cases[job.caseId].record.expectedVersion + 1 === member.version);
    requireThat(!pending, 'Recovery synchronization pending');
    return member.version;
  }
  /** Authorize private case reads against current identities, never a supplied roster. */
  canRead(caseId, pubkey) {
    const state = this.#load(); requireThat(Object.hasOwn(state.cases, caseId), 'Unknown case');
    const c = state.cases[caseId];
    return pubkey === c.record.newKey || pubkey === state.members[c.record.memberId].pubkey
      || c.guardians.some(g => g.pubkey === pubkey && state.members[g.memberId].pubkey === pubkey);
  }
  outbox() { return this.#load().outbox; }
  /** Trusted worker records only externally confirmed follow-ups, never a client-supplied success. */
  confirmFollowup(caseId, task, receiptId) {
    requireThat(typeof receiptId === 'string' && receiptId.length > 0 && receiptId.length <= 256, 'Invalid follow-up receipt');
    return this.#write('followup-confirmed', state => {
      const job = state.outbox.find(item => item.caseId === caseId);
      requireThat(job && job.tasks.includes(task), 'Unknown recovery follow-up');
      job.receipts ??= {};
      job.receipts[task] ??= receiptId;
      if (job.tasks.every(item => Object.hasOwn(job.receipts, item))) job.status = 'confirmed';
      return { caseId, task, receiptId: job.receipts[task], status: job.status };
    });
  }
}
