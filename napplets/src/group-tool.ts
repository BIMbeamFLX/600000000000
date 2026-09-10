// SPDX-License-Identifier: MIT
import { tool, field, button } from './workspace-ui';
import { el } from './ui';
/** One mounted group action, never a shared group-admin application. */
export function groupTool(action: 'invite' | 'join' | 'remove' | 'role', slug: string, title: string) {
  const { panel, service, status, run } = tool(title, 'The host checks group permissions and delegates to Marmot. Unknown results must be reconciled before another action.', slug);
  const groupId = field(panel, 'Host group reference'); const memberId = field(panel, action === 'join' ? 'Your member ID' : 'Member ID');
  const role = action === 'role' ? field(panel, 'Group role: member or moderator') : null;
  let pending: Record<string, unknown> | null = null;
  const fields = () => [groupId, memberId, role];
  const lock = (locked: boolean) => { for (const field of fields()) if (field) field.disabled = locked; };
  const perform = async () => {
    if (!pending && (![groupId.value, memberId.value].every(value => /^[a-zA-Z0-9_-]{1,128}$/.test(value)) || (role && !['member', 'moderator'].includes(role.value)))) throw Error('Enter valid host references and a supported role.');
    pending ??= { requestId: crypto.randomUUID(), groupId: groupId.value, memberId: memberId.value, role: role?.value ?? '' };
    lock(true); submit.disabled = true; cancelBtn.disabled = !service;
    const result = await service!.group(pending) as { state: string };
    if (result.state === 'confirmed') {
      pending = null; lock(false); cancelBtn.disabled = true;
      await restore();
      return 'Confirmed by the Marmot client.';
    }
    return 'Outcome uncertain. Check this same request; it will not be sent again automatically.';
  };
  const submit = button(panel, `Request ${action}`, false, () => void run(perform));
  button(panel, 'Check pending request', !!service, () => {
    if (!pending) { status.textContent = 'No pending request.'; return; }
    void run(perform);
  });
  const cancelBtn = button(panel, 'Cancel pending request', false, () => void run(async () => {
    if (!pending || !service) throw Error('No pending request.');
    await service.cancel({ requestId: String(pending.requestId) });
    pending = null; lock(false); cancelBtn.disabled = true;
    await restore();
    return 'Pending request cancelled. You can start a new action.';
  }));
  panel.append(el('p', 'Group membership and encrypted MLS state remain in the Marmot client. No public-chat fallback.', 'muted'));
  const restore = async () => {
    const value = await service!.read() as { available?: boolean; pending?: Record<string, unknown>[] };
    submit.disabled = !value?.available;
    const saved = value.pending?.[0];
    if (saved) {
      pending = saved; groupId.value = String(saved.groupId); memberId.value = String(saved.memberId);
      if (role) role.value = String(saved.role);
      lock(true); submit.disabled = true; cancelBtn.disabled = false;
      status.textContent = 'Pending request restored. Check its result before starting another action.';
      return;
    }
    cancelBtn.disabled = true;
    status.textContent = submit.disabled ? 'Marmot client unavailable.' : 'Marmot host connected. Each action still needs group authorization.';
  };
  if (service) void restore().catch(error => { status.textContent = error.message; });
}
