// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { members, filterMembers, parseDirectoryContext } from './directory-model';

describe('public member directory boundary', () => {
  it('projects 30 unique founders without keys or allocations', () => {
    expect(new Set(members.map(member => member.id)).size).toBe(30);
    expect(members.every(member => Object.keys(member).sort().join(',') === 'id,missingKey,name,nip05')).toBe(true);
    expect(filterMembers('', true).map(member => member.name)).toEqual(['Gadaj']);
  });
  it('searches names and recorded addresses without modifying the snapshot', () => {
    expect(filterMembers(' DNI ', false).map(member => member.id)).toEqual(['founder-dni']);
    expect(filterMembers('m@bol.tz', false).map(member => member.id)).toEqual(['founder-michael1011']);
    expect(filterMembers('unknown', false)).toEqual([]);
    expect(members).toHaveLength(30);
  });
  it('accepts only this guild and known member IDs with no extra authority fields', () => {
    const valid = { version: 1, guildId: '600b', memberId: 'founder-dni' };
    expect(parseDirectoryContext(valid)).toEqual(valid);
    for (const invalid of [null, [], { ...valid, version: 2 }, { ...valid, guildId: 'elsewhere' },
      { ...valid, memberId: 'fake' }, { ...valid, pubkey: 'secret' }, { ...valid, role: 'elder' },
      { ...valid, memberId: 'a'.repeat(2100) }]) expect(() => parseDirectoryContext(invalid)).toThrow();
  });
});
