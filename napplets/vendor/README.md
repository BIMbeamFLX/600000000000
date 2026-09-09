# Upstream source snapshot

`lnurlcash-raffle/` contains unchanged source and tests from dni's
[lnurlcash/raffle](https://github.com/lnurlcash/raffle), commit
`2221e60c2188be1616e4e01e4486d2bb3d8a94b5` (9 September 2026).
Paths originate in `src/lib/`. Upstream `package.json` declares author `dni`
and license `MIT`; this snapshot also includes that metadata in `package.upstream.json`.

Keep this snapshot read-only. Adaptations and additional validation belong in
`../src/`. Refresh by pinned revision with attribution and upstream tests retained.
`storage.ts` supplies type definitions to the printer; its browser storage
functions are not used by the new napplets. Money-moving `run.ts` and seed/recovery
code are deliberately not included in the runtime integration.
