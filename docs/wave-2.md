# Pactora Wave 2

| Field | Value |
| --- | --- |
| Project | Pactora |
| Track | **Track 2: Access and Distribution**, Mezo Buildathon on AKINDO |
| Chain | Mezo Testnet, `31611` |
| Status | V2 contract deployed and live app address cutover verified; full payment/Telegram evidence pending |
| Last updated | **2026-11-10 UTC** |

**Testnet only. Unaudited. No subjective dispute arbitration.** Targets below are planned work, not achieved traction. The [official track description](https://mezo.org/blog/mezo-buildathon-is-underway/) supports Telegram plus web access; project submission/qualification is a separate unverified claim.

## What Changed in V2

The deployed V2 address is `0x907AAB5A6d1710c477B9C1Da3c3b60b1324A060A`. Phase 0 verified its successful deployment receipt, runtime, version, canonical default MUSD and enabled allowlist. The current production JavaScript and `/api/health` use this address. That address cutover is verified; a complete money/auth/Telegram workflow is not.

| Change | Implemented behavior | Evidence/status |
| --- | --- | --- |
| Review-timeout claim | Provider claims still-Submitted work at or after `submittedAt + 604800` | [Contract](../contracts/src/PactoraEscrow.sol), passing local boundary tests; **Pending verification:** no live seven-day claim captured |
| Guarded no-show refund | Client refunds Pending at/after deadline or Rejected at/after `max(deadline, rejectedAt + 604800)`; Submitted work is excluded | Contract/source tests; **Pending verification:** no live refund captured |
| Hash-bound mutual settlement | Counterparty accepts the reviewed `bytes32` hash binding contract, chain, ID, persistent nonce, proposer and split; money changes invalidate it | Contract/source tests; **Pending verification:** no live mutual settlement captured |
| Exact token accounting | SafeERC20 plus exact sender/receiver balance changes; contract-token validation | Contract and local malicious/fee-token tests; deployed MUSD allowlist verified |
| Bot commands | `/balance`, `/agreements`, `/pending`, `/getmusd` plus welcome/help, notifications and unlink handlers | [Handlers](../lib/telegram/webhook.ts); bot identity/webhook verified, real command replies **Pending verification** |
| Agreement-ID fix | Decode a successful configured-escrow `AgreementCreated` receipt, then verify immutable chain/escrow-scoped metadata | [Decoder](../lib/chain/creation.ts), [creation page](../app/agreements/create/page.tsx), [API](../app/api/agreements/route.ts); real V2 ID 1/create/accept receipts verified |
| Live-app upgrade | Current deployed client and backend configured for V2 | [Deployment evidence](deployments.md#web-app-and-telegram); production DB/auth workflows **Pending verification** |

The historical app at revision `b773f72` generated `Date.now() % 1000000` metadata IDs before receipt confirmation. That was not a contract-assigned ID. The current counter starts at 1, and a missing/default agreement renders "Agreement not found on this contract". V1's immutable state and disclosed issues remain separate from these V2 changes.

Phase 0 ran **136 web/unit tests**, **2 browser smoke tests** and **72 Foundry tests**. Escrow line/branch coverage was **238/239** and **72/74**. These are local test results, not proof of live payouts or an external audit; [security](security.md#test-evidence) records the scope.

## Roadmap

Time targets are measured from this update and depend on owner review/resources. No completed pilot or real payment count is claimed.

| Milestone | Deliverable | Status | Evidence |
| --- | --- | --- | --- |
| Owner V2 live upgrade | Deploy V2 and rebuild the production app against its address | **Verified:** contract and app address cutover; DB/auth workflow checks still pending | Successful deployment receipt, live chunks and `/api/health` in [deployments](deployments.md) |
| Real-wallet and Telegram evidence | Complete allowance, funding, submit, approve and payout with two test wallets; capture signed linking and actual command/event replies | **Pending verification** | Existing V2 create/accept hashes only; Accepted/unfunded snapshot, no completed payout/chat evidence |
| Confirmed-event indexer and delivery retry | Resumable chain/escrow/log cursor, idempotent replay, scheduled bounded retry and stuck-job recovery | **Planned. Target: within four weeks** | Current callbacks and outbox in source are not a complete indexer or retry service |
| MEZO support | Verify official testnet address, deployed code, allowlist authorization, decimals and exact-transfer behavior before adding UI/token support | **Planned; verification prerequisites not met in this run** | Current app/notification source supports canonical MUSD only; no MEZO address or transfer is claimed |
| Independent security review | Review contract, authentication, DB concurrency and event-delivery assumptions | **Planned. Target: within six weeks** | No completed independent Pactora review verified; current controls/tests are [documented](security.md) |
| Consenting testnet pilot | Recruit **Target: five consenting teams** completing **Target: ten real testnet agreements**, with consent-based findings | **Planned. Target: within six weeks** | Targets only; no pilot participation, completions, revenue or traction verified |

## Composability and Mezo Fit

| Integration | Actual boundary |
| --- | --- |
| Canonical MUSD ERC-20 | Allowance, transferFrom escrow deposit and transfer payout; 18 decimals at the verified testnet address |
| Mezo Testnet RPC | Reads, successful receipts and wallet-signed escrow transactions on chain `31611` |
| BTC gas | Native gas in the source network registry; clients/providers supply their own test BTC |
| Wallet tooling | Wagmi/Viem with an injected wallet connector; signing remains in the user's wallet |
| Public chain receipts | Contract state and actual event transaction links through the [Mezo explorer](https://explorer.test.mezo.org) |
| Telegram | Signed-session one-time wallet linking, read-only commands, server-confirmed event alerts |
| Test-funds access | [Mezo faucet](https://faucet.test.mezo.org/) and [Mezo testnet swap/borrowing app](https://testnet.mezo.org), linked by `/getmusd` |

The bot guides users to existing Mezo tools. It does **not** execute a Mezo loan, provide borrowing/yield automation, hold keys or sign escrow actions. Pactora does not implement an x402 facilitator, gas sponsorship or a MEZO token integration. MEZO support is conditional planned work, not a guessed address in production.

## Risks and Open Questions

- **Pending verification:** full funding/delivery/approval/payout and real private-chat command/alert evidence. The current verified V2 agreement is Accepted and unfunded.
- **Pending verification:** production database provider/schema and isolated PostgreSQL concurrency/rollback behavior; env-name presence and local mocked suites do not prove database readiness.
- **Pending verification:** successful explorer source publication. Sourcify reports exact runtime matching, while the explorer API exposes no verification-status metadata.
- **Pending verification:** actual faucet issuance and Mezo testnet swap/borrowing with test wallets. URLs/guidance were checked, but no asset-acquisition transaction was executed.
- **Pending verification:** official MEZO testnet address/code/decimals and exact-transfer suitability before any allowlist or UI change.
- **Pending verification:** Wave 1 submission/advancement and Wave 2 eligibility. No accepted submission or competition result was checked.
- Single-RPC reads can fail or mislead; logs are queried in bounded ranges. Indexing and finality policy still need operational design.
- Repeated timely rejections/resubmissions can extend deadlines. No subjective dispute arbitration is provided, so contested quality still requires party agreement.
- Delivery is currently best-effort, not exactly once. External transactions can miss callbacks, and crashed queued work lacks automatic recovery.
- V1 retains immutable security limitations. Future releases must preserve explicit legacy receipts rather than silently route new funds to V1.

These are planned deliverables and verification gaps. They are not existing users, partners, revenue, pilot results or achieved traction.
