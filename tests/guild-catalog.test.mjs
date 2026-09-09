// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const readJson = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const charter = readJson('../data/guild-charter.json');
const catalog = readJson(`../${charter.composition.catalog}`);

test('each composable tool has a distinct role and bounded open payload', () => {
  assert.equal(new Set(catalog.napplets.map(tool => tool.id)).size, catalog.napplets.length);
  assert.equal(new Set(catalog.napplets.map(tool => tool.archetype.slug)).size,
    catalog.napplets.length);
  for (const tool of catalog.napplets) {
    assert.ok(['upstream_draft', 'local_proposal'].includes(tool.archetype.status));
    assert.ok(tool.accepts.length > 0);
    for (const contract of tool.accepts) {
      assert.equal(contract.action, 'open');
      assert.match(contract.convention, /^napplet:[a-z][a-z0-9-]*\/[a-z][a-z0-9-]*$/);
      assert.equal(contract.convention.split(':')[1].split('/')[0], tool.archetype.slug);
      assert.equal(contract.payload.version, catalog.contract_version);
      assert.ok(contract.payload.required.includes('guildId'));
      assert.equal(contract.payload.additional_fields, false);
      assert.ok(contract.payload.max_bytes <= 2048);
      const fields = [...contract.payload.required, ...contract.payload.optional];
      assert.equal(new Set(fields).size, fields.length);
    }
  }
});

test('outgoing intents resolve by role to an explicitly accepted convention', () => {
  for (const source of catalog.napplets) {
    for (const outgoing of source.dispatches) {
      assert.equal(outgoing.handler, undefined);
      const candidates = catalog.napplets.filter(tool => tool.archetype.slug === outgoing.archetype);
      assert.ok(candidates.some(tool => tool.accepts.some(
        accepted => accepted.convention === outgoing.convention)),
      `${source.id} has no compatible design handler for ${outgoing.convention}`);
    }
  }
});
