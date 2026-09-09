# Pebbles welcome page

`/pebbles.html` is the 600.wtf Nostr community welcome page. The original crew are
**The Stoned**; the online community are **The Pebbles**. Pebble membership does not
include the private Signal group or other internal access. The intended welcome is
**21 whole tokens of the existing 600 Liquid asset, once per eligible member**.

## Current behavior

This repository serves static HTML through its existing hosting. The page uses the
existing local fonts and sacred stone image, with no new runtime dependencies.
Links from the home page and Liquid page lead to the welcome desk.

The connect button asks a NIP-07 signer for its public key. The page displays that
key only in the current tab and can clear it on disconnect. It does not sign or
publish events, contact relays, persist identity, register a member, or transfer
tokens. A public-key response alone is not server authentication.

Claims remain disabled and visibly marked as unavailable. No balances, deposit
addresses, membership confirmations, or successful payouts are fabricated.

## Required before opening claims

- A dedicated crew-funded Liquid wallet, its verified deposit address, and an
  operator-controlled payout service. Signing keys stay on the server.
- A definition of eligible membership. A new Nostr key does not prove a new person;
  a trusted invitation or reviewed membership record must enforce that boundary.
- Server-issued, expiring, single-use challenges binding the action, member,
  Liquid address, and site origin. Verify Nostr signatures server-side before
  accepting a claim; do not authenticate from `getPublicKey()` alone.
- SQLite records of membership and claim decisions before payout, with timestamps
  and reasons. Enforce a unique claim per member atomically, including concurrent
  requests. Keep operational databases outside the public static directory.
- Durable payout idempotency and transaction reconciliation. A lost response or
  worker restart must never cause an automatic second payment. Validate the
  intended Liquid network, destination, asset, amount, fee funding, and balance.
- A verified community destination if a dedicated Nostr community link is wanted.

The frontend must be connected to that service before enabling a claim button.
Disconnecting the page clears its display; revoking signer permissions is done in
the signer. It cannot reset eligibility or a claimed welcome.

## Local verification

Run the existing static server at `http://127.0.0.1:4173`, then:

```sh
npm run test:e2e -- tests/pebbles.spec.ts
```

Tests cover asset loading, the closed faucet, unavailable/rejected/malformed
signers, connection privacy, pending requests, keyboard interaction, mobile
layouts, and JavaScript-disabled behavior. New page code is MIT licensed.
