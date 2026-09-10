# Web of Trust and Nostrocket: recovery decisions

Inspected 10 September 2026, during implementation. No trust provider was queried
for private member activity, and no group messages were exported.

## Web of Trust

[NIP-85](https://github.com/nostr-protocol/nips/blob/master/85.md) defines signed
trusted assertions, including pubkey scores in kind 30382, and provider preferences
in kind 10040. It is a draft optional protocol. A score is an assertion from a
chosen provider/algorithm, not proof that an account may recover another identity.
Algorithms and trust roots matter; ranking is not an authorization standard.

Decision: WoT may inform future review context. Do not derive guardians, weighted
votes, identity proof or automatic acceptance from scores, follows, chat volume,
zaps or purchases. A future adapter must verify signatures, selected provider,
subject, freshness and algorithm context before presenting a score as evidence.
No NIP-85 adapter is enabled in this change.

## Nostrocket

Protocol repository inspected at
[`9128a71`](https://github.com/nostrocket/NIPS/tree/9128a71da624b780e7b9157481cc135781439e51).

- [31108](https://github.com/nostrocket/NIPS/blob/9128a71da624b780e7b9157481cc135781439e51/31108.md)
  proposes linked signed state, explicit rulesets and proof-based transitions.
  It is marked RAW. This is useful architectural precedent for binding a recovery
  to its previous state and policy. Our SQLite service is not an MSB implementation
  or a distributed consensus engine.
- [Identity Tree](https://github.com/nostrocket/NIPS/blob/9128a71da624b780e7b9157481cc135781439e51/legacy/Identity.md)
  and [SimpleTree](https://github.com/nostrocket/NIPS/blob/9128a71da624b780e7b9157481cc135781439e51/legacy/SimpleTree.md)
  describe identity admission/removal histories and scoped permissions. They live
  under legacy and use inconsistent event-kind generations. They do not constitute
  a verified drop-in key-recovery implementation.
- [MSBR334000](https://github.com/nostrocket/NIPS/blob/9128a71da624b780e7b9157481cc135781439e51/MSBR334000.md)
  computes vote power from merits multiplied by leadtime; merits can be transferred
  or sold under its rules. We do not import that authority model into avatar recovery.

Decision: explicit policy digest, stable member ID, expected previous version,
signed approvals, durable history and atomic changes. One designated eligible
guardian contributes at most one approval. No claim of Nostrocket wire compatibility.
No Nostrocket source copied: its repository is MPL-2.0; our new code stays MIT.

## Percentage policy

Selecting 60% by activity and accepting 85% of those is approximately 51% of the
original population, with extra rounding effects. The implementation uses 85% of
an explicitly designated eligible guardian set, rounded up, excluding the target.
It does not select the most active 60%. The default minimum delay is 42 hours after
both quorum and notification attestation. Actual guardian designation and live
policy approval remain prerequisites; no real founder keys bootstrap the service.
