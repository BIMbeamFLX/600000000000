// SPDX-License-Identifier: MIT
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const ATOMS = 100_000_000;
export const SUPPLY = 6_000 * ATOMS;
export const ELDER_RESERVE = 30 * 2_100_000_000 + 570 * 210_000_000;
export const PEBBLE_RESERVE = 2_100 * ATOMS;
export const SALE_RESERVE = 1_260 * ATOMS;
export const GENERAL_RESERVE = SUPPLY - ELDER_RESERVE - PEBBLE_RESERVE - SALE_RESERVE;

// Targets are planning assumptions, not adoption or price forecasts.
export const PHASES = [
  { members: 6_000, elders: 30, reward: 2_100_000, annualSale: 0 },
  { members: 18_000, elders: 60, reward: 1_050_000, annualSale: 210 * ATOMS },
  { members: 42_000, elders: 120, reward: 525_000, annualSale: 105 * ATOMS },
  { members: 90_000, elders: 210, reward: 262_500, annualSale: 52.5 * ATOMS },
  { members: 186_000, elders: 330, reward: 131_250, annualSale: 26.25 * ATOMS },
  { members: 366_000, elders: 450, reward: 65_625, annualSale: 13.125 * ATOMS },
  { members: 600_000, elders: 600, reward: 32_812, annualSale: 6.5625 * ATOMS }
];

/** Build a 21-year maximum-distribution scenario using exact atomic units. */
export function buildPlan({ burnPerYear = 0, saleFillPercent = 100 } = {}) {
  if (!Number.isSafeInteger(burnPerYear) || burnPerYear < 0
      || burnPerYear * 21 > GENERAL_RESERVE
      || !Number.isInteger(saleFillPercent) || saleFillPercent < 0 || saleFillPercent > 100) {
    throw new RangeError('Invalid reserve or sale scenario');
  }
  let members = 30;
  let elders = 30;
  let cumulativeElders = 0;
  let cumulativePebbles = 0;
  let cumulativeSales = 0;
  let cumulativeBurn = 0;
  const years = [];
  PHASES.forEach((phase, phaseIndex) => {
    const previous = PHASES[phaseIndex - 1] ?? { members: 0, elders: 30 };
    const annualMembers = (phase.members - previous.members) / 3;
    const annualElders = (phase.elders - previous.elders) / 3;
    for (let offset = 0; offset < 3; offset++) {
      const first = phaseIndex === 0 && offset === 0;
      const addedMembers = annualMembers - (first ? 30 : 0);
      const addedElders = annualElders;
      const addedPebbles = addedMembers - addedElders;
      const elderGrant = first ? 630 * ATOMS : addedElders * 210_000_000;
      const pebbleGrant = addedPebbles * phase.reward;
      const sale = Math.floor(phase.annualSale * saleFillPercent / 100);
      members += addedMembers;
      elders += addedElders;
      cumulativeElders += elderGrant;
      cumulativePebbles += pebbleGrant;
      cumulativeSales += sale;
      cumulativeBurn += burnPerYear;
      const treasury = SUPPLY - cumulativeElders - cumulativePebbles
        - cumulativeSales - cumulativeBurn;
      if (![treasury, elderGrant, pebbleGrant, sale].every(Number.isSafeInteger)
          || treasury < 0 || cumulativeElders > ELDER_RESERVE
          || cumulativePebbles > PEBBLE_RESERVE || cumulativeSales > SALE_RESERVE) {
        throw new RangeError('Allocation exceeds funded model reserve');
      }
      years.push({ year: years.length + 1, members, elders, pebbles: members - elders,
        addedMembers, addedElders, addedPebbles, reward: phase.reward,
        elderGrant, pebbleGrant, sale, burn: burnPerYear, cumulativeElders,
        cumulativePebbles, cumulativeSales, cumulativeBurn,
        outstanding: SUPPLY - cumulativeBurn, treasury });
    }
  });
  return years;
}

/** Format an exact asset amount for a readable schedule. */
export function tokens(atoms) {
  return (atoms / ATOMS).toLocaleString('en-US', { maximumFractionDigits: 8 });
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const rows = buildPlan();
  console.log('| Year | Total members | Elders | Elder grants | Pebble grants | Sale cap | Treasury left |');
  console.log('|---:|---:|---:|---:|---:|---:|---:|');
  for (const row of rows) {
    console.log(`| ${row.year} | ${row.members.toLocaleString('en-US')} | ${row.elders} | `
      + `${tokens(row.elderGrant)} | ${tokens(row.pebbleGrant)} | ${tokens(row.sale)} | `
      + `${tokens(row.treasury)} |`);
  }
}
