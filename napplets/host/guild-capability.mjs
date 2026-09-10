// SPDX-License-Identifier: MIT
import { boundedId, requireValue } from './guild-store.mjs';

/** One scoped capability per mounted tool; caller identity and grants are supplied by the host. */
export function guildCapability(store, journal, actor, tool, adapters = {}) {
  const reads = { chapters: 'chapter', calendar: 'event', tasks: 'task', cosmetics: 'cosmetic' };
  const commands = { chapters: ['chapter.create'], calendar: ['event.create'], tasks: ['task.create', 'task.complete'], roles: ['role.set'], cosmetics: ['cosmetic.preview'] };
  const groupActions = { 'group-invite': 'invite', 'group-join': 'join', 'group-remove': 'remove', 'group-roles': 'role' };
  const principal = () => store.authorize(actor());
  return {
    async read() {
      principal();
      if (reads[tool]) return store.read(actor(), reads[tool]);
      if (tool === 'roles') return store.roles(actor());
      if (tool === 'treasury' || tool === 'fips') {
        const adapter = adapters[tool]; requireValue(adapter && typeof adapter.read === 'function', `${tool} adapter unavailable`);
        const source = principal(); const result = await adapter.read(source); const current = principal();
        requireValue(current.memberId === source.memberId && current.version === source.version, 'Identity changed');
        return result;
      }
      requireValue(groupActions[tool], 'Unknown tool');
      return { available: adapters.marmot?.protocol === 'marmot' && ['execute', 'status', 'authorize'].every(key => typeof adapters.marmot[key] === 'function'), pending: journal.pending(principal(), groupActions[tool]) };
    },
    async command(request) {
      principal();
      requireValue(commands[tool]?.includes(request.action), 'Tool capability does not permit this command');
      return store.command(actor(), request);
    },
    async group(request) {
      principal(); requireValue(groupActions[tool], 'No group authority for this tool');
      requireValue(request && Object.keys(request).sort().join(',') === 'groupId,memberId,requestId,role', 'Invalid group command');
      boundedId(request.groupId); boundedId(request.memberId); boundedId(request.requestId);
      requireValue(groupActions[tool] === 'role' ? ['member', 'moderator'].includes(request.role) : request.role === '', 'Invalid group role');
      const marmot = adapters.marmot;
      requireValue(marmot?.protocol === 'marmot' && typeof marmot.authorize === 'function', 'Marmot client unavailable');
      const source = principal();
      if (tool === 'group-join') requireValue(request.memberId === source.memberId, 'Join is only for the current member');
      const command = { ...request, action: groupActions[tool], actorId: source.memberId, identityVersion: source.version };
      return journal.run(command, marmot, async () => {
        const current = principal();
        requireValue(current.memberId === source.memberId && current.version === source.version, 'Identity changed');
        requireValue(await marmot.authorize(current, command), 'Marmot group action not authorized');
        const after = principal();
        requireValue(after.memberId === source.memberId && after.version === source.version, 'Identity changed');
      });
    },
    async cancel(request) {
      principal(); requireValue(groupActions[tool], 'No group authority for this tool');
      requireValue(request && Object.keys(request).sort().join(',') === 'requestId', 'Invalid cancel');
      boundedId(request.requestId);
      return journal.cancel(request.requestId, principal());
    },
  };
}
