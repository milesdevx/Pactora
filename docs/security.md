# Pactora Security

Last verified: **2026-11-10 UTC**. **Testnet only. Unaudited. No subjective dispute arbitration.**

Scope: the V2 Solidity escrow, web/API authentication, off-chain metadata, Telegram linking and notification delivery in this repository. Local tests are not an external audit or proof of a full live payout. V1 retains the issues disclosed below; changing V2 source cannot fix an immutable V1 deployment.

## Contract Access

Source: [PactoraEscrow.sol](../contracts/src/PactoraEscrow.sol). There is a custom immutable owner, not an administrator who can decide escrow payouts. The contract inherits OpenZeppelin `ReentrancyGuard`; it is not an upgradeable proxy and has no owner withdrawal, pause or arbitration function in this source.

| Function | Caller and conditions |
| --- | --- |
| `createAgreement` | Any caller becomes client; provider must be nonzero and different; token must be allowed; 1-50 positive amounts and matching future deadlines |
| `acceptAgreement` | Designated provider; existing Created agreement |
| `fundAgreement` | Client; Accepted; every original deadline still future; `nonReentrant` |
| `submitMilestone` | Provider; Funded; Pending/Rejected; strictly before effective delivery/resubmission cutoff |
| `approveMilestone` | Client; Funded; Submitted; `nonReentrant`; no extra time cutoff |
| `rejectMilestone` | Client; Funded; Submitted; strictly before `submittedAt + REVIEW_WINDOW` |
| `claimAfterTimeout` | Provider; Funded; Submitted; at or after `submittedAt + REVIEW_WINDOW`; `nonReentrant` |
| `refundNoShow` | Client; Funded; Pending/Rejected; at or after effective cutoff; `nonReentrant` |
| `cancelUnfundedAgreement` | Either party; Created or Accepted, not Funded |
| `proposeResolution` | Either party; Funded; split exactly equals remaining balance; may replace an active proposal |
| `acceptResolutionProposal` | The other party, not proposer; Funded; active matching expected hash and remaining split; `nonReentrant` |
| `cancelResolutionProposal` | Active proposal's proposer only; no independent agreement-state check in this function |
| `setTokenAllowed` | Immutable owner via `onlyOwner`; nonzero token and deployed code when allowing |

Public views and generated getters are unrestricted. Missing IDs may return default structs; [chain readers](../lib/chain/server.ts) and the [identity helper](../lib/chain/agreements.ts) reject them as not found, rather than treating enum zero as a valid Created agreement.

## Contract Controls

| Control | Implementation and limit |
| --- | --- |
| Reentrancy guard | `fundAgreement`, `approveMilestone`, `claimAfterTimeout`, `refundNoShow`, `acceptResolutionProposal` protect all token-moving entrypoints. State-only methods are not described as guarded. |
| Safe token calls | `fundAgreement` uses `SafeERC20.safeTransferFrom`; `_transferExact` uses `safeTransfer`. A failed transfer reverts the whole transaction. |
| Exact funding | `fundAgreement` checks client debit and escrow credit each equal `totalAmount`, rejecting fee/extra-debit transfers with `InexactTokenTransfer`. |
| Exact payout/refund | `_transferExact`, reached by approval, timeout, no-show refund and mutual acceptance, checks escrow debit and recipient credit equal the intended amount. |
| Milestone total | `createAgreement` rejects zero amounts and sums the milestones to construct `totalAmount`. There is no independently trusted client-supplied total. |
| Accounting invariant | `_closeIfSettled` enforces `releasedAmount + refundedAmount <= totalAmount`. `proposeResolution` and `acceptResolutionProposal` require an exact split of the remaining balance. |
| Effects before interactions | `fundAgreement` updates funding state before transferFrom; `_releaseMilestone`, `refundNoShow` and `acceptResolutionProposal` update accounting/invalidate proposals/close before payouts. Reverts roll effects and events back. |
| Bound settlement consent | `proposeResolution` hashes `abi.encode(address(this), block.chainid, agreementId, persistent nonce, proposer, client refund, provider release)` with keccak256. `acceptResolutionProposal` requires the reviewed `bytes32 expectedProposalHash`. |
| Proposal invalidation | `_releaseMilestone` and `refundNoShow` invalidate a pending split when funds change. Replacement and cancellation delete it without resetting its nonce. Submit/reject do not change funds and do not invalidate it. |
| Token validation | Constructor requires nonzero contract code. `isTokenAllowed` always requires nonzero code; `setTokenAllowed` cannot allow an EOA. The [deployment script](../contracts/script/DeployPactoraEscrow.s.sol) requires chain 31611 and constructs V2 with canonical MUSD and allowlisting enabled. |

Allowlisting is checked at agreement creation, not rechecked by funding/payout after an owner revocation. The current app accepts only canonical MUSD even if the owner adds another token. Exact-transfer checks do not eliminate later negative rebases, dishonest `balanceOf` reporting or token-code changes.

`REVIEW_WINDOW` is 604,800 seconds. Pending delivery uses the agreed absolute deadline; Rejected work uses `max(deliveryDeadline, rejectedAt + 604800)`. Submitted work can never be a no-show refund. Rejection stops at the review boundary; provider claim starts at equality. All these actions require a transaction and BTC gas. Repeated timely revisions can extend the process without a contract-level count limit.

Fully settled agreements are Completed only when the cumulative refund is zero; otherwise Cancelled. Mutual settlement need not finalize individual milestone states. The exact state machines are in [architecture](architecture.md#agreement-states).

## Backend Authentication

Source: [auth routes](../app/api/auth), [crypto helper](../lib/security/crypto.ts), [session helper](../lib/security/session.ts), [request validation](../lib/security/api.ts).

Authentication is a **SIWE-style signed nonce**, not EIP-4361 compliant SIWE. `createAuthMessage` builds a custom "Pactora Authentication" message containing normalized wallet, nonce, issue time, origin, chain ID and expiry, plus a no-transaction notice. `/api/auth/verify` uses server-side `viem.verifyMessage`, exact stored nonce/wallet/message matching and origin/chain lines. The signature schema accepts a 65-byte EOA-style signature; no verified ERC-1271 smart-wallet authentication flow is claimed.

- `/api/auth/nonce` creates a random 32-byte nonce with a **five-minute** TTL and stores its authentication message.
- `/api/auth/verify` consumes exactly one unexpired, unconsumed matching nonce using conditional `UPDATE ... RETURNING`, inside the transaction that creates the user/session. Failed database work cannot authenticate.
- Session tokens are random 32-byte hex strings; only SHA-256 hashes persist in `wallet_sessions`. Expiry is **24 hours**.
- The cookie is HttpOnly, SameSite=Lax, host-scoped, path `/`, and Secure in production. Session validation checks expiry against database time on protected requests.
- Browser mutations validate same origin using `APP_URL`; production requires HTTPS. Public receipts and health do not require a session. Logout can clear an existing cookie without a fully valid session.
- JSON request bodies are bounded to **65,536 bytes**, with content-type and Zod checks. Logs suppress unknown error details; configuration/database failures return errors, not fake success.

## Telegram and Notifications

Source: [link API](../app/api/telegram/link/route.ts), [webhook API](../app/api/telegram/webhook/route.ts), [command processor](../lib/telegram/webhook.ts), [notification processor](../lib/telegram/notifications.ts).

Link creation requires the wallet's own signed session. Tokens contain 32 random bytes encoded as 43 base64url characters, expire after **15 minutes**, and persist only as SHA-256 hashes with signed-session provenance. `linkTelegramToken` conditionally consumes an unused, unexpired token inside the wallet/chat-link transaction. Unique constraints enforce one chat per wallet and one wallet per chat; old provenance defaults do not silently establish verified ownership.

Webhook authentication fails closed without a configured secret of sufficient length. It checks `X-Telegram-Bot-Api-Secret-Token` using equal byte lengths and `timingSafeEqual`. This is **constant-time shared-secret header comparison for equal-length inputs**, not HMAC and not independent proof of Telegram's network origin. Length rejection is early.

Only private messages from a matching non-bot sender/chat ID can execute account commands. The stored payload is sanitized command data and, if applicable, a token hash. Unknown text and raw bearer tokens are not persisted. A unique Telegram update ID and conditional Pending-to-Processing transition avoid repeated command execution. The webhook acknowledges persistence before `after()` runs the command; that does not guarantee successful delivery.

`/api/notifications/confirmed` accepts a transaction hash, not client-reported event amounts. `readConfirmedReceipt` requires chain 31611 and a successful mined receipt, filtering logs to the configured escrow. `queueConfirmedNotifications` checks agreement-party membership and only targets verified linked participants with alerts enabled. Outbox keys bind chain, escrow, transaction/log and recipient. There is no additional confirmation-depth requirement or independent RPC quorum.

The outbox can claim Pending/Failed jobs as Sending and record success/failure. Repeating an event request can requeue Pending/Failed jobs. There is no scheduled retry, lease recovery for stuck Sending/Processing jobs or complete event indexer. A crash after an external send has uncertain delivery status; exactly-once delivery is not guaranteed.

`/api/notifications/test` is disabled in production unless `ALLOW_TEST_NOTIFICATIONS` is exactly the string `"true"`, not merely truthy. This is the code's gate, not a disclosure of its production setting. It also requires same origin, a signed session, a verified own-wallet link, enabled alerts and a rate limit. It accepts no arbitrary chat ID and labels the message **not a chain event**.

Server credentials remain in server-only modules, never under a `NEXT_PUBLIC_` name. Phase 0's built-client scan found no server-secret references or configured secret values in **48 JavaScript/map files**. Legacy `SESSION_SECRET` and `LINK_TOKEN_SECRET` settings are not consumed by this V2 design.

## Rate Limits

Source: [persistent limiter](../lib/security/rate-limit.ts) and the route handlers. All windows are **60 seconds**. PostgreSQL atomic expiring UPSERTs store counters. HMAC-SHA256 hashes the route/identity bucket using `RATE_LIMIT_SECRET`; this HMAC use is unrelated to webhook authentication. The code checks a minimum secret string length of 32, not its entropy. Generate a strong random server-only secret.

Only Vercel's `x-vercel-forwarded-for` is trusted when the runtime identifies Vercel. Other hosts share the unauthenticated route bucket. Authenticated mutations use wallet identity; webhook commands use chat ID. Missing limiter configuration/database access fails closed; no in-memory fallback exists.

| Handler bucket | Requests per 60 seconds | Identity |
| --- | --- | --- |
| `auth:nonce` | 10 | Trusted IP or shared |
| `auth:verify` | 20 | Trusted IP or shared |
| `agreements:create` | 10 | Wallet |
| `agreements:evidence` | 20 | Wallet |
| `telegram:link` | 5 | Wallet |
| `telegram:unlink` | 5 | Wallet |
| `telegram:webhook` | 60 | Private chat |
| `notifications:confirmed` | 30 | Wallet |
| `notifications:test` | 3 | Wallet |

GET handlers and logout have no explicit application rate limit. These values are not claims about Vercel's infrastructure limits.

## Metadata and Receipts

The [creation route](../app/api/agreements/route.ts) checks the client session, successful creation event, actual ID, parties, token, terms hash, milestone sums and deadlines before immutable registration. A unique verified chain/escrow/ID key prevents a second metadata registration from overwriting the first. Reads recheck metadata against chain state.

The [evidence route](../app/api/agreements/[id]/evidence/route.ts) requires party membership and the appropriate author, then matches keccak256 of supplied text to a confirmed submission/rejection event. It verifies a text commitment, not the quality or contents of a linked deliverable. Public receipts read token metadata, actual funded/released/refunded state and bounded chain-event history; a budget is not presented as a deposit.

## Threat Model

| Threat | Mitigation in current code | Residual risk |
| --- | --- | --- |
| Client unresponsive after submission | Provider `claimAfterTimeout` after 604,800 seconds | Provider must submit a valid transaction and pay gas; a timely rejection changes the path |
| Provider no-show | Client `refundNoShow` at agreed/effective deadline | Only Pending/Rejected work qualifies; a hash is not proof of quality |
| Bad-faith rejection or contested work | Review boundaries and hash-bound mutual settlement | No subjective arbitration; repeated timely revisions can extend the process |
| Malicious/fee token | Code validation, allowlist, SafeERC20 and exact transfer deltas | Owner/token trust, later rebases and dishonest balances remain |
| Reentrant token callback | Guarded money entrypoints and effects before payouts | Tests are not exhaustive correctness proof |
| Replayed nonce or forged wallet signature | Exact message/signature check, expiry and atomic single consumption | Stolen wallet key/session or compromised client remains a risk |
| Stolen link token | Hash at rest, signed-session issuance, 15-minute single use | The deep link is a bearer credential; a thief can consume it first |
| Forged webhook | Required shared secret, equal-length constant-time comparison | Leaked shared secret allows forgery; no independent sender attestation |
| Duplicate update/event | Unique update/outbox keys and conditional claims | Crashes can strand work; automatic retry and exactly-once external delivery are absent |
| RPC lies or reorg | Chain-ID/config checks, successful receipt and scoped logs | One RPC is trusted; no quorum/finality-depth check; read/notification state can be wrong |
| Settlement front-running/replacement | Expected proposal hash, persistent nonce, remaining-balance checks and payout invalidation | Changed proposals cause stale acceptance to revert; parties must review the actual split |
| Metadata substitution | Party/receipt/hash/amount/deadline verification | Off-chain text may be unavailable; registered discovery is incomplete |

## Test Evidence

Commands were run on **2026-11-10 UTC**, from the repository root except Foundry commands from `contracts`.

| Command | Actual result |
| --- | --- |
| `pnpm.cmd typecheck` | Passed |
| `pnpm.cmd lint` | Passed, no ESLint warnings/errors; Next lint command emitted a deprecation notice |
| `pnpm.cmd test` | **136 passed**, 14 files |
| `pnpm.cmd build` | Passed; Next.js 15.5.28 build |
| `pnpm.cmd test:e2e` | **2 passed**, desktop/mobile public-page smoke checks |
| `pnpm.cmd check:client-secrets` | Passed; **48** client JavaScript/map files |
| `forge test -vv` | **72 passed, 0 failed, 0 skipped**; three fuzz tests each ran 256 cases, not 768 extra tests |
| `forge coverage` | Passed; the same 72 tests |

| Coverage scope | Lines | Branches | Functions |
| --- | --- | --- | --- |
| `src/PactoraEscrow.sol` | **99.58% (238/239)** | **97.30% (72/74)** | **100% (27/27)** |
| Aggregate including deployment script and mocks | **98.06% (303/309)** | **97.65% (83/85)** | **100% (44/44)** |

Foundry 1.9.1-nightly used Solc 0.8.37; coverage disables optimizer/viaIR and excludes dependencies by default. No extra coverage filters were supplied. These are instrumented source-map counters, not physical source-line counts or an audit score.

Server suites label their data as Illustration fixtures. Foundry creates local MockERC20/escrow instances and uses `vm.warp`; a local seven-day time-warp test is **not seven days on a live chain**. Browser smoke tests do not sign transactions or exercise Telegram. Actual create/accept receipts are separate evidence in [deployments](deployments.md#lifecycle-evidence).

## Known Limitations

- No external Pactora security audit or subjective dispute arbitration is verified. Use testnet-only wallets and test assets.
- V1 has no timeout/no-show paths, accepts unbound replaceable settlement proposals, uses nominal token accounting and has weaker allowlist validation. Its historical source was read with `git show b773f72:contracts/src/PactoraEscrow.sol`; V2 changes do not alter that deployment.
- No complete indexer. Dashboard/Telegram discovery is bounded as documented in [architecture](architecture.md#discovery-and-receipt-limits); receipt history older than 100,000 blocks can be incomplete.
- Delivery depends on app-confirmed callbacks and best-effort `after()` work, with no automatic retry or stuck-job recovery.
- **Pending verification:** full two-wallet funding/submission/approval/payout and real private-chat linking/commands/alerts. Verified V2 creation/acceptance is an unfunded partial run, not completed payment evidence.
- **Pending verification:** production database provider/schema and PostgreSQL concurrency/rollback integration. No production DB connection or isolated real-DB integration run was part of Phase 0.
- **Pending verification:** explorer source publication. Its API returned bytecode fields without verification metadata; Sourcify separately reports runtime `exact_match`, not a creation match.
- The live `/help` footer still uses "audited" wording and MIT licensing text. Neither is the documentation's security status: Pactora is unaudited and the repository [LICENSE](../LICENSE) is Apache-2.0. Application text was not changed in this Markdown-only task.

## Responsible Disclosure

GitHub currently serves this file as the repository [security policy](https://github.com/milesdevx/Pactora/security/policy). No separate project-specific disclosure contact or response commitment was found in tracked files; OpenZeppelin's vendored policy is for that dependency, not Pactora.

Use the repository [issue tracker](https://github.com/milesdevx/Pactora/issues) for a **non-sensitive request for private follow-up**. Include the affected version, chain/escrow and public transaction hash where safe. Do not post exploit instructions, private keys, tokens, session/link credentials or environment values publicly.

**Pending verification:** a dedicated private-reporting channel and response policy have not been confirmed. Check the current security policy for a private route before sharing vulnerability details.
