# Elder identity review and recovery napplet

Design for the next implementation step, 9 September 2026. No live identity
mutation, guardian policy, multisignature wallet, or recovery endpoint is shipped
by the static Elders page. A working host and authenticated backend are required.

## Current roster

The user authorized using the existing keys while the whole roster is reviewed.
`data/elders-2026-09-09.json` freezes 30 stable founder IDs and their 21-token
allocations. It records 29 existing public-key mappings; all are marked
`signature_review_pending`. An existing key is not a completed identity review.

Michael1011 uses the existing local `michael1011` NIP-05 alias because the roster's
`m@bol.tz` endpoint was unavailable. Benarc uses the resolved `ben@nostr.com`
record. Gadaj has no exact recorded mapping and stays blocked with 21 reserved.
GDJ is a different listed member; do not reuse that key without an explicit
identity decision. Never silently merge or duplicate the two founding allocations.

Future edits to `members.json` do not append founders. Key replacements update the
stable membership record through the approved workflow, not by deleting its history.
The frozen file remains a historical input; the operational SQLite ledger owns
verified current keys, claims, and recovery decisions.

All 600 elder admissions require an in-person meeting and review. Officer,
treasurer, recovery guardian, and Marmot group administrator are separately
assigned duties; buying a title or joining a group grants none of them.

## Napplet boundary

The napplet is the review interface inside the Nappelin host. It runs sandboxed
with `allow-scripts` and without `allow-same-origin`. NIP-07 access, wallet access,
and private keys remain host-side. Use the actual host SDK identity/signing
capabilities when available; do not invent an unverified postMessage signing API.
Missing capabilities produce a read-only review state, never a bypass.

The interface should show: recorded member name/key, key-proof state, NIP-05
mapping state, last review date, claim state, and any pending recovery. NIP-05
resolution is a domain mapping, not proof of personhood. NIP-07 possession proof
is also not proof of an uncompromised real-world identity.

## Review every existing member

1. Resolve the recorded NIP-05 mapping and compare it to the stored key. Surface
   mismatches for review; a changed domain response must not replace a key.
2. The backend issues a one-use challenge with purpose, site origin, stable member
   ID, expected key, random nonce, and short expiry. Persist issuance before signing.
3. The host shows the exact purpose and asks the user's signer to sign. The backend
   verifies the event ID, Schnorr signature, bound fields, expiry, and nonce.
4. Record the verified proof and review decision in SQLite. Independent elders
   confirm disputed identity mappings through an established contact path.
5. Publish only the intended public roster projection. Do not publish private
   recovery evidence, wallet keys, or personal contact information to Nostr relays.

## Hacked or lost key: elder approval quorum

Proposed starting policy for review: **3 distinct guardians from 5 designated,
verified elders**, with a **42-hour notification period** before activation.
The guardian names, threshold, and delay must be approved and configured before
enabling recovery. “Any three accounts calling themselves elders” is not a policy.

This is an application-level quorum of independently verified Nostr signatures,
not a newly invented Nostr multisignature standard or a Bitcoin/Liquid spend.
Treasury-wallet signing authority is a separate policy and separate set of keys.

- Create a case binding the stable member ID, previous key/version, proposed new
  key, purpose, case ID, policy version, and expiry. Prove possession of the new key.
- An unauthenticated request cannot freeze claims or change an identity. An
  emergency freeze needs authorized review under a separately configured policy.
- Guardians approve the identical case digest. Verify each signature against the
  frozen guardian policy for that case; one guardian contributes at most one vote.
  The affected/compromised identity cannot approve its own recovery.
- Notify the existing and proposed identities and the established contact path.
  A signature from a suspected compromised old key is not sufficient to approve,
  cancel, or indefinitely veto the recovery by itself.
- After the quorum and delay, recheck case freshness and activate atomically.
  Competing cases for the old key/version cannot both execute. Invalidate old
  sessions and pending challenges; retain all old records and reasons.
- The stable member ID, founding allocation, and consumed claim remain unchanged.
  Replacing a key never mints another membership or resets the claim counter.

Changing the guardian set itself requires the existing authorized policy; it
cannot be a shortcut for approving a pending recovery. If the quorum is unavailable,
recovery stays blocked. No operator override should be hidden behind a button.

Recovery changes the community's identity mapping. It cannot recover an old Nostr
private key, erase impersonation on other services, decrypt old messages, reverse
a confirmed token payment, or recover a Liquid wallet whose keys were lost.

After approved identity recovery, each affected Marmot group needs its own
authorized removal of the compromised client and admission of the replacement,
including the protocol's group-state/key update. A database key replacement alone
does not revoke group access. Do not copy old MLS secrets to the replacement or
promise recovery of chat history. FIPS node identity is independent; changing the
member's Nostr mapping must not rotate infrastructure keys automatically.

## Required acceptance tests

- Wrong key, changed NIP-05, stale/replayed challenge, forged signature, and wrong
  origin or purpose are rejected.
- Pending/unmapped members retain their allocation without becoming claimable.
- Duplicate guardian signatures, a target approving itself, wrong case digest,
  insufficient quorum, expired cases, and competing key versions cannot activate.
- A key rotation preserves consumed claims. Recovery cannot repeat a payout when
  a worker restarts or a payment response was lost.
- A napplet cannot call wallet/signing primitives directly or cause the host to
  sign an arbitrary event outside the explicitly displayed permitted action.

Use the [NIP-07 specification](https://github.com/nostr-protocol/nips/blob/master/07.md)
for the signer boundary and [NIP-05](https://github.com/nostr-protocol/nips/blob/master/05.md)
for domain-to-key mapping. Pin the verification library and implement using the
real host SDK and backend rather than treating this design as an operational service.
