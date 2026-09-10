# Member directory napplet

Intent: find a founding member and navigate to their identity review without
granting roles, verifying keys or triggering a claim. One function, one HTML bundle:
`napplets/dist/member-directory/index.html`.

The directory uses the immutable public `data/elders-2026-09-09.json` snapshot.
It displays 30 founders, searchable names/recorded NIP-05 addresses, and a missing-key
filter. All signature reviews remain pending. It is not the live 600,000-member
ledger. Elders require IRL admission; this tool cannot admit anyone.

## Archetype and intents

- Local proposed archetype: `member-directory`.
- Incoming convention: `napplet:member-directory/open-v1`, action `open`.
- Payload: `{ "version": 1, "guildId": "600b", "memberId": "founder-dni" }`.
  Member ID is optional. Other guilds, unknown members, extra fields, wrong versions
  and payloads over 2,048 UTF-8 bytes are rejected without changing the selection.
- Optional outgoing role: `identity-review`, action `open`, convention
  `napplet:identity-review/open-v1`. Payload contains only version, guild ID and
  the selected stable member ID. The host resolves a compatible handler.

The outgoing review is user-triggered and requires a compatible installed handler.
No handler means a visible unavailable message; browsing still works. Selecting a
different member while discovery is pending cancels that navigation. A completed
handoff does not update recorded review status. Incoming contexts are navigation
requests, never membership evidence. The host remains responsible for authenticating
senders and authorizing review operations.

## Boundaries and fallbacks

The bundle performs no NIP-05/relay requests, signing, wallet access or persistence.
It projects public names, IDs, recorded addresses and missing-key flags. No key,
allocation, bearer material or review evidence is sent through intents. Public source
data is already published; this is not a private roster access-control mechanism.
There is no realtime presence transport involved.

Standalone browsing works without a host; the review button explains the missing
host. Embedded operation uses the pinned SDK and `allow-scripts` sandbox without
same-origin access. Each mounted copy keeps its own selection and search state.
The INC subscription closes on page hide. No sibling imports or shared storage.

## Verification and remaining work

Unit tests cover projection, search, missing-key filtering and context rejection.
Browser tests cover standalone/mobile rendering, isolated copies and host intent
handoff/rejection. Fixtures emulate the host bridge; installed-host conformance is
still outstanding. The generated manifest advertises the incoming convention.

Next: an authorized identity-review host service and its own napplet, then ledger
backed admissions/claims. Do not promote snapshot data into verified membership.
