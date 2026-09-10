// SPDX-License-Identifier: MIT
declare const __DIRECTORY_MEMBERS__: { id: string; name: string; nip05: string; missingKey: boolean }[];
declare const __DIRECTORY_DATE__: string;

export const DIRECTORY = 'napplet:member-directory/open-v1';
export const REVIEW = 'napplet:identity-review/open-v1';
export const guildId = '600b';
// Deliberately project public display fields only; keys and allocations stay out of this tool.
export const members = __DIRECTORY_MEMBERS__;
export const snapshotDate = __DIRECTORY_DATE__;

/** Validate navigation context; a member ID never confers authority. */
export function parseDirectoryContext(value: unknown): { version: 1; guildId: string; memberId?: string } {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid directory context.');
  const data = value as Record<string, unknown>;
  if (new TextEncoder().encode(JSON.stringify(data)).length > 2048
    || Object.keys(data).some(key => !['version', 'guildId', 'memberId'].includes(key))
    || data.version !== 1 || data.guildId !== guildId
    || (data.memberId !== undefined && !members.some(member => member.id === data.memberId)))
    throw Error('Unsupported guild, member or context.');
  return { version: 1, guildId, ...(data.memberId === undefined ? {} : { memberId: data.memberId as string }) };
}

/** Filter the public snapshot without changing its source or review state. */
export function filterMembers(query: string, missingOnly: boolean) {
  const term = query.trim().toLocaleLowerCase();
  return members.filter(member => (!missingOnly || member.missingKey)
    && [member.name, member.nip05, member.id].some(text => text.toLocaleLowerCase().includes(term)));
}
