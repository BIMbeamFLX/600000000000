// SPDX-License-Identifier: MIT
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomUUID } from 'node:crypto';

export const requireValue = (condition, message) => { if (!condition) throw Error(message); };
export function boundedId(value) {
  requireValue(typeof value === 'string' && /^[a-zA-Z0-9_-]{1,128}$/.test(value), 'Invalid identifier');
  return value;
}
function text(value, max = 160) {
  requireValue(typeof value === 'string' && value.trim().length > 0 && value.length <= max && !/[\x00-\x1f]/.test(value), 'Invalid text');
  return value.trim();
}
const digest = value => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Durable small-guild workspace. Actor and current identity version come from the trusted host. */
export class GuildStore {
  #db; #identity;
  constructor(path, members = [], currentVersion = () => { throw Error('Identity authority missing'); }) {
    this.#identity = currentVersion; this.#db = new DatabaseSync(path);
    this.#db.exec(`PRAGMA busy_timeout=5000; PRAGMA journal_mode=WAL;
      CREATE TABLE IF NOT EXISTS guild_members(id TEXT PRIMARY KEY, roles TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS guild_items(id TEXT PRIMARY KEY, kind TEXT NOT NULL, data TEXT NOT NULL, revision INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS guild_commands(id TEXT PRIMARY KEY, digest TEXT NOT NULL, result TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS guild_audit(id INTEGER PRIMARY KEY, at INTEGER NOT NULL, actor TEXT NOT NULL, action TEXT NOT NULL, data TEXT NOT NULL);`);
    if (!this.#db.prepare('SELECT id FROM guild_members LIMIT 1').get()) {
      this.#db.exec('BEGIN IMMEDIATE');
      try {
        for (const member of members) {
          boundedId(member.id);
          requireValue(Array.isArray(member.roles) && member.roles.every(role => ['member', 'officer', 'event_organizer', 'treasurer'].includes(role)), 'Invalid bootstrap role');
          this.#db.prepare('INSERT INTO guild_members VALUES (?,?)').run(member.id, JSON.stringify(member.roles));
        }
        this.#db.prepare('INSERT INTO guild_audit(at,actor,action,data) VALUES (?,?,?,?)').run(Date.now(), 'trusted-bootstrap', 'bootstrap', JSON.stringify(members));
        this.#db.exec('COMMIT');
      } catch (error) { this.#db.exec('ROLLBACK'); throw error; }
    }
  }
  close() { this.#db.close(); }
  /** Recheck identity epoch and current duties for every request, including retries. */
  authorize(actor, roles = []) {
    requireValue(actor && Number.isSafeInteger(actor.version) && this.#identity(actor.memberId) === actor.version, 'Identity session revoked');
    const member = this.#db.prepare('SELECT * FROM guild_members WHERE id=?').get(boundedId(actor.memberId));
    requireValue(member, 'Membership required');
    const duties = JSON.parse(member.roles);
    requireValue(!roles.length || roles.some(role => duties.includes(role)), 'Duty not authorized');
    return { memberId: member.id, version: actor.version, roles: duties };
  }
  read(actor, kind) {
    this.authorize(actor);
    requireValue(['chapter', 'event', 'task', 'cosmetic'].includes(kind), 'Unknown collection');
    return this.#db.prepare('SELECT * FROM guild_items WHERE kind=? ORDER BY rowid DESC').all(kind)
      .map(row => ({ id: row.id, revision: row.revision, ...JSON.parse(row.data) }))
      .filter(row => kind !== 'cosmetic' || row.memberId === actor.memberId);
  }
  roles(actor) {
    this.authorize(actor, ['officer']);
    return this.#db.prepare('SELECT * FROM guild_members ORDER BY id').all().map(row => ({ id: row.id, roles: JSON.parse(row.roles) }));
  }
  /** Validate mutations before storing an audit decision; transactionally deduplicate each command. */
  command(actor, { requestId, action, input }) {
    boundedId(requestId);
    requireValue(input && typeof input === 'object' && !Array.isArray(input), 'Invalid command');
    const fields = {
      'chapter.create': ['title', 'location'], 'event.create': ['title', 'chapterId', 'startsAt'],
      'task.create': ['title'], 'task.complete': ['id', 'revision'],
      'role.set': ['memberId', 'role', 'enabled'], 'cosmetic.preview': ['title'],
    }[action];
    requireValue(fields && Object.keys(input).sort().join(',') === [...fields].sort().join(','), 'Unsupported command fields');
    this.authorize(actor, action === 'cosmetic.preview' ? [] : action === 'role.set' ? ['officer'] : ['officer', 'event_organizer']);
    const fingerprint = digest([actor.memberId, action, fields.map(key => input[key])]);
    this.#db.exec('BEGIN IMMEDIATE');
    try {
      const old = this.#db.prepare('SELECT * FROM guild_commands WHERE id=?').get(requestId);
      if (old) {
        requireValue(old.digest === fingerprint, 'Request ID was used for another command');
        this.#db.exec('COMMIT'); return JSON.parse(old.result);
      }
      let result;
      if (action === 'role.set') {
        requireValue(['event_organizer', 'treasurer'].includes(input.role) && typeof input.enabled === 'boolean', 'This role cannot be granted here');
        const target = this.#db.prepare('SELECT roles FROM guild_members WHERE id=?').get(boundedId(input.memberId));
        requireValue(target, 'Unknown member');
        const roles = new Set(JSON.parse(target.roles)); input.enabled ? roles.add(input.role) : roles.delete(input.role);
        result = { id: input.memberId, roles: [...roles] };
        this.#audit(actor, action, result);
        this.#db.prepare('UPDATE guild_members SET roles=? WHERE id=?').run(JSON.stringify(result.roles), result.id);
      } else if (action === 'task.complete') {
        const row = this.#db.prepare("SELECT * FROM guild_items WHERE id=? AND kind='task'").get(boundedId(input.id));
        requireValue(row && row.revision === input.revision, 'Task changed; reload before updating');
        result = { ...JSON.parse(row.data), state: 'done', id: row.id, revision: row.revision + 1 };
        this.#audit(actor, action, result);
        this.#db.prepare('UPDATE guild_items SET data=?,revision=? WHERE id=?').run(JSON.stringify(result), result.revision, row.id);
      } else {
        const kind = action.split('.')[0]; const title = text(input.title);
        result = { id: randomUUID(), title, revision: 1 };
        if (kind === 'chapter') result.location = text(input.location);
        if (kind === 'event') {
          requireValue(typeof input.chapterId === 'string', 'Invalid chapter');
          if (input.chapterId) requireValue(this.#db.prepare("SELECT id FROM guild_items WHERE id=? AND kind='chapter'").get(boundedId(input.chapterId)), 'Unknown chapter');
          requireValue(typeof input.startsAt === 'string' && /Z$/.test(input.startsAt) && Number.isFinite(Date.parse(input.startsAt)), 'UTC event time required');
          result.chapterId = input.chapterId; result.startsAt = new Date(input.startsAt).toISOString();
        }
        if (kind === 'task') result.state = 'open';
        if (kind === 'cosmetic') {
          result.memberId = actor.memberId; result.state = 'preview';
          requireValue(['Plain stone', 'Polished stone', 'Engraved stone'].includes(title), 'Unknown cosmetic preview');
        }
        this.#audit(actor, action, result);
        if (kind === 'cosmetic') this.#db.prepare("UPDATE guild_items SET kind='cosmetic-history' WHERE kind='cosmetic' AND json_extract(data,'$.memberId')=?").run(actor.memberId);
        this.#db.prepare('INSERT INTO guild_items VALUES (?,?,?,?)').run(result.id, kind, JSON.stringify(result), 1);
      }
      this.#db.prepare('INSERT INTO guild_commands VALUES (?,?,?)').run(requestId, fingerprint, JSON.stringify(result));
      this.#db.exec('COMMIT'); return result;
    } catch (error) { this.#db.exec('ROLLBACK'); throw error; }
  }
  #audit(actor, action, result) {
    this.#db.prepare('INSERT INTO guild_audit(at,actor,action,data) VALUES (?,?,?,?)').run(Date.now(), actor.memberId, action, JSON.stringify(result));
  }
}
