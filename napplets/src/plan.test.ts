// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { parsePlan, rockPlan } from './plan';
import { ticketCount, totalAmountSat } from '../vendor/lnurlcash-raffle/lottery';

describe('preview boundary', () => {
  it('preserves the 21-ticket party budget through JSON handoff', () => {
    const plan = parsePlan(JSON.parse(JSON.stringify(rockPlan())));
    expect(ticketCount(plan.config)).toBe(21);
    expect(totalAmountSat(plan.config)).toBe(2520);
  });
  it('rejects bearer material and unknown envelope fields', () => {
    expect(() => parsePlan({ ...rockPlan(), noteUrl: 'https://mint.example/?k1=secret' })).toThrow();
    const plan = rockPlan();
    expect(() => parsePlan({ version: 1, config: { ...plan.config, seed: 'secret' } })).toThrow();
  });
  it('rejects fractional, oversized, negative and unsupported inputs before expansion', () => {
    for (const count of [0, -1, 1.5, 301, Infinity]) {
      const plan = rockPlan(); plan.config.tiers[0]!.count = count;
      expect(() => parsePlan(plan)).toThrow();
    }
    expect(() => parsePlan({ ...rockPlan(), version: 2 })).toThrow();
    expect(() => parsePlan(null)).toThrow();
    const plan = rockPlan(); plan.config.tiers[1]!.count = 300;
    expect(() => parsePlan(plan)).toThrow(/300 tickets/);
  });
  it('rejects duplicated IDs and text the print fonts cannot encode', () => {
    const duplicate = rockPlan(); duplicate.config.tiers[1]!.id = 'grand';
    expect(() => parsePlan(duplicate)).toThrow(/unique/);
    const emoji = rockPlan(); emoji.config.title = 'Rock 🪨';
    expect(() => parsePlan(emoji)).toThrow(/Latin/);
  });
});
