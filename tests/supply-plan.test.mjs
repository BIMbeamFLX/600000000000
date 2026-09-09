// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ATOMS, SUPPLY, ELDER_RESERVE, ROCK_RESERVE, SALE_RESERVE,
  GENERAL_RESERVE, ROCK_TIERS, rockGrant, buildPlan } from '../scripts/supply-plan.mjs';

test('600,000 distinct member slots include 600 elders and reconcile the fixed supply', () => {
  const years = buildPlan();
  assert.equal(years.length, 21);
  const last = years.at(-1);
  assert.equal(last.members, 600_000);
  assert.equal(last.elders, 600);
  assert.equal(last.onlineMembers, 599_400);
  assert.equal(last.cumulativeElders, 1_827 * ATOMS);
  assert.equal(last.cumulativeRocks, 197_820_000_000);
  assert.equal(last.cumulativeSales, 124_031_250_000);
  assert.equal(last.treasury, 95_448_750_000);
  assert.equal(ELDER_RESERVE + ROCK_RESERVE + SALE_RESERVE + GENERAL_RESERVE, SUPPLY);
  for (const row of years) {
    assert.equal(row.treasury + row.cumulativeElders + row.cumulativeRocks
      + row.cumulativeSales + row.cumulativeBurn, SUPPLY);
    assert.equal(row.outstanding, SUPPLY);
  }
});

test('no buyers means no sales revenue and unsold tokens remain in the treasury', () => {
  const last = buildPlan({ saleFillPercent: 0 }).at(-1);
  assert.equal(last.cumulativeSales, 0);
  assert.equal(last.treasury, SUPPLY - last.cumulativeElders - last.cumulativeRocks);
});

test('optional burns reduce total outstanding supply without touching the elder reserve', () => {
  const last = buildPlan({ burnPerYear: 10 * ATOMS }).at(-1);
  assert.equal(last.outstanding, 5_790 * ATOMS);
  assert.equal(last.cumulativeElders, ELDER_RESERVE);
  assert.equal(last.treasury, 74_448_750_000);
  assert.throws(() => buildPlan({ burnPerYear: 100 * ATOMS }), RangeError);
});

test('exactly 21,000 Rai Stones precede the other finite rock cohorts', () => {
  assert.equal(ROCK_TIERS[0].name, 'Rai Stones');
  assert.equal(ROCK_TIERS[0].count, 21_000);
  assert.equal(ROCK_TIERS.reduce((sum, tier) => sum + tier.count, 0), 599_400);
  assert.equal(rockGrant(20_999, 2), 2_100_000 + 1_050_000);
  assert.equal(rockGrant(62_999, 2), 1_050_000 + 525_000);
  assert.equal(rockGrant(599_399, 1), 65_625);
  assert.throws(() => rockGrant(599_400, 1), RangeError);
});

test('guild charter and treasury model allocate the same members and atom amounts', () => {
  const charter = JSON.parse(readFileSync(new URL('../data/guild-charter.json', import.meta.url)));
  assert.equal(charter.elders.reserve_atoms, ELDER_RESERVE);
  assert.equal(charter.elders.founders * charter.elders.founding_reward_atoms
    + (charter.elders.capacity - charter.elders.founders)
    * charter.elders.future_reward_atoms, ELDER_RESERVE);
  assert.deepEqual(charter.online_cohorts.map(tier => ({
    name: tier.name, count: tier.capacity, reward: tier.welcome_atoms
  })), ROCK_TIERS);
  assert.equal(charter.elders.capacity + charter.online_cohorts.reduce(
    (sum, tier) => sum + tier.capacity, 0), charter.target_members);
});
