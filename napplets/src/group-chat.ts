// SPDX-License-Identifier: MIT
import { tool, field, button, rows } from './workspace-ui';
import { el } from './ui';

type ChatGroup = { groupId: string; name: string };
type ChatMessage = { id: string; groupId: string; pubkey: string; content: string; createdAt: number };
type ChatRead = { available?: boolean; groups?: ChatGroup[]; messages?: ChatMessage[]; pending?: Record<string, unknown>[] };

/** Plaintext Marmot chat. MLS material stays in the host. */
const { panel, service, status, run } = tool(
  'Talk in your group.',
  'Messages stay inside authorized Marmot groups. This is not public Nostr chat.',
  'group-chat',
);
const groupLabel = el('label', 'Authorized group');
const group = el('select');
groupLabel.append(group); panel.append(groupLabel);
const body = field(panel, 'Message');
body.maxLength = 1000;
const list = el('div');
let pending: Record<string, unknown> | null = null;
let inFlight: Promise<unknown> | null = null;
let groups: ChatGroup[] = [];

const lock = (locked: boolean) => { group.disabled = locked; body.disabled = locked; };
const selected = () => groups.find(item => item.groupId === group.value) ?? groups[0];

const render = (messages: ChatMessage[]) => {
  const groupId = selected()?.groupId;
  const visible = messages.filter(item => item.groupId === groupId).slice(-100);
  rows(list, visible, (row, card) => {
    const when = Number.isFinite(Number(row.createdAt)) ? new Date(Number(row.createdAt) * (Number(row.createdAt) > 1e12 ? 1 : 1000)).toLocaleString() : '';
    card.append(el('p', String(row.content)), el('small', `${String(row.pubkey).slice(0, 12)} · ${when}`));
  });
};

const restore = async () => {
  const value = await service!.read() as ChatRead;
  groups = Array.isArray(value.groups) ? value.groups.filter(item => item && typeof item.groupId === 'string') : [];
  group.replaceChildren();
  for (const item of groups) {
    const option = document.createElement('option');
    option.value = item.groupId;
    option.textContent = item.name ? `${item.name} (${item.groupId.slice(0, 8)})` : item.groupId.slice(0, 16);
    group.append(option);
  }
  if (pending && typeof pending.groupId === 'string') group.value = String(pending.groupId);
  else if (groups[0]) group.value = groups[0].groupId;
  render(Array.isArray(value.messages) ? value.messages : []);
  const saved = value.pending?.[0];
  if (saved) {
    pending = saved;
    if (typeof saved.content === 'string') body.value = saved.content;
    lock(true); send.disabled = true; cancelBtn.disabled = false;
    status.textContent = 'Pending send restored. Check its result before sending another message.';
    return;
  }
  cancelBtn.disabled = true;
  send.disabled = !value.available || !groups.length;
  lock(!value.available);
  status.textContent = !value.available ? 'Marmot client unavailable.' : groups.length
    ? 'Marmot host connected. Chat is plaintext in this frame only.'
    : 'No authorized groups yet. Create or join a group first.';
};

const perform = async () => {
  const target = selected();
  if (!pending && (!target || !body.value.trim() || body.value.length > 1000)) throw Error('Choose a group and enter a message.');
  pending ??= { requestId: crypto.randomUUID(), groupId: target!.groupId, content: body.value.trim() };
  const submitted = pending;
  lock(true); send.disabled = true; cancelBtn.disabled = !service;
  const work = service!.chat!(submitted) as Promise<{ state: string }>;
  inFlight = work;
  try {
    const result = await work;
    if (pending !== submitted) return 'Pending request cancelled.';
    if (result.state === 'sent') {
      pending = null; body.value = ''; lock(false); cancelBtn.disabled = true;
      await restore();
      return 'Message sent.';
    }
    if (result.state === 'failed') {
      pending = null; lock(false); cancelBtn.disabled = true;
      await restore();
      return 'Send failed.';
    }
    cancelBtn.disabled = !service;
    return 'Outcome uncertain. Check this same request; it will not be sent again automatically.';
  } finally {
    if (inFlight === work) inFlight = null;
  }
};

const send = button(panel, 'Send message', false, () => void run(perform));
button(panel, 'Refresh', !!service, () => void run(async () => { await restore(); return status.textContent || 'Refreshed.'; }));
button(panel, 'Check pending send', !!service, () => {
  if (!pending) { status.textContent = 'No pending request.'; return; }
  void run(perform);
});
const cancelBtn = button(panel, 'Cancel pending send', false, () => {
  if (!pending || !service) { status.textContent = 'No pending request.'; return; }
  const requestId = String(pending.requestId);
  const waiting = inFlight;
  cancelBtn.disabled = true; send.disabled = true; lock(true);
  void service.cancel({ requestId }).then(async () => {
    pending = null;
    if (waiting) await waiting.then(() => undefined, () => undefined);
    lock(false);
    await restore();
    status.textContent = 'Pending send cancelled. You can write a new message.';
  }).catch((error: Error) => { status.textContent = error.message; cancelBtn.disabled = !pending || !service; });
});
panel.append(el('p', 'Group membership and encrypted MLS state remain in the Marmot client.', 'muted'), list);
if (service) void restore().catch(error => { status.textContent = error.message; });
else status.textContent = 'Open in the guild workspace to use this tool.';
