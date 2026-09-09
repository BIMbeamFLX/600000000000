// SPDX-License-Identifier: MIT
import { totalAmountSat, ticketCount, type LotteryConfig } from '../vendor/lnurlcash-raffle/lottery';
export const PREVIEW = 'napplet:ticket-printer/preview-v1';
export type PreviewPlan = { version: 1; config: LotteryConfig };

function record(value: unknown, fields: string[]): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some(key => !fields.includes(key))) throw Error('Invalid plan fields.');
  return value as Record<string, unknown>;
}
function text(value: unknown, max: number): string {
  if (typeof value !== 'string' || value.length > max || !/^[\x20-\x7e\u00a0-\u00ff]*$/.test(value))
    throw Error(`Use printable Latin text, up to ${max} characters.`);
  return value;
}
function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min || value > max)
    throw Error(`Use whole numbers between ${min} and ${max.toLocaleString('en-US')}.`);
  return value;
}
/** Validate all boundary data before rendering or passing it to upstream PDF code. */
export function parsePlan(input: unknown): PreviewPlan {
  if (new TextEncoder().encode(JSON.stringify(input)).length > 8192) throw Error('Plan is too large.');
  const envelope = record(input, ['version', 'config']);
  if (envelope.version !== 1) throw Error('Unsupported plan version.');
  const c = record(envelope.config, ['title', 'tiers', 'showAmount', 'paper', 'ticketPriceSat']);
  if (!Array.isArray(c.tiers) || c.tiers.length < 1 || c.tiers.length > 8)
    throw Error('Choose between 1 and 8 prize tiers.');
  if (typeof c.showAmount !== 'boolean' || !['a4', 'letter'].includes(String(c.paper)))
    throw Error('Invalid print options.');
  const config: LotteryConfig = {
    title: text(c.title, 80).trim(), paper: c.paper as 'a4' | 'letter', showAmount: c.showAmount,
    ticketPriceSat: integer(c.ticketPriceSat, 0, 2_100_000_000),
    tiers: c.tiers.map(value => {
      const tier = record(value, ['id', 'count', 'amountSat', 'label']);
      return { id: text(tier.id, 80), count: integer(tier.count, 1, 300),
        amountSat: integer(tier.amountSat, 1, 2_100_000_000), label: text(tier.label, 40) };
    })
  };
  if (!config.title) throw Error('Give your raffle a title.');
  if (new Set(config.tiers.map(tier => tier.id)).size !== config.tiers.length)
    throw Error('Prize tier IDs must be unique.');
  if (ticketCount(config) > 300) throw Error('This preview supports up to 300 tickets.');
  if (totalAmountSat(config) > 2_100_000_000) throw Error('Prize pool exceeds the preview limit.');
  return { version: 1, config };
}
/** A harmless initial plan; it carries no money or identity. */
export function rockPlan(): PreviewPlan {
  return { version: 1, config: { title: '600B Rock Raffle', showAmount: true, paper: 'a4',
    ticketPriceSat: 0, tiers: [
      { id: 'grand', count: 1, amountSat: 2100, label: 'The big rock' },
      { id: 'party', count: 20, amountSat: 21, label: 'A little rock' }
    ] } };
}
