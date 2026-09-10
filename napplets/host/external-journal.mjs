// SPDX-License-Identifier: MIT
import { DatabaseSync } from 'node:sqlite';
import { createHash } from 'node:crypto';
import { boundedId, requireValue } from './guild-store.mjs';

/** Durable execution boundary. Unknown network outcomes are queried, never blindly repeated. */
export class ExternalJournal {
  #db;
  constructor(path) {
    this.#db = new DatabaseSync(path);
    this.#db.exec(`PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS external_jobs(id TEXT PRIMARY KEY,digest TEXT NOT NULL,state TEXT NOT NULL,result TEXT,request TEXT);
      CREATE TABLE IF NOT EXISTS external_audit(id INTEGER PRIMARY KEY,at INTEGER NOT NULL,job TEXT NOT NULL,state TEXT NOT NULL);`);
  }
  close() { this.#db.close(); }
  /** Return only this authenticated actor's unresolved group commands, never recovery records. */
  pending(actor, action) {
    return this.#db.prepare("SELECT request FROM external_jobs WHERE state!='confirmed'").all()
      .map(row => JSON.parse(row.request)).filter(request => request?.actorId === actor.memberId
        && request.identityVersion === actor.version && request.action === action)
      .map(({ requestId, groupId, memberId, role }) => ({ requestId, groupId, memberId, role }));
  }
  #record(id, state, result = null) {
    this.#db.exec('BEGIN IMMEDIATE');
    try {
      if (this.#db.prepare('SELECT state FROM external_jobs WHERE id=?').get(id)?.state === 'confirmed') {
        this.#db.exec('COMMIT'); return;
      }
      this.#db.prepare('INSERT INTO external_audit(at,job,state) VALUES (?,?,?)').run(Date.now(), id, state);
      this.#db.prepare('UPDATE external_jobs SET state=?,result=? WHERE id=?').run(state, JSON.stringify(result), id);
      this.#db.exec('COMMIT');
    } catch (error) { this.#db.exec('ROLLBACK'); throw error; }
  }
  async run(request, adapter, authorize) {
    boundedId(request.requestId);
    requireValue(adapter && typeof adapter.execute === 'function' && typeof adapter.status === 'function', 'Required external adapter unavailable');
    await authorize();
    const digest = createHash('sha256').update(JSON.stringify(request)).digest('hex');
    const inserted = this.#db.prepare("INSERT OR IGNORE INTO external_jobs VALUES (?,?,'prepared',NULL,?)").run(request.requestId, digest, JSON.stringify(request)).changes;
    const job = this.#db.prepare('SELECT * FROM external_jobs WHERE id=?').get(request.requestId);
    requireValue(job.digest === digest, 'Request ID conflicts with an earlier operation');
    if (job.state === 'confirmed') return { state: 'confirmed', receiptId: JSON.parse(job.result).receiptId };
    let result;
    try {
      if (inserted) {
        this.#record(request.requestId, 'dispatched');
        await authorize(); result = await adapter.execute(request);
      } else result = await adapter.status(request);
      await authorize();
      requireValue(result?.confirmed === true && typeof result.receiptId === 'string' && result.receiptId.length > 0 && result.receiptId.length <= 256, 'External confirmation pending');
      this.#record(request.requestId, 'confirmed', { receiptId: result.receiptId });
      return { state: 'confirmed', receiptId: result.receiptId };
    } catch {
      // Do not overwrite a confirmation observed concurrently by another worker.
      const current = this.#db.prepare('SELECT state FROM external_jobs WHERE id=?').get(request.requestId);
      if (current.state !== 'confirmed') this.#record(request.requestId, 'uncertain');
      return { state: 'uncertain' };
    }
  }
}
