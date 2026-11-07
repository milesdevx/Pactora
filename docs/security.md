# Pactora Security and Verification

Pactora V2 is unaudited, testnet-only software. Local implementation and tests do not prove that the live Vercel alias or configured escrow has been upgraded. V1 remains immutable and must not be represented as fixed by a source-code change.

## Contract Controls

- OpenZeppelin `ReentrancyGuard`, not an upgradeable guard, protects every money-moving entrypoint. `SafeERC20` performs transfers; state changes precede transfers and revert together on failure.
- Funding requires exact client debit and escrow credit. Payouts require exact escrow debit and recipient credit. The deployed V2 script enforces a canonical-MUSD allowlist. Negative rebases and dishonest token balance reporting remain token-trust limitations.
- Every milestone has a positive amount. Their sum is the agreement total. Released plus refunded never exceeds total; terminal settlement equals total.
- Client-only funding, approval, rejection and no-show refund; provider-only acceptance, submission and review-timeout claim. Either party can cancel before funding or propose a mutual split. Only the other party accepts it.
- Tokens must be nonzero contracts in both allowlist modes. The owner controls allowlist additions, not withdrawals.
- A proposal hash commits to contract address, chain ID, agreement ID, persistent nonce, proposer and both amounts. Acceptance supplies that exact hash. Replacement or cancellation/reproposal cannot silently substitute terms. Payouts invalidate pending proposals.
- V2 stores delivery deadlines at creation, accepted by the provider before funding. Funding refuses elapsed deadlines. Submission is strictly before the delivery cutoff; no-show refunds are at or after it.
- Submitted work has a seven-day review window. Rejection is strictly before its end; provider timeout claims are at or after it. Submitted work is never a no-show refund candidate.
- Rejected work gets until the later of its original deadline and rejection plus seven days to resubmit. Resubmission starts a fresh review period. These rules address silence, not deliverable authenticity or bad-faith rejection.
- Fully settled agreements are `Completed` if entirely released, otherwise `Cancelled`. A mutual split need not individually approve milestones. `AgreementCancelled.refundAmount` is cumulative, not an additional transfer.

## Wallet Sessions

Authentication is **SIWE-style, not EIP-4361 compliant**. The custom message includes normalized wallet address, random nonce, issue/expiry times, application origin, chain `31611`, and a no-transaction notice.

`POST /api/auth/nonce` stores a 32-byte random nonce for five minutes. Verification uses server-side `viem.verifyMessage`, then consumes exactly one matching stored nonce with a conditional `UPDATE ... RETURNING` inside the transaction that creates the session. Unknown, expired, reused or mismatched nonces and database failures cannot authenticate.

Sessions are 32-byte random opaque tokens; only SHA-256 hashes persist in `wallet_sessions`. Cookies are HttpOnly, SameSite=Lax, Secure in production, host-scoped and expire after 24 hours. Protected API calls independently validate the session and wallet ownership. Mutations validate same origin. Production `APP_URL` must be HTTPS. `SESSION_SECRET` is not used by this design.

## Telegram Controls

- Signed-session link creation is persistently rate-limited. A 32-byte base64url token is 43 characters; `link_` plus the token stays inside Telegram's 64-character deep-link limit. Only its SHA-256 hash persists, including in queued webhook payloads. It expires after 15 minutes.
- Token consumption is one conditional update checking hash, expiry, unused status and `issuedWithSession`, inside the link transaction. Unique constraints enforce one wallet per chat and one chat per wallet.
- Legacy tokens and links default to unverified; they must be reissued through a signed wallet session. Old data is not silently promoted to verified ownership.
- The upgrade migration redacts legacy raw webhook payloads while retaining update IDs and statuses. Unique-link constraints require a duplicate-data preflight before applying production SQL; duplicate records must not be silently deleted.
- Webhooks fail closed without a configured secret. Header verification is **secret-token header verification (constant-time)** using an equal-byte-length guard and `timingSafeEqual`, **not HMAC** and not proof of Telegram's network origin independent of the shared secret.
- Only private messages with matching sender/chat ID can mutate links or expose linked-account details. Unknown message content is discarded, not stored. Raw bearer tokens, bot tokens and upstream error bodies are not logged.
- Unique `update_id` insertion uses insert-or-ignore, not read-then-write. A persisted job is acknowledged before `after()` handles commands and sends replies. Sending failures do not turn the webhook response into a 500.
- Notification requests accept only a transaction hash. The server reads its successful Mezo Testnet receipt, filters logs to the configured escrow and verifies the caller is a party. It never accepts a browser's claimed transaction success or payout amount.
- Outbox event keys deduplicate each recipient/event. Delivery remains best-effort; automatic retry/indexer operation is not yet implemented. A crash after Telegram accepts a send but before DB acknowledgment can still cause a later duplicate delivery.
- Production test notifications require the literal `ALLOW_TEST_NOTIFICATIONS=true`, an authenticated wallet, its verified linked chat, enabled preferences and a rate limit. No arbitrary chat ID is accepted.

## Rate Limiting and Errors

PostgreSQL counters use atomic expiring UPSERTs. `RATE_LIMIT_SECRET` HMAC-hashes route/wallet or trusted Vercel IP identity; there is no in-memory fallback. Only Vercel's forwarding header is trusted on Vercel; other hosts share a route bucket. Missing configuration or database failures fail closed.

Requests use Zod validation, bounded JSON bodies, explicit HTTP errors and sanitized failure logs. `/api/health` is liveness only, not proof of database availability or deployment readiness. Server-only modules prevent database and bot credentials from being bundled into client code.

## Frontend and Receipts

Writes specify Mezo Testnet `31611` and the selected wallet explicitly. Wrong-network switching, rejected signatures, confirmation, revert and unavailable-confirmation states are distinct. Duplicate actions remain disabled while signing or awaiting confirmation. Money confirmations show exact bigint-derived amount, token contract and full recipient before opening the wallet.

Creation IDs come from successful `AgreementCreated` receipts, not clocks. Metadata is immutable after registration and its parties, amounts, deadlines and keccak256 terms commitment are rechecked against chain data. Submission/rejection text is stored only after receipt-event/hash verification. Missing evidence is labelled unavailable, never attached.

Public receipts use contract reads and confirmed logs, expose actual token contract and transaction links, and distinguish agreement budget from actually funded assets. Old receipts can specify their escrow address. History is bounded to 100,000 recent blocks plus creation/closure anchors when older; it is not presented as a complete indexer.

## Phase B Findings

References below identify the original reviewed revision, before fixes moved lines. All fixes require gates and deployment verification; a local fix is not a claim that V1 changed.

| Severity | Original File:Line | Finding | Local Fix |
| --- | --- | --- | --- |
| High | `contracts/src/PactoraEscrow.sol:399-427` | Unbound resolution acceptance | Persistent proposal identity and expected hash |
| High | `contracts/src/PactoraEscrow.sol:238-244,328,440-444` | Nominal fee-token pooled insolvency | Exact debit/credit checks and enforced reviewed-token allowlist |
| Medium | `contracts/src/PactoraEscrow.sol:253-427` | Silence locks funded work | User-approved deadlines, review claims and guarded refunds |
| Low | `contracts/src/PactoraEscrow.sol:129-155` | Owner could allowlist an EOA | Unconditional code/zero validation |
| High | `app/api/auth/verify/route.ts:53-91` | Authentication fails open, no session | Atomic nonce consumption and DB-backed session |
| High | `app/api/telegram/link/route.ts:23-60` | Arbitrary-wallet links and fake DB success | Signed-session ownership, persistence and limits |
| High | `app/api/agreements/route.ts:54-124` | Unverified metadata overwrite/notifications | Receipt/terms/amount/deadline verification and immutable registration |
| High | `app/api/telegram/webhook/route.ts:20-26` | Missing secret disables authentication | Fail-closed constant-time comparison |
| Medium | `app/api/telegram/webhook/route.ts:39-131` | Token and dedup races | Unique insert and conditional transaction update |
| Medium | `app/api/notifications/test/route.ts:7-40` | False string enables production; arbitrary chat | Literal flag and verified owner recipient |
| Medium | `app/api/auth/nonce/route.ts:25-37` | Long expiry/fake persistence fallback | Five-minute expiry and fail closed |
| Medium | `app/api/agreements/[id]/route.ts:14-37` | Partial IDs and disguised DB failure | Strict IDs, distinct errors, protected reads |
| Medium | `lib/telegram/bot.ts:39-56` | Raw upstream logging/invented config | Sanitized logs, escaped strings, required config |
| High | `app/agreements/create/page.tsx:171-191` | Invented ID and pre-confirmation metadata | Receipt-derived ID and confirmed registration |
| High | `app/agreements/create/page.tsx:62-65`; workspace `:145-166` | Floating-point money | Exact bigint parsing/formatting |
| Medium | `app/agreements/[id]/page.tsx:173-275` | Unhandled writes/network drift | Confirmed transaction lifecycle and explicit chain/account |
| Medium | `app/agreements/[id]/page.tsx:201-209,695-705` | Lost notes labelled attached | Receipt-verified evidence storage and truthful display |
| Medium | `app/dashboard/page.tsx:49-180` | Failed reads look empty; decorative activity | Distinct loading/error states, no fabricated charts |
| Medium | `app/receipts/[id]/page.tsx:34-190` | Invalid ID, unfunded totals and assumed token | Validated IDs, true funded/token state, confirmed logs |
| Medium | `app/settings/telegram/page.tsx:58-116` | No auth/status; arbitrary test chat | Signed sessions and server-owned link management |
| High | Legacy link-token/link rows | Pre-upgrade ownership was never proven | Provenance markers default false; require signed relinking |
| Medium | New metadata deadline integration | Hash alone did not match separately supplied deadlines | Direct equality checks on write/list/read |

## Verification Limits

The V2 contract worker ran 71 passing local tests and coverage: 238/239 lines, 72/74 branches, 27/27 functions. Money-moving functions have no unhit instrumented lines except the defensive remaining-split rejection at line 491; the total-invariant failure branch at 545 is also unhit. These figures must be rerun for the final revision.

Unit fixtures are labelled Illustration and are not live transaction evidence. Isolated PostgreSQL concurrency integration has not run because Docker is unavailable. Production schema, V2 redeploy, real Telegram commands, two-wallet demo and source verification remain separate live gates.
