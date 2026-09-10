// SPDX-License-Identifier: MIT
import { tool, field, button, rows } from './workspace-ui';
import { el } from './ui';
const { panel, service, status, run } = tool('Take a duty.', 'Officers can assign event organizers and treasurers. Elder and recovery rights require their separate admission policies.', 'role-manager');
const member = field(panel, 'Member ID'); const roleLabel = el('label', 'Duty'); const role = el('select');
for (const name of ['event_organizer', 'treasurer']) { const option = el('option', name); option.value = name; role.append(option); }
roleLabel.append(role); panel.append(roleLabel);
const list = el('div');
async function refresh() { rows(list, await service!.read(), (row, card) => card.append(el('h2', String(row.id)), el('p', Array.isArray(row.roles) ? row.roles.join(', ') : 'Invalid roles'))); }
for (const enabled of [true, false]) button(panel, enabled ? 'Assign duty' : 'Remove duty', !!service, () => void run(async () => {
  await service!.command({ requestId: crypto.randomUUID(), action: 'role.set', input: { memberId: member.value, role: role.value, enabled } }); await refresh();
}));
panel.append(list); if (service) void refresh().then(() => { status.textContent = 'Current duties loaded.'; }).catch(error => { status.textContent = error.message; });
