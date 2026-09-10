// SPDX-License-Identifier: MIT
import { boundedId, requireValue } from './guild-store.mjs';

/** One scoped capability per mounted tool; caller identity and grants are supplied by the host. */
export function guildCapability(store, journal, actor, tool, adapters = {}) {
  const reads = { chapters: 'chapter', calendar: 'event', tasks: 'task', cosmetics: 'cosmetic' };
  const commands = { chapters: ['chapter.create'], calendar: ['event.create'], tasks: ['task.create', 'task.complete'], roles: ['role.set'], cosmetics: ['cosmetic.preview'] };
  const groupActions = { 'group-invite': 'invite', 'group-join': 'join', 'group-remove': 'remove', 'group-roles': 'role', 'group-create': 'create' };
  const marmotReady = marmot => marmot?.protocol === 'marmot' && ['execute', 'status', 'authorize'].every(key => typeof marmot[key] === 'function');
  const plaintextMessage = (row, groupId) => {
    if (!row || typeof row !== 'object') return null;
    const id = typeof row.id === 'string' ? row.id : '';
    const pubkey = typeof row.pubkey === 'string' ? row.pubkey : '';
    const content = typeof row.content === 'string' ? row.content : '';
    const createdAt = Number.isFinite(row.createdAt) ? row.createdAt : Number(row.created_at);
    if (!id || !pubkey || !content || content.length > 1000 || !Number.isFinite(createdAt)) return null;
    return { id, groupId, pubkey, content, createdAt };
  };
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
      if (tool === 'group-chat') {
        const marmot = adapters.marmot;
        const available = marmotReady(marmot) && typeof marmot.listGroups === 'function';
        if (!available) return { available: false, groups: [], messages: [], pending: [] };
        if (typeof marmot.ingest === 'function') await marmot.ingest().catch(() => {});
        const source = principal();
        const listed = await marmot.listGroups();
        const current = principal();
        requireValue(current.memberId === source.memberId && current.version === source.version, 'Identity changed');
        const groups = (Array.isArray(listed) ? listed : []).slice(0, 100).flatMap(group => {
          if (!group || typeof group.groupId !== 'string' || !group.groupId) return [];
          return [{ groupId: group.groupId, name: typeof group.name === 'string' ? group.name.slice(0, 80) : '' }];
        });
        const messages = [];
        if (typeof marmot.listMessages === 'function') {
          for (const group of groups) {
            const batch = await marmot.listMessages(group.groupId);
            for (const row of Array.isArray(batch) ? batch : []) {
              const message = plaintextMessage(row, group.groupId);
              if (message) messages.push(message);
            }
          }
        }
        messages.sort((a, b) => a.createdAt - b.createdAt || a.id.localeCompare(b.id));
        return { available: true, groups, messages: messages.slice(-200), pending: journal.pending(principal(), 'chat') };
      }
      requireValue(groupActions[tool], 'Unknown tool');
      return { available: marmotReady(adapters.marmot), pending: journal.pending(principal(), groupActions[tool]) };
    },
    async command(request) {
      principal();
      requireValue(commands[tool]?.includes(request.action), 'Tool capability does not permit this command');
      return store.command(actor(), request);
    },
    async group(request) {
      principal(); requireValue(groupActions[tool], 'No group authority for this tool');
      const action = groupActions[tool];
      if (action === 'create') {
        requireValue(request && Object.keys(request).sort().join(',') === 'groupId,memberId,name,requestId,role', 'Invalid group command');
        if (request.groupId) boundedId(request.groupId);
        if (request.memberId) boundedId(request.memberId);
        boundedId(request.requestId);
        requireValue(request.role === '', 'Invalid group role');
        requireValue(typeof request.name === 'string' && request.name.trim().length > 0 && request.name.length <= 80 && !/[\x00-\x1f]/.test(request.name), 'Invalid group name');
      } else {
        requireValue(request && Object.keys(request).sort().join(',') === 'groupId,memberId,requestId,role', 'Invalid group command');
        boundedId(request.groupId); boundedId(request.memberId); boundedId(request.requestId);
        requireValue(action === 'role' ? ['member', 'moderator'].includes(request.role) : request.role === '', 'Invalid group role');
      }
      const marmot = adapters.marmot;
      requireValue(marmotReady(marmot), 'Marmot client unavailable');
      const source = principal();
      if (tool === 'group-join') requireValue(request.memberId === source.memberId, 'Join is only for the current member');
      const command = { ...request, action, actorId: source.memberId, identityVersion: source.version };
      return journal.run(command, marmot, async () => {
        const current = principal();
        requireValue(current.memberId === source.memberId && current.version === source.version, 'Identity changed');
        requireValue(await marmot.authorize(current, command), 'Marmot group action not authorized');
        const after = principal();
        requireValue(after.memberId === source.memberId && after.version === source.version, 'Identity changed');
      });
    },
    async chat(request) {
      principal(); requireValue(tool === 'group-chat', 'No chat authority for this tool');
      requireValue(request && Object.keys(request).sort().join(',') === 'content,groupId,requestId', 'Invalid chat command');
      boundedId(request.groupId); boundedId(request.requestId);
      requireValue(typeof request.content === 'string' && request.content.trim().length > 0 && request.content.length <= 1000 && !/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(request.content), 'Invalid message');
      const marmot = adapters.marmot;
      requireValue(marmotReady(marmot), 'Marmot client unavailable');
      const source = principal();
      const command = {
        requestId: request.requestId, groupId: request.groupId, memberId: source.memberId, role: '',
        content: request.content.trim(), action: 'chat', actorId: source.memberId, identityVersion: source.version,
      };
      const result = await journal.run(command, marmot, async () => {
        const current = principal();
        requireValue(current.memberId === source.memberId && current.version === source.version, 'Identity changed');
        requireValue(await marmot.authorize(current, command), 'Marmot group action not authorized');
        const after = principal();
        requireValue(after.memberId === source.memberId && after.version === source.version, 'Identity changed');
      });
      if (typeof marmot.ingest === 'function') await marmot.ingest().catch(() => {});
      return result.state === 'confirmed'
        ? { state: 'sent', receiptId: result.receiptId }
        : { state: 'uncertain' };
    },
    async cancel(request) {
      principal();
      const action = groupActions[tool] ?? (tool === 'group-chat' ? 'chat' : null);
      requireValue(action, 'No group authority for this tool');
      requireValue(request && Object.keys(request).sort().join(',') === 'requestId', 'Invalid cancel');
      boundedId(request.requestId);
      return journal.cancel(request.requestId, principal(), action);
    },
  };
}
