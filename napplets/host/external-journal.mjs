// SPDX-License-Identifier: MIT
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { boundedId, requireValue } from './guild-store.mjs';

const OPEN = "state NOT IN ('confirmed','cancelled','rejected')";
const receipt = result => result?.confirmed === true && typeof result.receiptId === 'string'
  && result.receiptId.length > 0 && result.receiptId.length <= 256;

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])]));
  }
  return value;
}
/** Canonical digest so key insertion order cannot fork resume of the same request. */
export function canonicalDigest(request) {
  return createHash('sha256').update(JSON.stringify(sorted(request))).digest('hex');
}

/** Durable execution boundary. Unknown network outcomes are queried, never blindly repeated. */
export class ExternalJournal {
  #db;
  #inflight = new Map();
  constructor(path) {
    this.#db = new DatabaseSync(path);
    this.#db.exec(`PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS external_jobs(id TEXT PRIMARY KEY,digest TEXT NOT NULL,state TEXT NOT NULL,result TEXT,request TEXT);
      CREATE TABLE IF NOT EXISTS external_audit(id INTEGER PRIMARY KEY,at INTEGER NOT NULL,job TEXT NOT NULL,state TEXT NOT NULL);`);
  }
  close() { this.#db.close(); }
  /** Return only this authenticated actor's unresolved group commands, never recovery records. */
  pending(actor, action) {
    return this.#db.prepare(`SELECT request FROM external_jobs WHERE ${OPEN}`).all()
      .map(row => JSON.parse(row.request)).filter(request => request?.actorId === actor.memberId
        && request.identityVersion === actor.version && request.action === action)
      .map(({ requestId, groupId, memberId, role }) => ({ requestId, groupId, memberId, role }));
  }
  #load(id) { return this.#db.prepare('SELECT * FROM external_jobs WHERE id=?').get(id); }
  #record(id, state, result = null) {
    this.#db.exec('BEGIN IMMEDIATE');
    try {
      const current = this.#load(id)?.state;
      if (current === 'confirmed' || current === 'cancelled' || current === 'rejected') {
        this.#db.exec('COMMIT'); return false;
      }
      this.#db.prepare('INSERT INTO external_audit(at,job,state) VALUES (?,?,?)').run(Date.now(), id, state);
      this.#db.prepare('UPDATE external_jobs SET state=?,result=? WHERE id=?').run(state, JSON.stringify(result), id);
      this.#db.exec('COMMIT');
      return true;
    } catch (error) { this.#db.exec('ROLLBACK'); throw error; }
  }
  #rejectPrepared(id) {
    this.#db.exec('BEGIN IMMEDIATE');
    try {
      if (this.#load(id)?.state === 'prepared') {
        this.#db.prepare('INSERT INTO external_audit(at,job,state) VALUES (?,?,?)').run(Date.now(), id, 'rejected');
        this.#db.prepare("UPDATE external_jobs SET state='rejected' WHERE id=? AND state='prepared'").run(id);
      }
      this.#db.exec('COMMIT');
    } catch (error) { this.#db.exec('ROLLBACK'); throw error; }
  }
  #claimDispatch(id) {
    this.#db.exec('BEGIN IMMEDIATE');
    try {
      const job = this.#load(id);
      requireValue(job, 'Unknown request');
      if (job.state === 'prepared') {
        this.#db.prepare('INSERT INTO external_audit(at,job,state) VALUES (?,?,?)').run(Date.now(), id, 'dispatched');
        this.#db.prepare("UPDATE external_jobs SET state=?,result=? WHERE id=?").run('dispatched', JSON.stringify(null), id);
        this.#db.exec('COMMIT');
        return 'execute';
      }
      this.#db.exec('COMMIT');
      return job.state;
    } catch (error) { this.#db.exec('ROLLBACK'); throw error; }
  }
  #blocksGroup(request, otherId, other) {
    if (otherId === request.requestId) return false;
    if (other?.groupId !== request.groupId) return false;
    if (Number.isSafeInteger(other.identityVersion) && Number.isSafeInteger(request.identityVersion)
      && other.identityVersion !== request.identityVersion) return false;
    return true;
  }
  #assertGroupIdle(request, requestId) {
    if (typeof request.groupId !== 'string' || !request.groupId) return;
    for (const row of this.#db.prepare(`SELECT id,request FROM external_jobs WHERE ${OPEN}`).all()) {
      if (this.#blocksGroup(request, row.id, JSON.parse(row.request))) throw Error('Group operation already in flight');
    }
    for (const [id, other] of this.#inflight) {
      if (this.#blocksGroup(request, id, other)) throw Error('Group operation already in flight');
    }
  }
  #outcome(id, fallback) {
    const job = this.#load(id);
    if (job?.state === 'cancelled') throw Error('Request was cancelled');
    if (job?.state === 'confirmed') {
      const stored = JSON.parse(job.result);
      return { state: 'confirmed', receiptId: stored.receiptId };
    }
    return fallback;
  }
  cancel(requestId, actor, expectedAction) {
    boundedId(requestId);
    requireValue(actor && Number.isSafeInteger(actor.version), 'Identity session revoked');
    this.#db.exec('BEGIN IMMEDIATE');
    try {
      const job = this.#load(requestId);
      requireValue(job, 'Unknown request');
      requireValue(job.state !== 'confirmed', 'Confirmed jobs cannot be cancelled');
      requireValue(job.state !== 'cancelled', 'Request already cancelled');
      const request = JSON.parse(job.request);
      requireValue(request?.actorId === actor.memberId, 'Not authorized to cancel this request');
      requireValue(Number.isSafeInteger(request.identityVersion) && request.identityVersion <= actor.version, 'Not authorized to cancel this request');
      if (expectedAction) requireValue(request.action === expectedAction, 'Tool cannot cancel this request');
      this.#db.prepare('INSERT INTO external_audit(at,job,state) VALUES (?,?,?)').run(Date.now(), requestId, 'cancelled');
      this.#db.prepare("UPDATE external_jobs SET state='cancelled' WHERE id=?").run(requestId);
      this.#db.exec('COMMIT');
      return { state: 'cancelled' };
    } catch (error) { this.#db.exec('ROLLBACK'); throw error; }
  }
  async #settle(request, adapter, authorize, execute) {
    if (execute && request.groupId) this.#inflight.set(request.requestId, request);
    try {
      let result;
      try {
        result = execute ? await adapter.execute(request) : await adapter.status(request);
      } catch {
        this.#record(request.requestId, 'uncertain');
        return this.#outcome(request.requestId, { state: 'uncertain' });
      }
      try {
        await authorize();
        requireValue(receipt(result), 'External confirmation pending');
      } catch (error) {
        if (error?.message === 'External confirmation pending') {
          this.#record(request.requestId, 'uncertain');
          return this.#outcome(request.requestId, { state: 'uncertain' });
        }
        throw error;
      }
      this.#record(request.requestId, 'confirmed', { receiptId: result.receiptId });
      return this.#outcome(request.requestId, { state: 'confirmed', receiptId: result.receiptId });
    } finally {
      if (execute) this.#inflight.delete(request.requestId);
    }
  }
  async run(request, adapter, authorize) {
    boundedId(request.requestId);
    requireValue(adapter && typeof adapter.execute === 'function' && typeof adapter.status === 'function', 'Required external adapter unavailable');
    await authorize();
    const digest = canonicalDigest(request);
    this.#db.exec('BEGIN IMMEDIATE');
    let job;
    try {
      this.#assertGroupIdle(request, request.requestId);
      this.#db.prepare("INSERT OR IGNORE INTO external_jobs VALUES (?,?,'prepared',NULL,?)").run(request.requestId, digest, JSON.stringify(request));
      job = this.#load(request.requestId);
      requireValue(job.digest === digest, 'Request ID conflicts with an earlier operation');
      requireValue(job.state !== 'cancelled', 'Request was cancelled');
      requireValue(job.state !== 'rejected', 'Request was rejected');
      if (job.state === 'confirmed') {
        this.#db.exec('COMMIT');
        return { state: 'confirmed', receiptId: JSON.parse(job.result).receiptId };
      }
      this.#db.exec('COMMIT');
    } catch (error) { this.#db.exec('ROLLBACK'); throw error; }
    if (job.state === 'prepared') {
      try { await authorize(); }
      catch (error) { this.#rejectPrepared(request.requestId); throw error; }
      const next = this.#claimDispatch(request.requestId);
      if (next === 'execute') return this.#settle(request, adapter, authorize, true);
      if (next === 'confirmed') return { state: 'confirmed', receiptId: JSON.parse(this.#load(request.requestId).result).receiptId };
      requireValue(next !== 'cancelled', 'Request was cancelled');
      requireValue(next !== 'rejected', 'Request was rejected');
    }
    return this.#settle(request, adapter, authorize, false);
  }
}
