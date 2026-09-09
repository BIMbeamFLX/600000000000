# Raffle reuse: dni's LNURLcash tools

Source: [lnurlcash/raffle](https://github.com/lnurlcash/raffle), inspected at
[`2221e60`](https://github.com/lnurlcash/raffle/tree/2221e60c2188be1616e4e01e4486d2bb3d8a94b5)
on 9 September 2026. `package.json` names **dni** as author and declares MIT.
The immutable `napplets/vendor/lnurlcash-raffle/` snapshot now contains the planning,
PDF, CSV, and related type/test files. Upstream author/license metadata accompanies
it. No bearer note was submitted or split. Preserve attribution on updates.

## What already exists

The upstream app divides a funded LNURLcash bearer note into ticket notes. It has
configurable prize tiers, ticket-price calculations, PDF previews, printable QR
tickets, organizer CSV exports, and recovery of interrupted runs. Its client stack
is SolidJS/TypeScript with `lnurlcash-kit`, `pdf-lib`, and `qrcode`.
[README](https://github.com/lnurlcash/raffle/blob/2221e60c2188be1616e4e01e4486d2bb3d8a94b5/README.md)

This makes it a reuse candidate for funded IRL giveaways and community tombolas.
It handles LNURLcash sats, not the Liquid `600` asset. Keep funding and accounting
separate from the 1,827-token elder allocation. A ticket is not guild membership,
an elder promotion, or a new welcome entitlement. Paid random-prize events require
a separate product decision; the approved cosmetic-rank plan does not enable them.

## Two composable functions

| Napplet | Proposed archetype / convention | Boundary |
|---|---|---|
| Raffle organizer | `raffle-manager` / `napplet:raffle-manager/open-v1` | Configure and follow a funded ticket run |
| Ticket printer | `ticket-printer` / `napplet:ticket-printer/open-v1` | Preview and export the authorized ticket sheet |

The organizer opens the printer by role with `{version: 1, guildId, raffleId}`.
No note URL, seed, `k1`, balance, or spending credential crosses that intent.
The printer requests export through a separately authorized host capability.
Opening either tool has no monetary side effect. Both roles are local proposals.

## Adaptation boundaries

Use upstream `src/lib/lottery.ts` as the planning reference and `pdf.ts`/`csv.ts`
as export references. Keep their tests when code is adapted. The PDF preview uses
obvious placeholder tickets; retain that distinction from redeemable output.

The money-moving `run.ts`, seed handling, and persistence belong behind the host
service boundary. Upstream stores a run, including bearer material, in one browser
localStorage slot. That is not our composable host storage model: multiple mounted
napplets require per-run state and single-writer coordination. Persist decisions
in SQLite before mutation, keep secrets in protected host storage, and reconcile
ambiguous mint responses without blindly repeating a split. Inspect the full
upstream recovery implementation before adapting; selected source inspection is
not a security audit or proof of compatibility.

Real PDF/CSV output contains spendable bearer material. Generate and deliver that
artifact through the approved host export flow; the printer napplet receives a
scoped artifact reference/status, not raw funding secrets. Never attach real
tickets, note URLs, or CSV manifests to GitHub screenshots or public documentation.
The public ledger contains redacted amounts/status, not redeemable notes.

Before implementation, verify protocol/library compatibility, explicit organizer
authorization, integer amounts and bounds, mint fee accounting, exclusive run
ownership, persistence failures, ambiguous outcomes, restart recovery, and export
permission. Run upstream unit tests plus host integration tests with test notes
and an isolated test mint. Do not equate shuffled prize allocation with a publicly
verifiable draw or promise trustless fairness without an additional protocol.

## Implemented preview

- `napplets/dist/raffle/index.html`: editable prize tiers, upstream presets, sat
  totals, optional hypothetical ticket-price calculation, and JSON plan export.
- `napplets/dist/ticket-printer/index.html`: independent plan import, ticket layout,
  and genuine PDF download using upstream `generateLotteryPdf` in preview mode.
- Embedded handoff uses `napplet:ticket-printer/preview-v1` through the SDK. This
  convention carries only a strictly validated non-secret configuration. No group
  membership or wallet authority is included. Generated manifests advertise the
  implemented contracts; the general private run-ID/export workflow remains planned.
- A standalone browser can download preview PDFs. Embedded PDF/file export remains
  disabled until an approved host export capability is connected. No direct wallet,
  mint, or localStorage access is used by these new runtime entrypoints.

Build with `npm --prefix napplets ci --ignore-scripts` and
`npm --prefix napplets run build`. Run `npm --prefix napplets test` and
`npm --prefix napplets run typecheck`. Browser tests are in `tests/raffle.spec.ts`.
The SDK is pinned to 0.28.0 and the manifest plugin to 0.14.1. Tests use host-domain
fixtures; they do not prove compatibility with an installed production shell.

Real issuance, bearer-note recovery, live sales, CSV exports containing real notes,
and the host wallet/export service remain unconnected. See
[guild intents](guild-intents.md) for the payload rules.
