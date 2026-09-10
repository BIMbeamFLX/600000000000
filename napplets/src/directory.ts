// SPDX-License-Identifier: MIT
import { inc, intent } from '@napplet/sdk';
import { DIRECTORY, REVIEW, guildId, members, snapshotDate, filterMembers, parseDirectoryContext } from './directory-model';
import { el, embedded, frame } from './ui';
import './directory.css';

const app = frame('Meet the rocks.', 'Thirty founding members. Find a name, inspect the recorded status, and open identity review when your host supports it.');
app.append(el('p', `Public snapshot · ${snapshotDate} · Elders join in real life. This list grants no membership or claim.`, 'muted'));
const layout = el('div', '', 'layout'); app.append(layout);
const panel = el('section', '', 'panel'); layout.append(panel);
const label = el('label', 'Find a member'); const search = el('input'); search.type = 'search'; search.maxLength = 128;
label.append(search); panel.append(label);
const checkLabel = el('label', '', 'check'); const missing = el('input'); missing.type = 'checkbox';
checkLabel.append(missing, el('span', 'Missing recorded key only')); panel.append(checkLabel);
const count = el('p'); count.setAttribute('role', 'status'); panel.append(count);
const list = el('ul', '', 'member-list'); panel.append(list);
const detail = el('aside', '', 'receipt'); detail.setAttribute('aria-label', 'Member details'); layout.append(detail);
const status = el('p', '', 'status'); status.setAttribute('role', 'status');
let selected = members[0];
let generation = 0;

/** Display recorded evidence, never a live verification or authorization result. */
function renderDetail(): void {
  generation++;
  detail.replaceChildren(el('p', 'FOUNDING MEMBER', 'eyebrow'), el('h2', selected.name),
    el('p', selected.nip05, 'member-address'),
    el('p', selected.missingKey ? 'Recorded key missing · review needed' : 'Signature review pending'),
    el('p', 'NIP-05 is a recorded address, not a live check. No identity has been verified by opening this directory.', 'muted'));
  const review = el('button', 'Open identity review'); review.disabled = !embedded;
  status.textContent = embedded ? 'Review availability is checked when you open it.' : 'Open in a compatible host to use identity review.';
  detail.append(review, status);
  review.onclick = async () => {
    const currentGeneration = generation;
    const memberId = selected.id;
    review.disabled = true;
    try {
      const available = await intent.available('identity-review');
      if (currentGeneration !== generation) return;
      if (!available.available || !available.candidates.some(candidate => candidate.actions.includes('open') && candidate.conventions.includes(REVIEW)))
        throw Error('No compatible identity review installed. The directory remains available.');
      const result = await intent.invoke({ archetype: 'identity-review', action: 'open', convention: REVIEW,
        payload: { version: 1, guildId, memberId } });
      if (currentGeneration === generation) status.textContent = result.ok && result.handled
        ? 'Review opened. The recorded status stays unchanged until an authorized review.' : 'Review was not opened.';
    } catch (error) { if (currentGeneration === generation) status.textContent = (error as Error).message; }
    finally { review.disabled = false; }
  };
}
/** Render a searchable, keyboard-accessible snapshot list. */
function renderList(): void {
  const visible = filterMembers(search.value, missing.checked);
  count.textContent = `${visible.length} of ${members.length} founders`;
  list.replaceChildren();
  for (const member of visible) {
    const item = el('li'); const button = el('button', member.name, 'secondary');
    button.setAttribute('aria-pressed', String(member.id === selected.id));
    button.onclick = () => { selected = member; renderList(); renderDetail(); };
    item.append(button); list.append(item);
  }
  if (!visible.length) list.append(el('li', 'No matching rocks. Try another name.'));
}
search.oninput = renderList; missing.onchange = renderList;
renderList(); renderDetail();
const foot = el('footer', 'Public roster. Still not a cult.');
if (!embedded) { const back = el('a', 'Back to the guild'); back.href = '../../../pebbles.html#guild'; foot.append(back); }
app.append(foot);
if (embedded) {
  try {
    const subscription = inc.on(DIRECTORY, event => {
      try {
        const context = parseDirectoryContext(event.payload);
        search.value = ''; missing.checked = false;
        if (context.memberId) selected = members.find(member => member.id === context.memberId)!;
        renderList(); renderDetail();
      } catch { status.textContent = 'Open request rejected. The current selection is unchanged.'; }
    });
    window.addEventListener('pagehide', () => subscription.close(), { once: true });
  } catch { status.textContent = 'Host navigation unavailable. Browse the public snapshot here.'; }
}
