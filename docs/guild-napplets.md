# Composable guild napplets

User requirement, 9 September 2026: **one function per napplet**. The guild portal
composes independent napplets; it does not become a single guild application.
`data/guild-napplets.json` is a design catalog, not an installable Nappelin manifest.
Its host-service labels describe responsibilities, not invented SDK methods.
The welcome and Elders pages remain static previews. Raffle organizer and Ticket
printer now have independent single-file builds and generated archetype metadata
in `napplets/dist/`. They implement planning and non-spendable print previews.

Every catalog entry now declares its archetype status, accepted intent convention,
versioned input fields, and outbound role-based intents. See
[Intents and archetypes](guild-intents.md) for the wire examples, boundary rules,
fallback behavior, source evidence, and SDK compatibility gap.

## Independent tools

| Napplet | Function | Input context | Result |
|---|---|---|---|
| Roster | Browse members | Guild and permitted filters | Selected stable member ID |
| Admissions | Request/review admission | Guild and membership case | Admission case status |
| Duties | Assign authorized roles | Guild and member | Audited role decision |
| Local chapters | Discover chapters | Public filters or opt-in location | Selected chapter ID |
| Calendar | Arrange meetups | Guild/chapter and event | Event or attendance status |
| Operations | Coordinate activities | Guild and operation | Operation status |
| Party chat | Use Marmot messaging | Host-authorized group reference | Message delivery status |
| Group invitations | Invite group clients | Authorized group and member | Confirmed invitation receipt |
| Group join | Accept an invitation | Own member and authorized group | Confirmed join receipt |
| Group removal | Remove group clients | Authorized group and member | Confirmed removal receipt |
| Group roles | Assign group duties | Authorized group, member and role | Confirmed role receipt |
| Guild bank | Inspect treasury | Permitted ledger scope | Read-only ledger projection |
| Welcome claim | Claim once | Stable member and entitlement | Pending/settled claim status |
| Identity review | Check key/NIP-05 evidence | Member and review case | Reviewed identity status |
| Key recovery | Process guardian review | Recovery case | Recovery status |
| Pay to Polish | Buy cosmetics | Catalog and selected item | Purchase status |
| Mesh status | Inspect FIPS connectivity | Host network status | Reachability projection |
| Raffle organizer | Configure a funded LNURLcash raffle | Guild and optional raffle ID | Ticket-run status |
| Ticket printer | Preview/export raffle tickets | Guild and raffle ID | Authorized export status |

Rai and elder claims use the same claim napplet with different server-verified
entitlements. Do not copy the claim engine or build a second claim counter.
Elder restrictions cannot be supplied as trusted props from another napplet.

Raffle management and ticket printing reuse the design of
[dni's LNURLcash raffle](raffle-integration.md). Their sat funding is separate
from the Liquid welcome. The catalog now describes 19 independent tools.

## Composition contract

- Each napplet has one independently versioned entrypoint, a minimal declared
  capability set, and small/full container layouts. Map the catalog into the
  actual host's manifest format after reading its current SDK types.
- The shell owns layout, routing, capability consent, and context handoff. It can
  compose tools side by side or replace a compatible tool without changing others.
- No napplet imports another napplet's implementation, accesses another iframe's
  DOM/storage, or reads a shared mutable global object. Shared UI/data types can
  be small FOSS packages; runtime coordination goes through the host contract.
- Use versioned, schema-validated input/output contexts with stable IDs and minimal
  fields. The host checks caller, destination, scope, and permissions on every
  handoff. Client context is a request, never proof of authority.
- Member-selected navigation may pass a stable member ID to Identity review.
  Completed review may refresh Admissions. A reviewed admission can offer opening
  Group invitations or Welcome claim. These tools recheck their own authorization;
  a notification cannot itself invite, sign, buy, or transfer funds.
- Commands need request IDs and durable idempotency for mutations. Notifications
  can prompt a fresh authorized read; they must not carry reusable wallet authority,
  MLS secrets, recovery evidence, or a full private member roster.
- Required capabilities missing: show an unavailable state. Optional capabilities
  missing: use the documented fallback. The rest of the composition keeps working.

## One host boundary

NIP-07 signing, wallet operations, Marmot client state, MLS secrets, networking,
and protected storage stay host-side or in the appropriate authorized backend.
The host brokers each narrowly scoped operation. Napplets run with `allow-scripts`
and without `allow-same-origin`. They do not open raw relay/socket escape hatches.
Direct NIP-07 access in today's standalone preview is not the embedded contract.

Marmot is the only private group protocol. FIPS provides the network path; the
Mesh status napplet only displays status and cannot install a daemon or mutate
host routes. The guild ledger owns membership/claims/recovery, while the Marmot
client owns cryptographic group state. These remain separate authorities.

Composition does not put identity or treasury data onto the game's realtime
presence transport. A display handle never authorizes a wallet transfer.

## Implementation acceptance

Use the actual Nappelin SDK and manifests before claiming a runnable napplet.
Prove each tool mounts alone, survives a sibling unmount/crash, and fits a small
container. Verify two copies cannot duplicate a claim or purchase. Reject wrong
schema versions, unsolicited/cross-scope handoffs, and unauthorized role changes.
Verify a missing Marmot/FIPS capability leaves unrelated tools usable and never
downgrades private messages to public transport. Test compatibility when swapping
one tool while keeping the rest of the portal unchanged.

The public member directory now has its own snapshot build (see [contract](member-directory.md)).
Key recovery also has a host-backed build and a local SQLite service; see [Recovery implementation](recovery-implementation.md).
Eleven further tools now have independent builds and a local SQLite workspace;
see [workspace guide and host contracts](guild-workspace.md). Admissions, live chat,
welcome claims and identity review remain designs. The two Raffle bundles use the pinned SDK and
are tested with host-domain fixtures; full installed-host conformance and operational
backend endpoints are not yet provided. See [Raffle integration](raffle-integration.md).
