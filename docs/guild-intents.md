# Guild intents and archetypes

Contract design, 9 September 2026. Catalog: `data/guild-napplets.json`.
Seventeen independent builds have local manifest metadata. Thirteen workspace tools
accept only the guild base context and use a separately granted host capability.
These builds are not installed on a production host. See [workspace contracts](guild-workspace.md).
Every new role/convention below is
a local proposal unless explicitly marked as an upstream draft.

## Vocabulary and evidence

An archetype names a role. A payload convention defines the data that role accepts.
NAP-INTENT supplies host-mediated discovery and dispatch. Reuse an upstream role
only when its boundary fits; application IDs do not determine role identity.
The [upstream registry](https://github.com/napplet/naps/blob/master/ARCHETYPES.md)
lists `dm` as a draft for one-to-one or small-group conversation. Guild party chat
does **not** use that role: it is a local `group-chat` proposal. The group is
selected inside the tool from host-authorized Marmot groups. Large community
broadcasts are outside this napplet's role.

Other guild roles below are unregistered proposals. Before shipping, recheck the
registry for a compatible role and seek upstream review where needed. Do not
advertise them as approved NAAT standards. A non-role-invokable napplet remains
possible until a compatible role contract is available; do not claim discovery works.

Inspected local sources:

- `G:/Github/palace-napplets/napplets/feed/src/main.ts`: documents the intended
  single-role boundary and profile handoff. That feed currently has no archetype
  tag in its Vite config; its comment is not proof of working role dispatch.
- `G:/Github/palace-napplets/napplets/feed/node_modules/@napplet/sdk/package.json`:
  SDK **0.24.4**, depending on core/nap **0.28.0**.
- `G:/Github/palace-napplets/node_modules/.pnpm/@napplet+nap@0.28.0/node_modules/@napplet/nap/dist/intent/types.d.ts`:
  installed request/candidate fields are **protocol/protocols**.
- [Current NAP-INTENT](https://github.com/napplet/naps/blob/master/naps/NAP-INTENT.md):
  request/candidate fields are **convention/conventions**. It is a draft.

**Compatibility gate:** the installed SDK does not match the current contract.
Pin matching host, SDK, manifest plugin, and conformance tooling before implementation.
Do not cast types away, pass new fields through an old shim, or rename fields
without testing discovery, delivery, and manifest parsing together. No runtime
package in the separate Palace repository has been upgraded here. The new Raffle
workspace independently pins `@napplet/sdk 0.28.0` (core/nap 0.32.0) and
`@napplet/vite-plugin 0.14.1`, whose types use `convention/conventions`.
Its builds and host-domain fixtures pass; full production-host compatibility is
still unverified. General guild contract examples below remain design data.

## Roles and accepted open contracts

All proposed conventions end in `open-v1`. The action is `open`:
opening a review or claim tool must not perform its privileged operation.

| Napplet | Archetype | Required context beyond base | Optional context |
|---|---|---|---|
| Roster | `member-directory` | — | `memberId` |
| Admissions | `membership-review` | — | `caseId`, `memberId` |
| Duties | `role-manager` | — | — |
| Local chapters | `chapter-directory` | — | — |
| Calendar | `calendar` | — | — |
| Operations | `operation-board` | — | — |
| Party chat | `group-chat` | — | — |
| Group create | `group-create` | — | — |
| Group invitations | `group-manager` | — | — |
| Group join | `group-join` | — | — |
| Group removal | `group-removal` | — | — |
| Group roles | `group-role-manager` | — | — |
| Guild bank | `treasury-view` | — | — |
| Welcome claim | `entitlement-claim` | `memberId`, `entitlementId` | — |
| Identity review | `identity-review` | `memberId` | `caseId` |
| Key recovery | `key-recovery` | `caseId` | — |
| Pay to Polish | `collectible-catalog` | — | — |
| Mesh status | `network-status` | — | — |
| Raffle organizer | `raffle-manager` | — | `raffleId` |
| Ticket printer | `ticket-printer` | `raffleId` | — |

**Implemented preview exception:** the printer currently advertises
`napplet:ticket-printer/preview-v1`, carrying `{version: 1, config}` rather than a
private raffle ID. This public planning payload is capped at 8 KB, eight tiers,
300 tickets, and whole sat amounts. Its validator is `napplets/src/plan.ts`.
It rejects unknown fields (including note URLs/seeds), duplicate IDs, unsupported
versions, and oversized counts before expansion. It contains no member identity
or spendable material. The private `open-v1` printer contract above remains a design
and is not advertised in the built manifest. Standalone pages hand off this
non-secret configuration in a URL fragment; the receiver validates and clears it.
Embedded napplets use NAP-INTENT and subscribe to the matching INC delivery topic.

The catalog is the machine-readable definition of this table and each tool's
outbound intents. A future change updates both in one review.

The eleven workspace builds deliberately use only `{version: 1, guildId: "600b"}`.
Select a member, group or task inside its own tool; these references are submitted
to the scoped host service after explicit interaction. They are not accepted as
extra navigation fields. The catalog's general outbound intent graph remains a
design unless `implementation.dispatches` explicitly lists a built handoff.

## Payload v1

Our proposed common base is `{ "version": 1, "guildId": "600b" }`.
Only the base and the row's required/optional fields are accepted. IDs are opaque,
nonempty strings of at most 128 characters; the whole JSON payload is at most
2,048 UTF-8 bytes. Reject arrays, null, unknown fields, unsupported versions,
wrong field types, and over-limit payloads before lookup. An ID is not authority.

`groupRef` is an opaque, caller-scoped host reference, not MLS key material or a
public group identifier. The host resolves it only for an authorized recipient.
Resolve member/entitlement/case/event relationships server-side in the requested
guild. Never accept a caller-supplied rank, payout amount, approval, or signature
as a trusted consequence of navigation. Even the rightful user can choose an
untrusted handler; grant that handler only explicitly approved capabilities/data.

Illustrative current-spec dispatch request (not executable with the installed SDK):

```json
{
  "archetype": "entitlement-claim",
  "action": "open",
  "convention": "napplet:entitlement-claim/open-v1",
  "payload": {
    "version": 1,
    "guildId": "600b",
    "memberId": "example-member",
    "entitlementId": "example-welcome"
  }
}
```

Proposed manifest tag after role review and compatible tooling:

```json
["archetype", "entitlement-claim", "napplet:entitlement-claim/open-v1"]
```

The [convention rules](https://github.com/napplet/naps/blob/master/README.md)
use queryless identities in metadata. This guild design always supplies structured
payload separately and forbids query/fragment-bearing catalog conventions. No
identity, claim, or recovery data belongs in navigation URL parameters.

## Dispatch and lifecycle

With a matching implementation of [NAP-INTENT](https://github.com/napplet/naps/blob/master/naps/NAP-INTENT.md),
check capability and advertised action/convention before dispatch. Let the host
respect the user's default or chooser. Never hard-code a sibling instance/dTag.
Handle missing handler, unsupported contract, cancellation, and dispatch failure
locally, with an explicit unavailable state. Recheck after availability changes.
Cold and already-open handlers must both validate the delivered payload.

An intent result describes dispatch, not a completed admission, payment, or
recovery. Render only durable workflow status read from the authorized service.
If status is unknown after interruption, reconcile by operation ID before retrying
a mutation. Navigation can be retried; a financial action cannot be blindly repeated.

Proposed composition examples:

- Roster → Identity review → Key recovery, only when a case is available.
- Admissions → Group invitations and Welcome claim, with server-verified context.
- Local chapters → Calendar → Operations. Party chat is a local `group-chat` role, not a `dm` handoff.
- Guild bank → Welcome claim for the current user's eligible entitlement.
- Raffle organizer → Ticket printer with a host-authorized raffle ID, never bearer secrets.

An outgoing catalog entry permits offering navigation, not automatic invocation.
Obtain missing context from an authorized host service or user selection; do not
invent a group, entitlement, or recovery case ID just to satisfy the schema.

[NAP-INC](https://github.com/napplet/naps/blob/master/naps/NAP-INC.md) is a separate
communication surface. Do not broadcast sensitive context as a substitute for
targeted intent delivery. Our design uses no public INC topic for payment or
recovery completion. Any future notification convention needs its own recipient,
payload, authorization, delivery/replay, and teardown contract. Unsubscribe on unmount.

## Definition of done per napplet

Document purpose, IS/IS NOT boundary, archetype status/source, accepted conventions,
outgoing intents, payload schema, capabilities, fallback, and state owner. Add an
example, rejection cases, cancellation behavior, and independent mount verification.
Run actual host conformance for discovery, default replacement, cold/warm delivery,
missing capabilities, malformed payloads, scope mismatch, and denied access.
For mutations additionally prove idempotency and that an `open` intent cannot
execute the action. Design-catalog checks alone do not establish interoperability.
