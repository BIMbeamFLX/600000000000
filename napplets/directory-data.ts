// SPDX-License-Identifier: MIT
import snapshot from '../data/elders-2026-09-09.json' with { type: 'json' };

// Build-time projection: omit public keys, source notes and allocations from browser bundles.
export const directoryDefines = {
  __DIRECTORY_MEMBERS__: JSON.stringify(snapshot.founders.map(member => ({
    id: member.id, name: member.name, nip05: member.nip05, missingKey: !member.pubkey,
  }))),
  __DIRECTORY_DATE__: JSON.stringify(snapshot.snapshot_date),
};
