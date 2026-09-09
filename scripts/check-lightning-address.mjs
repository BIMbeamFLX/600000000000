// SPDX-License-Identifier: MIT
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

/** Inspect discovery only: never invoke the invoice callback or pay an invoice. */
export async function checkLightningAddress(address, fetcher = fetch) {
  const match = /^([a-z0-9_.+-]+)@([a-z0-9.-]+)$/i.exec(address);
  if (!match || match[1] !== match[1].toLowerCase() || match[2].endsWith('.onion'))
    throw new Error('Expected a clearnet Lightning address with a lowercase username.');
  const endpoint = new URL(`https://${match[2]}/.well-known/lnurlp/${encodeURIComponent(match[1])}`);
  const result = { address, endpoint: endpoint.href, ok: false };
  let response;
  try {
    response = await fetcher(endpoint.href, { redirect: 'error', signal: AbortSignal.timeout(10000) });
  } catch (error) {
    return { ...result, stage: 'transport', reason: error.cause?.code ?? error.name,
      detail: 'DNS, TLS, timeout, connection or redirect failure; inspect the upstream separately.' };
  }
  if (!response.ok) return { ...result, stage: 'http', status: response.status };
  let data;
  try { data = await response.json(); } catch { return { ...result, stage: 'json', reason: 'Expected JSON, received another response.' }; }
  if (!data || data.tag !== 'payRequest' || data.status === 'ERROR')
    return { ...result, stage: 'protocol', reason: 'Endpoint did not return a payRequest.' };
  if (!Number.isSafeInteger(data.minSendable) || !Number.isSafeInteger(data.maxSendable)
    || data.minSendable < 1 || data.minSendable > data.maxSendable)
    return { ...result, stage: 'amounts', reason: 'Invalid millisatoshi bounds.' };
  try {
    if (typeof data.metadata !== 'string') throw Error();
    const metadata = JSON.parse(data.metadata);
    if (!Array.isArray(metadata) || !metadata.every(row => Array.isArray(row) && typeof row[0] === 'string')
      || metadata.filter(row => row[0] === 'text/plain' && typeof row[1] === 'string').length !== 1
      || !metadata.some(row => ['text/identifier', 'text/email'].includes(row[0]) && row[1] === address)) throw Error();
  } catch { return { ...result, stage: 'metadata', reason: 'Missing valid text/plain or address identifier metadata.' }; }
  let callback;
  try {
    callback = new URL(data.callback);
    if (callback.protocol !== 'https:' || callback.username || callback.password) throw Error();
  } catch { return { ...result, stage: 'callback', reason: 'Expected an HTTPS callback without credentials.' }; }
  return { ...result, ok: true, stage: 'discovery', callbackOrigin: callback.origin,
    minSendableMsat: data.minSendable, maxSendableMsat: data.maxSendable,
    note: 'Discovery passed; callback reachability, invoice validity and payment are not tested.' };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  try {
    const result = await checkLightningAddress(process.argv[2] ?? 'flx@600.wtf');
    console.log(JSON.stringify(result, null, 2));
    if (!result.ok) process.exitCode = 1;
  } catch (error) { console.error(error.message); process.exitCode = 2; }
}
