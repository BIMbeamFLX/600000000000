# 600B guild: Nostr, Marmot, FIPS

Design and static preview, 9 September 2026. No live guild membership service,
Marmot group, FIPS endpoint, or payout service is configured in this repository.
`data/guild-charter.json` records these services as unconnected.

**Required architecture: every function is a separate composable napplet.**
The guild portal is a host layout composing independent tools. It must not own
one monolithic guild frontend. The [napplet composition contract](guild-napplets.md)
and `data/guild-napplets.json` define the boundaries for implementation.

## Product

The guild has a roster, reviewed admissions, officers, local meetups, shared
operations, and a Liquid treasury. Membership cohorts are 600 IRL-only elders,
21,000 Rai Stones, and subsequent rock types totaling 600,000 people. Later rock
capacities and rewards remain proposals in the [supply plan](600-21-year-plan.md).

Keep three fields independent: admission cohort, assigned duties, and optional
paid cosmetic title. A paid title cannot grant officer authority, elder status,
chat administration, treasury access, faster progress, or a second welcome claim.
An elder promotion must preserve the stable member ID and earlier claim history;
the backend must explicitly settle any earlier online grant before allocating
the elder entitlement, without counting the same person twice in the budget.

## Portal reference

The public [Einundzwanzig welcome page](https://portal.einundzwanzig.space/welcome)
was inspected in the browser: meetup-list entry, map entry, sign-in, language
selection, and a visible Nostr connect entry. Its private dashboard, membership
rules, and messaging implementation were not inspected or inferred.

Use that discovery pattern for local guild chapters: find a meetup, see its
public details, connect, and request admission. Publish only organizer-approved
locations; private gathering details belong in the chapter group. Do not scrape
or copy another community's member roster. The current preview has no meetup data.

## Selected protocol boundaries

| Layer | Choice | Responsibility |
|---|---|---|
| Member identity | Nostr, host-side NIP-07 | Prove control of the recorded key |
| Private groups | Marmot exclusively | Encrypted chapter, party, and elder communication |
| Network | FIPS mesh | Carry traffic to configured guild services/relays |
| Guild state | Application + SQLite audit | Admission, duties, claims, recovery, treasury records |
| Asset settlement | Liquid | Transfer the correct asset once per approved entitlement |

[Marmot](https://github.com/marmot-protocol/marmot) combines Nostr identity and
event-shaped application payloads with MLS group key agreement. Its current
specification is organized by protocol surface; the old MIP-era documents are
deprecated. Pin the chosen client/library revision and matching protocol version
before integration, and prove interoperability with a second compatible client.
NIP-07 alone does not supply an MLS client, group state, or message storage.

Use separate chapter and party groups. The 600,000-member target is not a claim
that a single MLS group has been load-tested for 600,000 clients. Public discovery
and encrypted group membership are separate projections. Do not publish private
membership lists or internal group identifiers in the public guild charter.

[FIPS](https://fips.network/) is the Free Internetworking Peering System.
Its [implementation](https://github.com/jmcorgan/fips) supports encrypted mesh
networking and an IPv6 adapter. Use a local node or a deliberately configured
gateway to reach mesh services. Opening a normal website cannot install that
network path. FIPS transport encryption and Marmot group encryption have different
endpoints; both remain part of this design.

The FIPS project has a [Nostr relay sidecar example](https://github.com/jmcorgan/fips/tree/master/examples/sidecar-nostr-relay).
That is an integration starting point, not evidence that our relay is running.
Configure actual addresses only after connectivity and browser TLS/WebSocket
behavior are verified. Never derive an endpoint from an arbitrary member npub.
Keep infrastructure node keys separate from member signing keys.

The local `fips` skill also describes Palace reverse-proxy settings. Those apply
only if the separate Palace service is used; this static repository has no
Colyseus server. A domain name alone does not establish a FIPS mesh connection.

## Admission and group lifecycle

1. Host obtains explicit NIP-07 consent and signs a server-issued, purpose-bound,
   expiring challenge. Backend verifies it; `getPublicKey()` is only a display hint.
2. Persist the reviewed membership decision and stable member ID in SQLite.
   Require in-person review for elders; a new key is not proof of a new person.
3. An authorized group administrator invites the approved member through the
   selected Marmot client's supported flow. A clicked invite is not treasury authority.
4. The client manages MLS state and secrets in protected host/client storage.
   Sandboxed napplets use explicit host capabilities, never direct private-key access.
5. Persist admission/removal outcomes without putting chat secrets into the public
   audit projection. Reconcile retries instead of assuming a timed-out invite failed.
6. Removal and compromised-key recovery must update the relevant groups as well
   as the guild ledger. Keep consumed claims and original allocations intact.

Private groups must remain Marmot groups when the transport is unavailable.
Surface an unavailable state; never silently downgrade to public notes or a
different group protocol. Wallet actions require their own approved and verified
workflow; messages and role labels cannot authorize transfers.

## Before enabling invitations

Choose and pin a maintained compatible Marmot client/SDK; configure the actual
group administrators, redundant relay delivery, and FIPS node/gateway path.
Verify join, concurrent updates, removal, restart/state restoration, replay
rejection, and recovery with two clients. Test that a removed client cannot read
new messages after the group update and that a disconnected transport does not
trigger plaintext delivery. Measure practical group size before setting caps.

Verify signed admission, role authorization, duplicate claim rejection, payout
reconciliation, and privacy separately. The current browser tests cover only
the static welcome and the closed Elders desk, not protocol interoperability.
