// SPDX-License-Identifier: MIT
import { intent, inc } from '@napplet/sdk';
import { TIER_PRESETS, ticketCount, totalAmountSat, grossRevenueSat, haircutSat } from '../vendor/lnurlcash-raffle/lottery';
import { parsePlan, rockPlan, PREVIEW } from './plan';
import { el, embedded, frame, footer, number, download } from './ui';

const app = frame('Plan the party.', 'One big rock. Twenty little surprises. Build a prize table, then send it to the ticket printer.');
const layout = el('div', '', 'layout'); app.append(layout);
const form = el('form', '', 'panel'); form.addEventListener('submit', event => event.preventDefault());
layout.append(form);
const titleLabel = el('label', 'Raffle title'); const title = el('input'); title.maxLength = 80;
title.value = rockPlan().config.title; titleLabel.append(title); form.append(titleLabel);
const presetLabel = el('label', 'Start with a preset'); const preset = el('select');
for (const p of [{ id: '600b', name: '21 rocks / 600B special' }, ...TIER_PRESETS]) {
  const option = el('option', p.name); option.value = p.id; preset.append(option);
}
presetLabel.append(preset); form.append(presetLabel);
form.append(el('h2', 'The prize table'), el('p', 'Tickets × sats per ticket. Up to 8 tiers and 300 tickets.', 'muted'));
const rows = el('div', '', 'tiers'); form.append(rows);
let tiers = rockPlan().config.tiers;
const add = el('button', '+ Add prize tier', 'secondary'); add.type = 'button'; form.append(add);
const options = el('div', '', 'options'); form.append(options);
const priceLabel = el('label', 'Planning price per ticket (sat)'); const price = el('input');
price.type = 'number'; price.min = '0'; price.step = '1'; price.value = '0'; priceLabel.append(price);
const paperLabel = el('label', 'Paper size'); const paper = el('select');
for (const name of ['a4', 'letter']) { const option = el('option', name.toUpperCase()); option.value = name; paper.append(option); }
paperLabel.append(paper); options.append(priceLabel, paperLabel);
const showLabel = el('label', '', 'check'); const show = el('input'); show.type = 'checkbox'; show.checked = true;
showLabel.append(show, el('span', 'Show prize amounts on the tickets')); form.append(showLabel);
const aside = el('aside', '', 'receipt'); layout.append(aside);
aside.append(el('p', 'THE PARTY BUDGET', 'eyebrow'));
const count = el('strong', '', 'big'); const pool = el('p'); const revenue = el('p'); const balance = el('p');
const status = el('p', '', 'status'); status.setAttribute('role', 'status');
const print = el('button', 'Open ticket printer ↗'); const save = el('button', 'Save preview plan', 'secondary');
aside.append(count, el('p', 'tickets in the plan'), el('hr'), pool, revenue, balance, el('hr'), print, save, status,
  el('p', 'Preview only. No note is loaded, split or spent. Ticket price is a calculation, not a checkout.', 'muted'));
const mint = el('button', 'Issue real tickets · host wallet needed', 'secondary'); mint.disabled = true; aside.append(mint);

function current() {
  return parsePlan({ version: 1, config: { title: title.value, tiers, showAmount: show.checked,
    paper: paper.value, ticketPriceSat: Number(price.value) } });
}
function update(): void {
  try {
    const { config } = current(); count.textContent = number(ticketCount(config));
    pool.textContent = `Prize pool: ${number(totalAmountSat(config))} sat`;
    revenue.textContent = `If every ticket sells: ${number(grossRevenueSat(config))} sat`;
    balance.textContent = config.ticketPriceSat === 0 ? 'Gift raffle · organizer funds the prizes'
      : `Before fees and costs: ${number(haircutSat(config))} sat`;
    status.textContent = ''; print.disabled = false; save.disabled = embedded;
  } catch (error) { status.textContent = (error as Error).message; print.disabled = true; save.disabled = true;
    count.textContent = '—'; pool.textContent = ''; revenue.textContent = ''; balance.textContent = ''; }
  add.disabled = tiers.length >= 8;
}
function renderRows(): void {
  rows.replaceChildren();
  tiers.forEach((tier, index) => {
    const row = el('div', '', 'tier');
    for (const [key, name] of [['count', 'Tickets'], ['amountSat', 'Sats each'], ['label', 'Prize name']] as const) {
      const label = el('label', name); const input = el('input'); input.value = String(tier[key]);
      input.setAttribute('aria-label', `${name} ${index + 1}`);
      if (key !== 'label') { input.type = 'number'; input.min = '1'; input.step = '1'; }
      else input.maxLength = 40;
      input.addEventListener('input', () => { if (key === 'label') tier.label = input.value;
        else tier[key] = Number(input.value); update(); }); label.append(input); row.append(label);
    }
    const remove = el('button', '×', 'remove'); remove.type = 'button'; remove.disabled = tiers.length === 1;
    remove.setAttribute('aria-label', `Remove tier ${index + 1}`);
    remove.onclick = () => { tiers.splice(index, 1); renderRows(); update(); }; row.append(remove); rows.append(row);
  });
}
add.onclick = () => { tiers.push({ id: crypto.randomUUID(), count: 1, amountSat: 21, label: '' }); renderRows(); update(); };
preset.onchange = () => { tiers = preset.value === '600b' ? rockPlan().config.tiers
  : TIER_PRESETS.find(p => p.id === preset.value)!.build(); renderRows(); update(); };
for (const input of [title, price, paper, show]) input.addEventListener('input', update);
save.onclick = () => download(JSON.stringify(current(), null, 2), '600b-raffle-preview.json', 'application/json');
print.onclick = async () => {
  print.disabled = true;
  try {
    const payload = current();
    if (!embedded) {
      const destination = new URL('../ticket-printer/index.html', location.href);
      destination.hash = encodeURIComponent(JSON.stringify(payload)); location.assign(destination.href); return;
    }
    const available = await intent.available('ticket-printer');
    if (!available.available || !available.candidates.some(c => c.actions.includes('open') && c.conventions.includes(PREVIEW)))
      throw Error('No compatible ticket printer installed in this host.');
    const result = await intent.invoke({ archetype: 'ticket-printer', action: 'open', convention: PREVIEW, payload });
    status.textContent = result.ok && result.handled ? 'Plan sent to the ticket printer.' : 'Printer was not opened. Try again when available.';
  } catch (error) { status.textContent = (error as Error).message; }
  finally { print.disabled = false; }
};
renderRows(); update(); footer(app);
if (embedded) {
  try {
    const subscription = inc.on('napplet:raffle-manager/open-v1', event => {
      const payload = event.payload as Record<string, unknown> | null;
      const keys = payload && typeof payload === 'object' ? Object.keys(payload) : [];
      if (!payload || Array.isArray(payload) || payload.version !== 1
        || typeof payload.guildId !== 'string' || !payload.guildId || payload.guildId.length > 128
        || keys.some(key => !['version', 'guildId', 'raffleId'].includes(key))
        || (payload.raffleId !== undefined && (typeof payload.raffleId !== 'string'
          || !payload.raffleId || payload.raffleId.length > 128))) {
        status.textContent = 'Open request rejected: invalid context.'; return;
      }
      status.textContent = payload.raffleId ? 'Saved raffle loading needs the host raffle service. Your preview is unchanged.'
        : 'Raffle planner ready. This preview does not register a guild raffle.';
    });
    window.addEventListener('pagehide', () => subscription.close(), { once: true });
  } catch { /* The local planner remains usable without optional intent delivery. */ }
}
