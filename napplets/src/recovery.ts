// SPDX-License-Identifier: MIT
import { inc } from '@napplet/sdk';
import { el, embedded, frame } from './ui';

// Chat-pilot UI: do not call guildRecovery even if a host injects it.
const app = frame('Same rock. New key.', 'Avatar recovery is not available in this release. Designated elders, signer consent, Marmot rotation and identity publication are not connected for members.');
const panel = el('section', '', 'panel'); app.append(panel);
panel.append(
  el('p', 'Guardian-approved key replacement is not offered here. Chat activity and paid ranks still grant no vote.', 'muted'),
  el('p', 'Your wallet keeps its own recovery. Bearlett restore is not connected from this guild tool.', 'muted'),
);
const memberLabel = el('label', 'Stable member ID'); const member = el('input'); member.placeholder = 'founder-dni'; member.maxLength = 128; member.disabled = true; memberLabel.append(member);
const prepare = el('button', 'Start with my current signer'); prepare.disabled = true;
const caseLabel = el('label', 'Recovery case ID'); const caseInput = el('input'); caseInput.maxLength = 128; caseInput.disabled = true; caseLabel.append(caseInput);
const load = el('button', 'Load case', 'secondary'); load.disabled = true;
panel.append(memberLabel, prepare, el('hr'), caseLabel, load);
const status = el('p', 'Avatar recovery is not available. No identity can be changed here.', 'status'); status.setAttribute('role', 'status'); app.append(status);
if (embedded) {
  try {
    const subscription = inc.on('napplet:key-recovery/open-v1', () => {
      status.textContent = 'Avatar recovery is not available. No identity can be changed here.';
    });
    window.addEventListener('pagehide', () => { subscription.close(); }, { once: true });
  } catch { /* Optional INC; mutating recovery controls stay disabled. */ }
}
