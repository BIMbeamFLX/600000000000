// SPDX-License-Identifier: MIT
import { inc } from '@napplet/sdk';
import { previewTickets, generateLotteryPdf } from '../vendor/lnurlcash-raffle/pdf';
import { ticketCount, totalAmountSat } from '../vendor/lnurlcash-raffle/lottery';
import { parsePlan, rockPlan, PREVIEW, type PreviewPlan } from './plan';
import { el, embedded, frame, footer, number, download } from './ui';

const app = frame('Paper. Rocks. Party.', 'The ticket printer. Check the sheet before funding a raffle. Every ticket here is a non-spendable preview.');
const controls = el('section', '', 'panel print-controls'); const summary = el('p');
const pdf = el('button', 'Download preview PDF'); const importLabel = el('label', 'Load a preview plan');
const file = el('input'); file.type = 'file'; file.accept = '.json,application/json'; importLabel.append(file);
const status = el('p', '', 'status'); status.setAttribute('role', 'status');
controls.append(summary, pdf, importLabel, status); app.append(controls);
const banner = el('p', 'PREVIEW ONLY / NO REDEEMABLE NOTES', 'preview-banner'); app.append(banner);
const sheet = el('section', '', 'tickets'); sheet.setAttribute('aria-label', 'Ticket preview'); app.append(sheet);
let plan: PreviewPlan = rockPlan(); let busy = false;
function render(): void {
  summary.textContent = `${plan.config.title} · ${number(ticketCount(plan.config))} tickets · ${number(totalAmountSat(plan.config))} sat planned · ${plan.config.paper.toUpperCase()}`;
  sheet.replaceChildren();
  let index = 0;
  for (const tier of plan.config.tiers) for (let i = 0; i < tier.count; i++) {
    const ticket = el('article', '', 'ticket'); ticket.append(el('span', `№ ${String(++index).padStart(3, '0')}`, 'eyebrow'),
      el('strong', plan.config.title), el('div', '600', 'placeholder'), el('b', 'NOT A REAL TICKET'),
      el('span', plan.config.showAmount ? `${number(tier.amountSat)} sat` : 'Mystery rock'), el('small', 'Layout sample · no value'));
    sheet.append(ticket);
  }
  pdf.disabled = embedded || busy;
}
function receive(value: unknown): void {
  try { const next = parsePlan(value); plan = next; render(); status.textContent = 'Preview plan loaded. No funds moved.'; }
  catch (error) { status.textContent = `Plan rejected: ${(error as Error).message}`; }
}
file.onchange = async () => {
  const selected = file.files?.[0]; if (!selected) return;
  if (selected.size > 8192) { status.textContent = 'Plan rejected: file exceeds 8 KB.'; return; }
  try { receive(JSON.parse(await selected.text())); } catch { status.textContent = 'Plan rejected: invalid JSON.'; }
};
pdf.onclick = async () => {
  if (busy) return; busy = true; pdf.disabled = true; status.textContent = 'Preparing the preview PDF…';
  try {
    const config = plan.config;
    const bytes = await generateLotteryPdf(config, previewTickets(config), { preview: true });
    download(new Uint8Array(bytes).buffer, '600b-raffle-PREVIEW.pdf', 'application/pdf');
    status.textContent = 'Preview PDF ready. It contains no redeemable notes.';
  } catch (error) { status.textContent = `Could not export: ${(error as Error).message}`; }
  finally { busy = false; pdf.disabled = embedded; }
};
render();
if (embedded) {
  pdf.disabled = true; file.disabled = true;
  status.textContent = 'Waiting for a preview intent. Host PDF export is not connected.';
  try { const subscription = inc.on(PREVIEW, event => receive(event.payload));
    window.addEventListener('pagehide', () => subscription.close(), { once: true });
  } catch { status.textContent = 'This host does not provide preview delivery. The sample remains available.'; }
} else if (location.hash.length > 1) {
  try {
    if (location.hash.length > 25000) throw Error('Plan is too large.');
    receive(JSON.parse(decodeURIComponent(location.hash.slice(1))));
  } catch { status.textContent = 'Plan rejected: invalid preview link.'; }
  history.replaceState(null, '', location.pathname);
}
footer(app);
