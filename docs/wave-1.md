# Pactora Wave 1

| Field | Value |
| --- | --- |
| Project | Pactora |
| Track | **Track 2: Access and Distribution**, Mezo Buildathon on AKINDO |
| Chain | Mezo Testnet, `31611` |
| Status | Historical V1 foundation; current public app is V2-configured; full payment demonstration remains pending |
| Last updated | **2026-11-10 UTC** |

**Testnet only. Unaudited. No subjective dispute arbitration.** Track positioning follows the [official Buildathon description](https://mezo.org/blog/mezo-buildathon-is-underway/); this is not a claim of an accepted submission or qualification.

## Problem and Solution

Milestone work leaves a coordination gap between paying a provider upfront and paying only after all work is delivered. Pactora lets the client and provider agree on staged MUSD amounts, explicitly accept terms and fund a contract before delivery. The client can release each milestone after review, with public chain receipts distinguishing an agreement budget from deposited or paid funds. Telegram adds wallet-linked balances, next-action guidance and notifications without holding keys or signing transactions. It does not decide whether disputed work is satisfactory.

## What Exists and Is Verified

The V1 `/help` captures from November 8 are historical, not evidence that today's app still uses V1. Phase 0 found V2's address in current deployed JavaScript and `/api/health`.

| Item | Evidence and current status |
| --- | --- |
| Historical V1 web app | [Capture record](submission/screenshots/capture.json) records HTTP 200 and desktop/mobile V1 help captures on `2026-11-08`; these are not payment captures |
| V1 contract | `0x1Da50726E11bf828358f6b840900c0a731B2b40F`; current runtime and deployment-block inclusion verified; immutable and legacy |
| Current public web app | [Live app](https://pactora-tan.vercel.app) and [help](https://pactora-tan.vercel.app/help) reachable; deployed client and backend configured for V2 |
| Public receipts | [V2 agreement 1](https://pactora-tan.vercel.app/receipts/1) and [legacy V1 receipt 1](https://pactora-tan.vercel.app/receipts/1?escrow=0x1Da50726E11bf828358f6b840900c0a731B2b40F) returned actual chain reads; V2 has successful create/accept receipts but is unfunded |
| Telegram basics | [PactoraAlertsBot](https://t.me/PactoraAlertsBot) identity and production webhook verified through `getMe` / `getWebhookInfo`; zero pending updates and no reported error at the read |
| Actual private-chat replies/linking/alerts | **Not verified. Pending verification:** no private-chat command run, signed link capture or confirmed payment alert was collected |
| Complete deposit/delivery/payout flow | **Not verified. Pending verification:** create/accept alone does not prove funding, submission or release |

Exact deployment and lifecycle hashes are in [deployments](deployments.md#lifecycle-evidence). No user, partner, revenue or traction metric is inferred from a contract counter.

## MUSD Integration

The deposit/payout token is canonical Mezo Testnet MUSD, `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`, with 18 decimals. The official reference, live `decimals()` and V2 `defaultToken()` agree. The [historical V1 source](https://github.com/milesdevx/Pactora/blob/b773f72/contracts/src/PactoraEscrow.sol) and [current source](../contracts/src/PactoraEscrow.sol) both use ERC-20 allowance/transferFrom funding and provider transfers on approval.

The client approves the escrow's token allowance, then deposits with a **separate** `fundAgreement` transaction after provider acceptance. Approval releases that milestone's amount to the provider. BTC is the network's gas currency; the bot does not sponsor gas or custody assets.

Get test BTC from the [Mezo faucet](https://faucet.test.mezo.org/), whose page exposes BTC/MEZO choices, not direct MUSD. The implemented `/getmusd` guide sends users to the [Mezo testnet app](https://testnet.mezo.org) to swap test BTC for MUSD or review BTC-backed borrowing, keeping test BTC for gas. **Pending verification:** no faucet issuance, swap or loan was executed during Phase 0. The testnet app returned HTTP 200 through `curl.exe`, but live wallet funding behavior was not exercised.

## Track 2 Fit

Telegram is an access and coordination layer alongside the web app, not a wallet replacement. These are the commands in the current source; their availability is not proof of live replies.

| Command | Implemented purpose |
| --- | --- |
| `/start` | Welcome/link instructions; `/start link_<token>` consumes the signed-session one-time link |
| `/help` | Commands, test-funds guidance and wallet safety |
| `/balance` | Linked wallet's MUSD and BTC gas balances |
| `/agreements` | On-chain state and next action within the bounded discovery scope |
| `/pending` | Funded work awaiting review or delivery/resubmission |
| `/getmusd` | Faucet and Mezo testnet swap/borrowing links |
| `/notifications` | Toggle verified linked-wallet alerts |
| `/unlink` | Remove the chat/wallet link and unused tokens |

Source: [command handlers](../lib/telegram/webhook.ts). Linking starts at [Telegram settings](https://pactora-tan.vercel.app/settings/telegram): sign a five-minute authentication nonce, request a 15-minute one-time link, then send its Start command in the private bot chat. There is no `/link` command. Money actions stay in the web app and wallet. The bot guides; it does not execute a Mezo loan or hold keys.

## V1 Scope and Known Issues

- V1 has no contract delivery deadlines, provider review-timeout claims or guarded no-show refunds. These are V2 changes, not repairs to V1.
- V1 settlement acceptance is not bound to a reviewed proposal hash; a proposal can be replaced. Its nominal token accounting has no exact-transfer balance checks, and allowlist validation is weaker.
- The older app generated a temporary metadata ID from the clock before receipt confirmation. The current app reads the real `AgreementCreated` ID; old metadata is not proof an agreement exists.
- V1 receipts are retained for historical reads. Do not create new V1 deposits through an assumed upgrade. Current V2 app writes are version-guarded.
- Discovery is not a complete indexer, notification delivery is best-effort, and no subjective arbitration or external audit is verified. See [security](security.md).
- **Pending verification:** V1's fresh deployment receipt, because the required RPC returned `null`; the saved receipt, current code and block inclusion were checked separately.

## How a Judge Can Try It

1. Open [help](https://pactora-tan.vercel.app/help), confirm Mezo Testnet `31611`, canonical MUSD and the [V2 deployment record](deployments.md). Treat the homepage preview as **Illustration, not real funds**.
2. Inspect [V2 receipt 1](https://pactora-tan.vercel.app/receipts/1) and its real create/accept transactions. It is Accepted and unfunded, so it is not a payout demonstration. Use the explicit [V1 receipt link](https://pactora-tan.vercel.app/receipts/1?escrow=0x1Da50726E11bf828358f6b840900c0a731B2b40F) only for legacy history.
3. For a new test, use two separate testnet wallets and obtain test BTC/MUSD through the [faucet](https://faucet.test.mezo.org/) and [testnet app](https://testnet.mezo.org). Never provide wallet secrets to Pactora or Telegram.
4. As client, [create an agreement](https://pactora-tan.vercel.app/agreements/create) with positive amounts and future delivery deadlines. As provider, inspect and accept the actual on-chain ID. Registered terms require wallet sign-in.
5. As client, approve the exact MUSD allowance, wait for its receipt, then fund separately. As provider, submit actual text/URL evidence. As client, review and approve. Record only successful receipts and the actual provider token transfer; these remaining steps are **Pending verification** in this evidence set.
6. Link Telegram through [settings](https://pactora-tan.vercel.app/settings/telegram) and try the real commands above in [the private bot chat](https://t.me/PactoraAlertsBot). Capture actual replies/alerts instead of assuming delivery from webhook registration.
7. Read [Wave 2](wave-2.md) for implemented V2 protections and remaining targets. A local time-warp test is not a live seven-day demonstration.

**Pending verification:** qualifying Wave 1 submission and Wave 2 eligibility were not independently checked. This document describes the build, not an accepted competition result.
