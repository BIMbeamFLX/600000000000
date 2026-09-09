# 600 Billion: a 21-year community and treasury plan

Planning draft, 9 September 2026. No offer, fixed sale price, launch date, payment,
burn, or wallet reservation is executed by this document. Year 1 means the first
operating year. Member counts are targets, not forecasts.

**Approved by FLX:** 30 current elders receive 21 whole 600 tokens each; the next
570 elders receive 2.1 each. Their combined allocation is **1,827 whole tokens**.
Other allocations, admission targets, sale caps, and burns below are proposals.

## 1. The supply and the unit problem

Asset: `bd1d3b1f10a3e1eb5ac2d332f118005f126f8c37fab490f8c8d84ddbd8c763c7`.

The [Liquid explorer API](https://liquid.network/api/asset/bd1d3b1f10a3e1eb5ac2d332f118005f126f8c37fab490f8c8d84ddbd8c763c7)
and [Blockstream API](https://blockstream.info/liquid/api/asset/bd1d3b1f10a3e1eb5ac2d332f118005f126f8c37fab490f8c8d84ddbd8c763c7)
both reported:

| Field | Observed value |
|---|---:|
| Issued atomic units | 600,000,000,000 |
| Display precision | 8 decimal places |
| Issued whole `600` tokens | **6,000** |
| Reported burns | 0 |
| Blinded issuances | false |
| Issued reissuance-token units | 0 |

The [original issuance](https://liquid.network/tx/9a80f127d0db9a95644a4f76dd1e4f82a0657291440f6098154308c6c68d368e)
also reports `assetamount=600000000000` and `tokenamount=0`. The calculated
`reissuance_token` identifier in metadata does not mean a usable reissuance token
was minted. Reissuance is not a funding option in this plan.

The distinction follows the official [asset precision documentation](https://docs.liquid.net/v1/docs/blockstream-liquid-asset-registry).
Calling 21 atomic units “21 whole tokens” would change the offer by a factor of
100,000,000. Keep both units explicit in all code and copy.

- 600,000 × 21 whole tokens = **12,600,000 tokens**: 2,100 times current issuance.
- 6,000 / 21 supports only **285 complete 21-token welcomes**, with 15 tokens left.
- Even distributing the entire supply equally gives just **0.01 token per member**.
- 600 elders × 21 = 12,600 tokens, also impossible under this supply.

Supply is not treasury ownership. The observed issuance does not establish which
holders will donate, whether keys remain accessible, or how much a faucet controls.
All 6,000-token budget tables are conditional on the holders committing those tokens.

## 2. Reserve the elders before selling anything

| Allocation | Whole 600 | Share of issued supply | Status |
|---|---:|---:|---|
| Original 30 elders: 30 × 21 | 630 | 10.50% | Approved allocation |
| Future 570 elders: 570 × 2.1 | 1,197 | 19.95% | Approved allocation |
| Pebble faucet budget | 2,100 | 35.00% | Proposed ceiling |
| Optional sale inventory | 1,260 | 21.00% | Proposed ceiling |
| General contingency | 813 | 13.55% | Proposed balance |
| **Total** | **6,000** | **100.00%** | |

To back the approved reserve, the holders must actually deposit or otherwise
verifiably commit **1,827 tokens**. A label on a webpage does not lock coins.
Maintain separate custody/accounting for the 630 founding allocation and 1,197
future allocation; neither can subsidize sales or burns. Release only bounded
amounts to the payout wallet, with a separate L-BTC fee budget.

Each membership has a stable record independent of its current Nostr key.
Founder claims are limited to the frozen 30-member snapshot. Future elders are
admitted separately and never inherit founding status. Buying a token grants no
elder status, private Signal access, treasury authority, game progress, or shorter
waiting periods.

## 3. The Austrian-school operating rules

This is an Austrian-inspired operating policy, not a theory that predicts a token
price. [Subjective value](https://mises.org/online-book/introduction-austrian-economics/4-subjective-theory-value)
means people decide whether the community and token matter to them. Reducing
quantity alone does not establish demand or a higher price.

1. **Voluntary participation.** Build useful open-source tools, gatherings, art,
   and a community people choose. No payment for recruitment and no promise that
   later buyers will fund earlier members' returns.
2. **Predictable scarcity.** Publish allocation ceilings and accurate units. Never
   invent extra supply or relabel fractions to hide dilution of a promised amount.
3. **Low time preference.** Budget against resources already available. Preserve
   reserves and fund maintainable work; do not borrow against an assumed token price.
4. **Market discovery.** Optional sales use transparent terms and genuine buyer
   demand. A price nobody pays is not revenue. No guaranteed appreciation, buyback,
   redemption, price floor, or staged automatic price increases.
5. **Economic calculation.** Record token inventory, realized sats, L-BTC fee costs,
   fiat liabilities, and operating expenses separately. Unsold tokens are not cash.
6. **Capital maintenance.** Real productivity and saving sustain the project;
   burning inventory does not itself create capital. This follows Mises's treatment
   of [capital maintenance and saving](https://mises.org/online-book/human-action/chapter-xviii-action-passing-time/7-accumulation-maintenance-and-consumption-capital).

The proposed reserve and reward figures are our design choices, not numbers derived
from Austrian economics. Check operating assumptions annually without retroactively
changing earned claims or spending protected elder allocations.

## 4. Membership and welcome schedule

The target is **600,000 total member records: 600 elders + 599,400 Pebbles**.
The original 30 count toward that total. This does not assume 600,000 active users,
and multiple keys do not prove multiple humans.

| Operating years | Total members at phase end | Elders at phase end | New Pebble slots in phase | Whole 600 per Pebble | Annual optional sale cap |
|---|---:|---:|---:|---:|---:|
| 1–3 | 6,000 | 30 | 5,970 | 0.021 | 0 |
| 4–6 | 18,000 | 60 | 11,970 | 0.0105 | 210 |
| 7–9 | 42,000 | 120 | 23,940 | 0.00525 | 105 |
| 10–12 | 90,000 | 210 | 47,910 | 0.002625 | 52.5 |
| 13–15 | 186,000 | 330 | 95,880 | 0.0013125 | 26.25 |
| 16–18 | 366,000 | 450 | 179,880 | 0.00065625 | 13.125 |
| 19–21 | 600,000 | 600 | 233,850 | 0.00032812 | 6.5625 |

The final rate is rounded **down** from 0.000328125 to the asset's eight decimal
places. Use integer atoms for actual claims. One founder receives 2,100,000,000
atoms; one future elder receives 210,000,000 atoms; the first Pebble rate is
2,100,000 atoms; the final rate is 32,812 atoms.

For a deployable policy, use the **finite membership cohorts** to select the
Pebble rate, not an unlimited promise to everyone joining before a date. The year
labels describe the target growth path. If growth is faster, later claimants enter
later cohorts; if it is slower, unfilled allocations remain in reserve. Pausing
token claims must not block participation on Nostr. The table's time path and
yearly distributions are conditional on meeting the target.

The arithmetic assumes disjoint direct elder/Pebble admissions. If a Pebble later
becomes an elder, credit the already-paid welcome toward the elder's total 2.1
allocation and reclassify that amount between budgets; do not pay a second full
welcome. Such promotions change the annual cash-flow timing and must be reflected
in the ledger before reforecasting. Existing founders never claim an additional
Pebble welcome.

## 5. Sell for sats only when a working community exists

**Proposed earliest window: operating year 4.** That date is an eligibility gate
for consideration, not a launch promise. Also require a funded elder reserve,
working claims reconciliation, a costed operating budget, an identity-review
process, real voluntary demand, and completion of the relevant legal assessment.

Publish a maximum quantity for each sale window, fee/refund terms, and realized
results. Sell at independently accepted prices. Keep unsold tokens in the treasury;
do not carry unused quotas into a surprise later sale. Reassess costs and demand
instead of forcing the entire quantity onto a thin market.

Maximum sales under this schedule total **1,240.3125 whole 600** over years 4–21.
That leaves **19.6875** of the proposed 1,260-token sale reserve unsold even if
every scheduled sale reaches its cap.

Revenue is `actual tokens sold × actual weighted-average sats per token`.
These are sensitivities, not market quotes or suggested prices:

| Average accepted price | Gross sats if every cap sells | BTC equivalent |
|---|---:|---:|
| 10,000 sats / whole 600 | 12,403,125 | 0.12403125 |
| 100,000 sats / whole 600 | 124,031,250 | 1.24031250 |
| No buyers | 0 | 0 |

The fee test matters more than the headline price. At an **assumed**, not observed,
average 100 sats per funded member payout, 600,000 payouts cost **60,000,000 sats
(0.6 BTC)** before hosting, support, sales settlement, tax, or other expenses.
Measure actual batched payouts and operating costs before opening a large cohort.
No revenue case above is a profitability forecast. Sats donations or genuine
operating revenue may be needed even when token sales occur.

Keep reserves in custody arrangements the operators can maintain. Distinguish BTC,
L-BTC, and the 600 asset in accounts; the 600 token is not a redeemable claim on
Bitcoin. Maintain a proposed 21-month operating runway based on actual expenses,
including fiat-denominated obligations and downside conversion assumptions.

Before an Austrian/EU public sale, obtain an assessment of token classification,
offer terms, marketing, and any applicable white-paper obligations. Calling it a
gag or taking sats does not itself establish an exemption. The [FMA's guidance](https://www.fma.gv.at/en/cross-sectoral-topics/markets-in-crypto-assets-regulation-micar/issuance-of-crypto-assets-other-than-arts-or-emts/)
also cautions that some nominally free distributions are not treated as free when
personal data is provided in exchange. No legal classification is assumed here.

## 6. What actually decreases?

`Treasury end = treasury start + donations − welcomes − sales − treasury burns`.

`Outstanding asset supply = issued amount − verified burns` in this no-reissuance model.

- Giving or selling a token transfers it. It decreases treasury inventory and can
  increase publicly held inventory; it does **not** decrease total supply.
- Locking tokens can restrict availability while the lock lasts. It is not a burn.
- A provably unspendable burn retires tokens. Voluntary holders are not forced to
  burn. A lost key is not a verifiable burn policy.

**Base recommendation:** no mandatory burns. Complete the community and reserve
funding first. After 21 years, maximum scheduled grants and sales leave:

| Result | Whole 600 |
|---|---:|
| Paid to 600 elders | 1,827 |
| Paid to 599,400 Pebbles | 823.123362 |
| Maximum optional sales | 1,240.3125 |
| Treasury remaining | **2,109.564138** |
| Outstanding supply | **6,000** |

If the group explicitly chooses a modest true-supply reduction, an **optional**
policy of 10 treasury tokens burned per year retires 210 over 21 years. Carve this
out of the 813-token general reserve, leaving 603 there. This produces:

| End of year | Total supply with optional burn |
|---|---:|
| 3 | 5,970 |
| 6 | 5,940 |
| 9 | 5,910 |
| 12 | 5,880 |
| 15 | 5,850 |
| 18 | 5,820 |
| 21 | **5,790** |

That is a **3.5% supply reduction**. Treasury remaining after maximum grants,
maximum sales, and these burns is **1,899.564138**. Protected elder allocations
remain unchanged. Burns require separately authorized, funded transactions and
published proofs; they are not enabled by these calculations and imply no price gain.

## 7. Execution over 21 years

- **Years 1–3:** fund the founding allocations, verify all 30 existing keys, ship
  the identity-check napplet and recovery service, test signed single-use claims,
  and grow through invitations and actual participation. No sale funding assumed.
- **Years 4–6:** consider capped sales only after the gates above pass. Admit future
  elders for contribution and responsibility, not their purchases. Publish accounts.
- **Years 7–12:** halve the proposed sale caps and Pebble rates by phase. Fund
  maintained open-source tools and real community activities from realized resources.
- **Years 13–18:** make stewardship transferable through documented succession,
  guardian rotation, independently checked accounts, and declining hot-wallet exposure.
- **Years 19–21:** reach the target only if demand and operating capacity justify
  it. Reconcile all 600 elder slots and 599,400 Pebble slots. Keep the residual
  treasury; there is no final-year liquidation or guaranteed member cash-out.

Missed targets do not trigger extra minting, accelerated rewards, forced sales,
or borrowing. Reduce operating scope to the funded budget. Keep the community open.

## 8. Annual maximum-distribution calculation

All amounts below are whole 600 tokens. Assumes the target admission path, every
sale cap filled, no burns, no additional donations, no treasury-token operating
spend, and the full issued supply committed to the model. This is an inventory
schedule, not observed custody or a financial return forecast.

| Year | Total members | Elders | Elder grants | Pebble grants | Sale cap | Treasury left |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 2,000 | 30 | 630 | 41.37 | 0 | 5,328.63 |
| 2 | 4,000 | 30 | 0 | 42 | 0 | 5,286.63 |
| 3 | 6,000 | 30 | 0 | 42 | 0 | 5,244.63 |
| 4 | 10,000 | 40 | 21 | 41.895 | 210 | 4,971.735 |
| 5 | 14,000 | 50 | 21 | 41.895 | 210 | 4,698.84 |
| 6 | 18,000 | 60 | 21 | 41.895 | 210 | 4,425.945 |
| 7 | 26,000 | 80 | 42 | 41.895 | 105 | 4,237.05 |
| 8 | 34,000 | 100 | 42 | 41.895 | 105 | 4,048.155 |
| 9 | 42,000 | 120 | 42 | 41.895 | 105 | 3,859.26 |
| 10 | 58,000 | 150 | 63 | 41.92125 | 52.5 | 3,701.83875 |
| 11 | 74,000 | 180 | 63 | 41.92125 | 52.5 | 3,544.4175 |
| 12 | 90,000 | 210 | 63 | 41.92125 | 52.5 | 3,386.99625 |
| 13 | 122,000 | 250 | 84 | 41.9475 | 26.25 | 3,234.79875 |
| 14 | 154,000 | 290 | 84 | 41.9475 | 26.25 | 3,082.60125 |
| 15 | 186,000 | 330 | 84 | 41.9475 | 26.25 | 2,930.40375 |
| 16 | 246,000 | 370 | 84 | 39.34875 | 13.125 | 2,793.93 |
| 17 | 306,000 | 410 | 84 | 39.34875 | 13.125 | 2,657.45625 |
| 18 | 366,000 | 450 | 84 | 39.34875 | 13.125 | 2,520.9825 |
| 19 | 444,000 | 500 | 105 | 25.576954 | 6.5625 | 2,383.843046 |
| 20 | 522,000 | 550 | 105 | 25.576954 | 6.5625 | 2,246.703592 |
| 21 | 600,000 | 600 | 105 | 25.576954 | 6.5625 | 2,109.564138 |

Reproduce with `node scripts/supply-plan.mjs`. Verify conservation, no-sale, and
optional-burn scenarios with `node --test tests/supply-plan.test.mjs`.

Public voice: **“600,000 people. Small stones. Long time preference. Still not a cult.”**
