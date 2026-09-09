# flx@600.wtf: LNURL discovery outage

Observed overnight 9–10 September 2026. This PR adds diagnosis and a read-only
healthcheck. It does **not** change the recipient, restore an old callback, or
claim that the production outage is repaired.

## Evidence

| Request | Result |
|---|---|
| `https://600.wtf/` | 200, HTML |
| `https://600.wtf/.well-known/nostr.json` | 200, JSON |
| `https://600.wtf/.well-known/lnurlp/flx` | 502, nginx HTML error |
| `https://600.wtf/.well-known/lnurlp/dni` | 502, nginx HTML error |
| Former `https://lnbits.b1tco1n.org/` | TLS certificate hostname mismatch |
| Former LNbits pay-link discovery for FLX | Same TLS failure |

The failure is in the Lightning discovery path, not in NIP-05 identity or the
static homepage. Multiple users are affected. A gateway/upstream problem is
indicated; the exact failing upstream cannot be confirmed without the deployed
reverse-proxy configuration and logs.

Commit `ec102b08c5e12013c551b7018965f2d544674070` removed the static LNURL files on
27 March 2026 with the message “remove lnurlp addresses and forward to lnbits
instance”. The repository Dockerfile adds JSON/CORS headers but contains no
`proxy_pass`. The intended production forwarding configuration lives elsewhere.
The old FLX callback pointed at `lnbits.b1tco1n.org`; that history is not proof
that the current production proxy still targets it or that its pay-link is valid.

## Reproduce without creating an invoice

Requires Node.js 20+:

```sh
node scripts/check-lightning-address.mjs flx@600.wtf
node scripts/check-lightning-address.mjs dni@600.wtf
node --test scripts/check-lightning-address.test.mjs
```

The checker makes only the discovery GET. It reports HTTP, transport, JSON,
amount, metadata, and callback-shape failures. It never calls the callback,
generates an invoice, or pays. TLS verification stays enabled; redirects are
reported for inspection rather than silently followed. Exit 0 means discovery
passed, 1 means discovery failed, and 2 means invalid input/unexpected local error.

Based on [LUD-16](https://github.com/lnurl/luds/blob/luds/16.md) and
[LUD-06](https://github.com/lnurl/luds/blob/luds/06.md). Discovery success alone
does not verify invoice validity, ownership of the destination, or payment routing.

## Required operational repair

1. Confirm the current LNbits origin and the deployed `/.well-known/lnurlp/`
   reverse-proxy location. Read its error log for refused connections, wrong
   scheme/port, DNS failure, or TLS/SNI mismatch.
2. Verify that origin independently with normal certificate validation. If the
   intended hostname has the wrong certificate, correct certificate/virtual-host
   selection and SNI. Do not disable TLS verification to hide the failure.
3. Confirm the FLX recipient/pay-link on the intended LNbits instance. Do not
   route donations to an arbitrary replacement wallet or restore an obsolete
   callback merely to return HTTP 200.
4. Change the actual proxy configuration, validate it, and reload through the
   normal deployment workflow. Keep the last known configuration for rollback.
5. Re-run discovery for FLX and a second address, plus homepage/NIP-05 checks.
   An authorized operator can separately verify a small invoice/payment.

**Pending:** current LNbits origin and production proxy configuration. Neither
is supplied by this repository, so the route fix is not fabricated in this PR.
