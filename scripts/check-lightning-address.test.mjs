// SPDX-License-Identifier: MIT
import test from 'node:test';
import assert from 'node:assert/strict';
import { checkLightningAddress } from './check-lightning-address.mjs';
const address = 'flx@600.wtf';
const valid = { tag: 'payRequest', minSendable: 1000, maxSendable: 21000,
  metadata: JSON.stringify([['text/plain', 'Community'], ['text/identifier', address]]),
  callback: 'https://mint.example/callback' };

test('makes one discovery GET and never calls the invoice callback', async () => {
  const calls = [];
  const result = await checkLightningAddress(address, async (url, options) => {
    calls.push({ url, options }); return Response.json(valid);
  });
  assert.equal(result.ok, true);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, 'https://600.wtf/.well-known/lnurlp/flx');
  assert.equal(calls[0].options.redirect, 'error');
});
test('distinguishes a broken upstream from invalid protocol JSON', async () => {
  assert.equal((await checkLightningAddress(address, async () => new Response('Bad Gateway', { status: 502 }))).stage, 'http');
  assert.equal((await checkLightningAddress(address, async () => new Response('<html>'))).stage, 'json');
  assert.equal((await checkLightningAddress(address, async () => Response.json({ status: 'ERROR' }))).stage, 'protocol');
});
test('rejects unsafe amount bounds, missing metadata and insecure callbacks', async () => {
  for (const [patch, stage] of [[{ minSendable: 0 }, 'amounts'], [{ maxSendable: 0 }, 'amounts'],
    [{ metadata: '[]' }, 'metadata'], [{ callback: 'http://mint.example' }, 'callback']]) {
    assert.equal((await checkLightningAddress(address, async () => Response.json({ ...valid, ...patch }))).stage, stage);
  }
});
test('reports TLS failures without disabling verification', async () => {
  const result = await checkLightningAddress(address, async () => {
    throw Object.assign(new Error('fetch failed'), { cause: { code: 'ERR_TLS_CERT_ALTNAME_INVALID' } });
  });
  assert.equal(result.stage, 'transport');
  assert.equal(result.reason, 'ERR_TLS_CERT_ALTNAME_INVALID');
});
test('rejects malformed addresses before making network requests', async () => {
  await assert.rejects(checkLightningAddress('flx@600.wtf/path', () => { throw Error('Must not fetch'); }));
});
