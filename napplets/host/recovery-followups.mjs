// SPDX-License-Identifier: MIT
import { requireValue } from './guild-store.mjs';

/** Execute confirmed recovery follow-ups in revocation-first order, with durable reconciliation. */
export async function synchronizeRecovery(ledger, journal, caseId, adapters) {
  const view = ledger.inspect(caseId);
  requireValue(view.status === 'activated', 'Identity has not been activated');
  const authorize = async () => {
    const member = ledger.member(view.memberId);
    requireValue(member.version === view.expectedVersion + 1 && member.pubkey === view.newKey, 'Recovery superseded');
  };
  const tasks = [
    ['revoke-old-sessions', 'sessions'], ['renew-marmot-access', 'marmot'], ['publish-current-identity', 'publication'],
  ];
  for (const [task, adapterName] of tasks) {
    await authorize();
    const adapter = adapters[adapterName];
    if (!adapter || (adapterName === 'marmot' && adapter.protocol !== 'marmot')) return { state: 'blocked', task };
    const result = await journal.run({ requestId: `${caseId}-${adapterName}`, task, caseId,
      memberId: view.memberId, oldKey: view.oldKey, newKey: view.newKey, identityVersion: view.expectedVersion + 1 }, adapter, authorize);
    if (result.state !== 'confirmed') return { state: 'uncertain', task };
    ledger.confirmFollowup(caseId, task, result.receiptId);
  }
  return { state: 'confirmed' };
}

/** Host signer's NIP-07 adapter; the napplet never receives the extension or a private key. */
export function nip07RecoverySigner(extension, confirm) {
  requireValue(extension && typeof extension.getPublicKey === 'function' && typeof extension.signEvent === 'function'
    && typeof confirm === 'function', 'NIP-07 signer and consent UI required');
  return {
    getPublicKey: () => extension.getPublicKey(),
    async signEvent(template) {
      const before = await extension.getPublicKey();
      requireValue(before === template.pubkey, 'Selected signer does not match the recovery proof');
      requireValue(await confirm(structuredClone(template)) === true, 'Signing declined');
      requireValue(await extension.getPublicKey() === before, 'Signer changed during consent');
      const result = await extension.signEvent(structuredClone(template));
      requireValue(await extension.getPublicKey() === before && result.pubkey === before, 'Signer changed during signing');
      return result; // RecoveryLedger verifies the event's exact content and Schnorr signature.
    },
  };
}
