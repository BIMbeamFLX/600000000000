// SPDX-License-Identifier: MIT
import { inc, intent } from '@napplet/sdk';
import { el, embedded, frame } from './ui';

type View = {
  version: 1; guildId: string; memberId: string; caseId: string; oldKey: string; newKey: string;
  status: string; approvals: number; required: number; possession: boolean; notified: boolean;
  readyAt: number | null; expiresAt: number; followupPending: boolean;
};
type Service = {
  prepare(context: { memberId: string }): Promise<{ caseId: string }>;
  read(context: { caseId: string }): Promise<View>;
  attest(context: { caseId: string; purpose: 'possession' | 'approve' | 'notice' }): Promise<View>;
  activate(context: { caseId: string }): Promise<View>;
};
// Explicit host extension; not a claimed upstream SDK capability or a raw postMessage signer.
const service = embedded ? (window as unknown as { napplet?: { guildRecovery?: Service } }).napplet?.guildRecovery : undefined;
const available = !!service && ['prepare', 'read', 'attest', 'activate'].every(key => typeof service[key as keyof Service] === 'function');
const app = frame('Same rock. New key.', 'Recover access to your avatar with your designated elders. Your wallet keeps its own recovery.');
const panel = el('section', '', 'panel'); app.append(panel);
panel.append(el('p', '85% of the designated eligible guardians must approve. At least 42 hours after both quorum and notification. Chat activity and paid ranks grant no vote.', 'muted'));
const memberLabel = el('label', 'Stable member ID'); const member = el('input'); member.placeholder = 'founder-dni'; member.maxLength = 128; memberLabel.append(member);
const prepare = el('button', 'Start with my current signer'); prepare.disabled = !available;
const caseLabel = el('label', 'Recovery case ID'); const caseInput = el('input'); caseInput.maxLength = 128; caseLabel.append(caseInput);
const load = el('button', 'Load case', 'secondary'); load.disabled = !available;
panel.append(memberLabel, prepare, el('hr'), caseLabel, load);
const status = el('p', available ? 'Host connected. No case loaded.' : 'Recovery host unavailable. No identity can be changed here.', 'status'); status.setAttribute('role', 'status'); app.append(status);
const details = el('section', '', 'panel'); details.hidden = true; app.append(details);
let generation = 0; let busy = false; let current: View | null = null;
const validId = (text: string) => /^[a-zA-Z0-9_-]{1,128}$/.test(text);
function validate(value: View, expectedCase: string): View {
  if (!value || value.version !== 1 || value.guildId !== '600b' || value.caseId !== expectedCase
    || !validId(value.memberId) || !['prepared', 'pending', 'activated'].includes(value.status)
    || ![value.oldKey, value.newKey].every(key => typeof key === 'string' && /^[a-f0-9]{64}$/.test(key))
    || !Number.isSafeInteger(value.approvals) || !Number.isSafeInteger(value.required)
    || value.required < 1 || value.approvals < 0 || value.approvals > 600
    || typeof value.possession !== 'boolean' || typeof value.notified !== 'boolean'
    || typeof value.followupPending !== 'boolean' || !Number.isSafeInteger(value.expiresAt)
    || (value.readyAt !== null && !Number.isSafeInteger(value.readyAt))) throw Error('Host returned an invalid or mismatched case.');
  return value;
}
function reset(): void { generation++; current = null; details.hidden = true; }
caseInput.oninput = reset;
async function run(operation: () => Promise<View>, caseId: string): Promise<void> {
  if (busy) return;
  const active = generation; busy = true; prepare.disabled = load.disabled = true;
  try {
    const view = validate(await operation(), caseId);
    if (generation !== active) return;
    current = view; render(); status.textContent = 'Case loaded from the recovery host.';
  } catch (error) { if (generation === active) status.textContent = (error as Error).message; }
  finally { busy = false; prepare.disabled = load.disabled = !available; }
}
function render(): void {
  const view = current!; details.hidden = false; details.replaceChildren(el('h2', view.memberId),
    el('p', `${view.approvals} / ${view.required} approvals · ${view.status}`));
  for (const [name, key] of [['Previous public key', view.oldKey], ['Proposed public key', view.newKey]]) {
    const p = el('p', `${name}: ${key}`); p.style.overflowWrap = 'anywhere'; details.append(p);
  }
  details.append(el('p', `New-key proof: ${view.possession ? 'recorded' : 'missing'} · Notification attestation: ${view.notified ? 'recorded' : 'missing'}`),
    el('p', view.readyAt === null ? 'Quorum and notification are still required.' : `Earliest activation: ${new Date(view.readyAt * 1000).toISOString()}`),
    el('p', 'Approving means you independently checked the person and the exact proposed key. Notification attests that established contact paths were notified.', 'muted'));
  for (const [purpose, label] of [['possession', 'Prove my new key'], ['approve', 'Sign guardian approval'], ['notice', 'Attest completed notification']] as const) {
    const button = el('button', label, 'secondary'); button.style.margin = '0 8px 8px 0';
    button.disabled = view.status === 'activated';
    button.onclick = () => void run(() => service!.attest({ caseId: view.caseId, purpose }), view.caseId); details.append(button);
  }
  const activate = el('button', 'Activate approved key'); activate.disabled = view.status === 'activated';
  activate.onclick = () => void run(() => service!.activate({ caseId: view.caseId }), view.caseId); details.append(activate);
  if (view.followupPending) details.append(el('p', 'Identity mapping activated. Publication, old-session cleanup and Marmot group updates still need confirmation.', 'muted'));
  const wallet = el('button', 'Open separate wallet recovery', 'secondary'); wallet.disabled = view.status !== 'activated';
  wallet.onclick = async () => {
    if (busy || !current || current.caseId !== view.caseId) return;
    const active = generation;
    try {
      const found = await intent.available('wallet');
      if (active !== generation) return;
      if (!found.available || !found.candidates.some(c => c.conventions.includes('napplet:wallet/recovery-v1') && c.actions.includes('open')))
        throw Error('No compatible Bearlett wallet recovery handler installed.');
      const result = await intent.invoke({ archetype: 'wallet', action: 'open', convention: 'napplet:wallet/recovery-v1',
        payload: { version: 1, guildId: view.guildId, memberId: view.memberId, caseId: view.caseId } });
      if (active === generation) status.textContent = result.ok && result.handled ? 'Wallet request delivered. Restore remains a separate action inside Bearlett.' : 'Wallet recovery was not opened.';
    } catch (error) { if (active === generation) status.textContent = (error as Error).message; }
  };
  details.append(el('hr'), wallet);
}
load.onclick = () => {
  reset(); const caseId = caseInput.value.trim();
  if (!validId(caseId)) { status.textContent = 'Enter a valid case ID.'; return; }
  void run(() => service!.read({ caseId }), caseId);
};
prepare.onclick = async () => {
  if (busy || !validId(member.value.trim())) { status.textContent = 'Enter a stable member ID.'; return; }
  reset(); const active = generation; busy = true; prepare.disabled = load.disabled = true;
  try {
    const result = await service!.prepare({ memberId: member.value.trim() });
    if (generation !== active) return;
    if (!validId(result.caseId)) throw Error('Invalid host case ID.');
    caseInput.value = result.caseId;
    const view = validate(await service!.read({ caseId: result.caseId }), result.caseId);
    if (generation === active) { current = view; render(); status.textContent = 'Inert case created. Prove the new key to request review.'; }
  } catch (error) { if (generation === active) status.textContent = (error as Error).message; }
  finally { busy = false; prepare.disabled = load.disabled = !available; }
};
if (embedded) {
  try {
    const subscription = inc.on('napplet:key-recovery/open-v1', event => {
      const context = event.payload as Record<string, unknown>;
      if (!context || Object.keys(context).sort().join(',') !== 'caseId,guildId,version'
        || context.version !== 1 || context.guildId !== '600b' || typeof context.caseId !== 'string' || !validId(context.caseId)) {
        status.textContent = 'Recovery navigation rejected.'; return;
      }
      reset(); caseInput.value = context.caseId;
      if (available) void run(() => service!.read({ caseId: context.caseId as string }), context.caseId);
    });
    window.addEventListener('pagehide', () => { reset(); subscription.close(); }, { once: true });
  } catch { /* Optional INC navigation; direct host-backed case loading still works. */ }
}
