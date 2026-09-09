// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { ATOMS, SUPPLY, ELDER_RESERVE, PEBBLE_RESERVE, SALE_RESERVE,
  GENERAL_RESERVE, buildPlan } from '../scripts/supply-plan.mjs';

test('600,000 distinct member slots include 600 elders and reconcile the fixed supply', () => {
  const years = buildPlan();
  assert.equal(years.length, 21);
  const last = years.at(-1);
  assert.equal(last.members, 600_000);
  assert.equal(last.elders, 600);
  assert.equal(last.pebbles, 599_400);
  assert.equal(last.cumulativeElders, 1_827 * ATOMS);
  assert.equal(last.cumulativePebbles, 82_312_336_200);
  assert.equal(last.cumulativeSales, 124_031_250_000);
  assert.equal(last.treasury, 210_956_413_800);
  assert.equal(ELDER_RESERVE + PEBBLE_RESERVE + SALE_RESERVE + GENERAL_RESERVE, SUPPLY);
  for (const row of years) {
    assert.equal(row.treasury + row.cumulativeElders + row.cumulativePebbles
      + row.cumulativeSales + row.cumulativeBurn, SUPPLY);
    assert.equal(row.outstanding, SUPPLY);
  }
});

test('no buyers means no sales revenue and unsold tokens remain in the treasury', () => {
  const last = buildPlan({ saleFillPercent: 0 }).at(-1);
  assert.equal(last.cumulativeSales, 0);
  assert.equal(last.treasury, SUPPLY - last.cumulativeElders - last.cumulativePebbles);
});

test('optional burns reduce total outstanding supply without touching the elder reserve', () => {
  const last = buildPlan({ burnPerYear: 10 * ATOMS }).at(-1);
  assert.equal(last.outstanding, 5_790 * ATOMS);
  assert.equal(last.cumulativeElders, ELDER_RESERVE);
  assert.equal(last.treasury, 189_956_413_800);
  assert.throws(() => buildPlan({ burnPerYear: 100 * ATOMS }), RangeError);
});
