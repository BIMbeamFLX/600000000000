// SPDX-License-Identifier: MIT
import { tool, button, rows } from './workspace-ui';
import { el } from './ui';

type ChatGroup = { groupId: string; name: string };
type ChatRead = { available?: boolean; groups?: ChatGroup[]; npub?: string };

const DOWNLOAD = 'https://whitenoise.chat/download';

/** White Noise launcher. This frame never sends Marmot chat. */
const { panel, service, status, run } = tool(
  'Open White Noise.',
  'Chat lives in White Noise. This tool lists groups the host already knows.',
  'group-chat',
);
const list = el('div');
let groups: ChatGroup[] = [];
let npub = '';

const copyText = (label: string, value: string) => {
  if (!value) { status.textContent = `No ${label} to copy.`; return; }
  const clipboard = navigator.clipboard;
  if (!clipboard?.writeText) { status.textContent = value; return; }
  void clipboard.writeText(value).then(
    () => { status.textContent = `${label} copied.`; },
    () => { status.textContent = value; },
  );
};

const copyNpub = button(panel, 'Copy npub', false, () => copyText('npub', npub));
const download = el('a', 'Download White Noise');
download.href = DOWNLOAD;
download.target = '_blank';
download.rel = 'noopener noreferrer';

const restore = async () => {
  const value = await service!.read() as ChatRead;
  groups = Array.isArray(value.groups) ? value.groups.filter(item => item && typeof item.groupId === 'string') : [];
  npub = typeof value.npub === 'string' ? value.npub : '';
  rows(list, groups, (row, card) => {
    const groupId = String(row.groupId);
    card.append(el('p', row.name ? String(row.name) : 'Unnamed group'), el('small', groupId));
    const open = el('a', 'Open in White Noise');
    open.href = `whitenoise://chat/${groupId}`;
    const copy = el('button', 'Copy group id');
    copy.type = 'button';
    copy.onclick = () => copyText('Group id', groupId);
    card.append(open, copy);
  });
  copyNpub.disabled = !npub;
  status.textContent = !value.available
    ? 'Marmot client unavailable. Chat still opens in White Noise after you connect Alby in Hangar.'
    : groups.length
      ? 'Open a group in White Noise. This frame does not send messages.'
      : 'No authorized groups yet. Create or join a group first.';
};

button(panel, 'Refresh', !!service, () => void run(async () => { await restore(); return status.textContent || 'Refreshed.'; }));
panel.append(
  download,
  el('p', 'White Noise is the messenger. Hangar does not keep a chat box.', 'muted'),
  list,
);
if (service) void restore().catch(error => { status.textContent = error.message; });
else status.textContent = 'Open in the guild workspace to use this tool.';
