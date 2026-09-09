// SPDX-License-Identifier: MIT
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

export const ATOMS = 100_000_000;
export const SUPPLY = 6_000 * ATOMS;
export const ELDER_RESERVE = 30 * 2_100_000_000 + 570 * 210_000_000;
export const ROCK_RESERVE = 2_100 * ATOMS;
export const SALE_RESERVE = 1_260 * ATOMS;
export const GENERAL_RESERVE = SUPPLY - ELDER_RESERVE - ROCK_RESERVE - SALE_RESERVE;

// Rai count is user-specified; later cohort names, counts, and rewards are draft allocations.
export const ROCK_TIERS = [
  { name: 'Rai Stones', count: 21_000, reward: 2_100_000 },
  { name: 'Obsidian Operators', count: 42_000, reward: 1_050_000 },
  { name: 'Basalt Buddies', count: 84_000, reward: 525_000 },
  { name: 'Granite Gang', count: 126_000, reward: 262_500 },
  { name: 'Pumice Punks', count: 168_000, reward: 131_250 },
  { name: 'Pocket Pebbles', count: 158_400, reward: 65_625 }
];

// Targets are planning assumptions, not adoption or price forecasts.
export const PHASES = [
  { members: 6_000, elders: 30, annualSale: 0 },
  { members: 18_000, elders: 60, annualSale: 210 * ATOMS },
  { members: 42_000, elders: 120, annualSale: 105 * ATOMS },
  { members: 90_000, elders: 210, annualSale: 52.5 * ATOMS },
  { members: 186_000, elders: 330, annualSale: 26.25 * ATOMS },
  { members: 366_000, elders: 450, annualSale: 13.125 * ATOMS },
  { members: 600_000, elders: 600, annualSale: 6.5625 * ATOMS }
];

/** Price the next finite group of welcome slots, splitting correctly at tier boundaries. */
export function rockGrant(alreadyJoined, joining) {
  const cap = ROCK_TIERS.reduce((sum, tier) => sum + tier.count, 0);
  if (!Number.isInteger(alreadyJoined) || !Number.isInteger(joining)
      || alreadyJoined < 0 || joining < 0 || alreadyJoined + joining > cap) {
    throw new RangeError('Online membership exceeds the available rock slots');
  }
  let start = 0;
  let grant = 0;
  for (const tier of ROCK_TIERS) {
    const end = start + tier.count;
    const covered = Math.max(0, Math.min(end, alreadyJoined + joining)
      - Math.max(start, alreadyJoined));
    grant += covered * tier.reward;
    start = end;
  }
  return grant;
}

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
  let cumulativeRocks = 0;
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
      const addedRocks = addedMembers - addedElders;
      const elderGrant = first ? 630 * ATOMS : addedElders * 210_000_000;
      const onlineGrant = rockGrant(members - elders, addedRocks);
      const sale = Math.floor(phase.annualSale * saleFillPercent / 100);
      members += addedMembers;
      elders += addedElders;
      cumulativeElders += elderGrant;
      cumulativeRocks += onlineGrant;
      cumulativeSales += sale;
      cumulativeBurn += burnPerYear;
      const treasury = SUPPLY - cumulativeElders - cumulativeRocks
        - cumulativeSales - cumulativeBurn;
      if (![treasury, elderGrant, onlineGrant, sale].every(Number.isSafeInteger)
          || treasury < 0 || cumulativeElders > ELDER_RESERVE
          || cumulativeRocks > ROCK_RESERVE || cumulativeSales > SALE_RESERVE) {
        throw new RangeError('Allocation exceeds funded model reserve');
      }
      years.push({ year: years.length + 1, members, elders, onlineMembers: members - elders,
        addedMembers, addedElders, addedRocks,
        elderGrant, onlineGrant, sale, burn: burnPerYear, cumulativeElders,
        cumulativeRocks, cumulativeSales, cumulativeBurn,
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
  console.log('| Year | Total members | Elders | Elder grants | Rock grants | Sale cap | Treasury left |');
  console.log('|---:|---:|---:|---:|---:|---:|---:|');
  for (const row of rows) {
    console.log(`| ${row.year} | ${row.members.toLocaleString('en-US')} | ${row.elders} | `
      + `${tokens(row.elderGrant)} | ${tokens(row.onlineGrant)} | ${tokens(row.sale)} | `
      + `${tokens(row.treasury)} |`);
  }
}
