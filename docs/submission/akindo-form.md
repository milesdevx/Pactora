# AKINDO Form: Draft, Not Ready to Submit

Prepared **2026-11-08**. Replace pending deployment/material fields with independently verified evidence before submitting. Do not describe V2 as live yet.

## Form Fields

| Field | Draft value |
| --- | --- |
| Project name | Pactora |
| Tagline | MUSD milestone payments, coordinated through Telegram |
| Track | **Track 2: Access and Distribution** |
| Chain | **Mezo Testnet, chain ID 31611** |
| Project status | New project built during the buildathon; first repository commit is 2026-10-19, during the announced October 16-26 Wave 1 build period |
| Readiness | **Testnet: existing V1 demo live; locally tested V2 not deployed or release-verified** |
| Live link | https://pactora-tan.vercel.app (currently V1) |
| Public repository | https://github.com/milesdevx/Pactora |
| Telegram bot | https://t.me/PactoraAlertsBot |
| Current legacy escrow | `0x1Da50726E11bf828358f6b840900c0a731B2b40F` |
| Submission V2 escrow | **Pending owner redeploy; do not substitute V1** |
| V2 deployment transaction | **Not available** |
| Canonical MUSD | `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` |
| Project deck link | **Not available**; `deck-outline.md` is an outline, not a published deck |
| Two-minute pitch video link | **Not available**; `pitch-script-2min.md` is a script, not a recorded video |
| Wave 2 eligibility/prior submission | **Owner confirmation required**; no qualifying Wave 1 submission has been independently verified |

## TL;DR: Three Sentences

Pactora is milestone-based MUSD escrow on Mezo Testnet for freelancers, clients, and small agencies. Its locally tested V2 pairs wallet-owned agreements with Telegram balance, agreement, pending-action, and test-funds guidance, using Mezo's real RPC, MUSD token, faucet, and swap/borrowing app. The existing V1 demo is live, but V2 redeployment, real new-command replies, and the full two-wallet payment demonstration are still pending.

## How It Works

This is the implemented V2 workflow, not a claim that the current live V1 has been upgraded.

1. The client specifies a provider, MUSD milestone amounts, and delivery deadlines. The app commits human-readable terms with keccak256 and reads the real agreement ID from a successful creation receipt.
2. The provider reviews and accepts the agreement on-chain. The client grants the exact MUSD allowance and deposits the agreement total; gas is paid in test BTC.
3. The provider submits a hash of actual deliverable notes or a URL. The server stores the text only after verifying the successful receipt, event author, and content hash.
4. Client approval releases that milestone's MUSD to the provider. Submitted work can also be claimed after its seven-day review window; expired unsubmitted work can be refunded under agreed delivery/revision rules.
5. A mutually accepted, proposal-hash-bound split can settle remaining escrow without pretending to arbitrate deliverable quality. Public receipts expose real chain state, token contract, and available confirmed transaction links.
6. A signed-wallet session issues a one-time hashed Telegram link. The new bot commands read MUSD/BTC balances and on-chain agreement state, show review/delivery actions, and guide users to Mezo test funds. Writes still require the wallet, not the bot.

## Target Users

- Freelancers and their clients who need staged MUSD payments rather than an all-upfront transfer.
- Small agencies coordinating several deliverables and wanting wallet-owned payment records.
- Telegram-first participants in the Bitcoin/Mezo ecosystem who need clearer balances, next actions, and test-funding guidance.

These are target users, not claims of existing customers, revenue, pilots, or traction.

## Stack and Mezo Fit

Next.js 15, React 19, TypeScript, Wagmi/Viem, PostgreSQL/Drizzle, Telegram Bot API, Solidity, Foundry, and OpenZeppelin `ReentrancyGuard`/`SafeERC20`.

MUSD is the actual escrow deposit and payout asset; BTC is the actual Mezo gas currency. `/getmusd` connects users to the existing Mezo testnet faucet and swap/borrowing app rather than inventing a new liquidity source. Telegram reduces discovery and coordination friction without asking the bot to hold keys. This extends MUSD's payment use case; it is not a fake Passport, yield, or borrowing integration.

MEZO funding UI, a complete event indexer, and automatic notification retry are roadmap items. The locally implemented V2 deployment script enforces an MUSD allowlist; V2 deployment is pending, and no MEZO integration is claimed.

## Security and Honest Limits

V2 has locally tested exact-transfer accounting, bound resolution consent, atomic expiring nonce/link consumption, wallet sessions, persistent rate limiting, and confirmed-receipt notification checks. It is unaudited and testnet-only. Authentication is SIWE-style, not EIP-4361 compliant; no subjective dispute arbitration is provided.

Local evidence from 2026-11-07: 125 web/unit tests, 71 Foundry tests, two browser smoke tests, and a 49-file client-secret scan passed. Unit fixtures are labelled Illustration; none are proof of real Telegram delivery or a live payout. See `../security.md` and `../deployments.md` for scope and gaps.

## Three Future Milestones: Planned, Not Achieved

1. **Before November 13 at 05:30 UTC, conditional on owner redeployment by November 10:** finish the production schema/environment upgrade, source verification attempt, real two-wallet MUSD flow, private-chat command checks, and final deck/video; publish a reproducible evidence record. If blocked, do not claim these delivered.
2. **Within four weeks:** ship a resumable confirmed-event indexer and outbox retry, with scoped agreement discovery beyond the current first-50/registered-metadata limit; add MEZO support only after official-address, allowlist, decimals and real testnet transfer checks.
3. **Within six weeks:** complete an independent security review and recruit a target of five consenting pilot teams for ten real testnet agreements, recording usability failures and addressing them before considering any future network expansion. These numbers are targets, not current metrics.

## Submission Gate

- [ ] Verify V2 address, successful deployment hash, source/code identity, and chain 31611.
- [ ] Upgrade production schema/config/app and reverify the webhook.
- [ ] Receive actual `/start`, `/help`, `/balance`, `/agreements`, `/pending`, `/getmusd` replies; confirm signed link/unlink.
- [ ] Complete the real two-wallet MUSD flow and public receipt, with actual transaction hashes.
- [ ] Verify live client bundle/logs and publish the intended source commits; remote code is currently behind local fixes.
- [ ] Complete GitHub About metadata: description "MUSD milestone escrow on Mezo Testnet with Telegram coordination", website `https://pactora-tan.vercel.app`, topics `mezo`, `musd`, `escrow`, `telegram-bot`, `nextjs`, `foundry`. The public About box was empty in the November 8 check.
- [ ] Export/publish the deck and record/publish the two-minute video. An outline and script do not satisfy those materials.
- [ ] Confirm Wave 2 eligibility and the final AKINDO cutoff with organizers.

## Deadline Sources

Checked 2026-11-08: [AKINDO live wave data](https://api.akindo.io/public/wave-hacks/OVOO0gdrVU8379D10/waves) reports **2026-11-13 05:30:06 UTC** for Wave 2. [Mezo's written announcement](https://mezo.org/blog/mezo-buildathon-is-underway/) says **November 15, 2026**. Use the earlier platform cutoff unless corrected; winner announcement is **November 23, 2026**.

Official event: https://app.akindo.io/wave-hacks/OVOO0gdrVU8379D10/
