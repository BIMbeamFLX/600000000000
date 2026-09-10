// SPDX-License-Identifier: MIT
import { tool, field, button } from './workspace-ui';
import { el } from './ui';
/** One mounted group action, never a shared group-admin application. */
export function groupTool(action: 'invite' | 'join' | 'remove' | 'role' | 'create', slug: string, title: string) {
  const { panel, service, status, run } = tool(title, 'The host checks group permissions and delegates to Marmot. Unknown results must be reconciled before another action.', slug);
  const name = action === 'create' ? field(panel, 'Group name') : null;
  const groupId = action === 'create' ? null : field(panel, 'Host group reference');
  const memberId = action === 'create' ? null : field(panel, action === 'join' ? 'Your member ID' : 'Member ID');
  const role = action === 'role' ? field(panel, 'Group role: member or moderator') : null;
  let pending: Record<string, unknown> | null = null;
  let inFlight: Promise<unknown> | null = null;
  const fields = () => [name, groupId, memberId, role];
  const lock = (locked: boolean) => { for (const field of fields()) if (field) field.disabled = locked; };
  const perform = async () => {
    if (!pending) {
      if (action === 'create') {
        if (!name || !name.value.trim() || name.value.length > 80) throw Error('Enter a group name.');
      } else if (![groupId!.value, memberId!.value].every(value => /^[a-zA-Z0-9_-]{1,128}$/.test(value)) || (role && !['member', 'moderator'].includes(role.value))) {
        throw Error('Enter valid host references and a supported role.');
      }
    }
    pending ??= action === 'create'
      ? { requestId: crypto.randomUUID(), groupId: '', memberId: '', role: '', name: name!.value.trim() }
      : { requestId: crypto.randomUUID(), groupId: groupId!.value, memberId: memberId!.value, role: role?.value ?? '' };
    const submitted = pending;
    lock(true); submit.disabled = true; cancelBtn.disabled = !service;
    const work = service!.group(submitted) as Promise<{ state: string }>;
    inFlight = work;
    try {
      const result = await work;
      if (pending !== submitted) return 'Pending request cancelled.';
      if (result.state === 'confirmed') {
        pending = null; lock(false); cancelBtn.disabled = true;
        await restore();
        return 'Confirmed by the Marmot client.';
      }
      cancelBtn.disabled = !service;
      return 'Outcome uncertain. Check this same request; it will not be sent again automatically.';
    } finally {
      if (inFlight === work) inFlight = null;
    }
  };
  const submit = button(panel, `Request ${action}`, false, () => void run(perform));
  button(panel, 'Check pending request', !!service, () => {
    if (!pending) { status.textContent = 'No pending request.'; return; }
    void run(perform);
  });
  const cancelBtn = button(panel, 'Cancel pending request', false, () => {
    if (!pending || !service) { status.textContent = 'No pending request.'; return; }
    const requestId = String(pending.requestId);
    const waiting = inFlight;
    cancelBtn.disabled = true; submit.disabled = true; lock(true);
    void service.cancel({ requestId }).then(async () => {
      pending = null;
      if (waiting) await waiting.then(() => undefined, () => undefined);
      lock(false);
      await restore();
      status.textContent = 'Pending request cancelled. You can start a new action.';
    }).catch((error: Error) => { status.textContent = error.message; cancelBtn.disabled = !pending || !service; });
  });
  panel.append(el('p', 'Group membership and encrypted MLS state remain in the Marmot client. No public-chat fallback.', 'muted'));
  const restore = async () => {
    const value = await service!.read() as { available?: boolean; pending?: Record<string, unknown>[] };
    submit.disabled = !value?.available;
    const saved = value.pending?.[0];
    if (saved) {
      pending = saved;
      if (groupId) groupId.value = String(saved.groupId ?? '');
      if (memberId) memberId.value = String(saved.memberId ?? '');
      if (name && saved.name) name.value = String(saved.name);
      if (role) role.value = String(saved.role ?? '');
      lock(true); submit.disabled = true; cancelBtn.disabled = false;
      status.textContent = 'Pending request restored. Check its result before starting another action.';
      return;
    }
    cancelBtn.disabled = true;
    status.textContent = submit.disabled ? 'Marmot client unavailable.' : 'Marmot host connected. Each action still needs group authorization.';
  };
  if (service) void restore().catch(error => { status.textContent = error.message; });
}
