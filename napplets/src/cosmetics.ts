// SPDX-License-Identifier: MIT
import { tool, button, rows } from './workspace-ui';
import { el } from './ui';
const { panel, service, status, run } = tool('Try a little polish.', 'Save a cosmetic preview. Purchases are not connected; a finish grants no role, time advantage or claim.', 'collectible-catalog');
const list = el('div');
async function refresh() { rows(list, await service!.read(), (row, card) => card.append(el('h2', String(row.title)), el('p', 'Preview selection · not a purchase'))); }
for (const title of ['Plain stone', 'Polished stone', 'Engraved stone']) button(panel, title, !!service, () => void run(async () => {
  await service!.command({ requestId: crypto.randomUUID(), action: 'cosmetic.preview', input: { title } }); await refresh();
}));
button(panel, 'Purchase · checkout unavailable', false, () => {});
panel.append(list); if (service) void refresh().then(() => { status.textContent = 'Your preview selection is loaded.'; }).catch(error => { status.textContent = error.message; });
