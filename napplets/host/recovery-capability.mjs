// SPDX-License-Identifier: MIT
import { recoveryEvent } from './recovery.mjs';

/** Bind to a trusted host signer with explicit signEvent consent and account-change detection. */
export function recoveryCapability(ledger, signer, now = () => Math.floor(Date.now() / 1000), synchronize) {
  async function scoped(caseId) {
    const pubkey = await signer.getPublicKey();
    if (!ledger.canRead(caseId, pubkey)) throw Error('Not authorized to read this recovery case');
    return { pubkey, view: ledger.inspect(caseId) };
  }
  return {
    async prepare({ memberId }) {
      const key = await signer.getPublicKey();
      // Inert case only. Host transport must also rate-limit and require explicit user action.
      return ledger.prepare(memberId, key);
    },
    async read({ caseId }) { return (await scoped(caseId)).view; },
    async attest({ caseId, purpose }) {
      const { pubkey, view } = await scoped(caseId);
      const record = Object.fromEntries(['version', 'guildId', 'domain', 'caseId', 'memberId', 'oldKey', 'newKey',
        'expectedVersion', 'policyDigest', 'createdAt', 'expiresAt'].map(key => [key, view[key]]));
      const event = await signer.signEvent(recoveryEvent(record, purpose, pubkey, now()));
      if (await signer.getPublicKey() !== pubkey || event.pubkey !== pubkey) throw Error('Signer account changed');
      ledger.submit(caseId, purpose, event);
      return ledger.inspect(caseId);
    },
    async activate({ caseId }) {
      await scoped(caseId); ledger.activate(caseId);
      if (synchronize) await synchronize(caseId);
      return (await scoped(caseId)).view;
    },
  };
}
