# Pactora Security Specification & Threat Model

This document describes contract controls and backend security requirements. Backend enforcement is under source audit; requirements below are not proof of a passed release gate.

---

## 1. Smart Contract Security (`PactoraEscrow.sol`)

### 1.1 Invariant Protection
The smart contract enforces the following strict conservation of value invariant at every step:
$$\text{releasedAmount} + \text{refundedAmount} \le \text{totalAmount}$$
$$\sum_{i=1}^{N} \text{milestoneAmounts}[i] = \text{totalAmount}$$

- **Deposit Lock:** Once an agreement is marked `Funded`, `totalAmount` in MUSD is transferred from the client's wallet to the contract escrow. Funds cannot be withdrawn or transferred except through:
  1. Milestone approval by the client (releases milestone amount to provider).
  2. Mutual consent dispute resolution agreed upon by both client and provider.
  3. Pre-funding cancellation by the client (no funds held).

### 1.2 Checks-Effects-Interactions & Reentrancy Defense
- The immutable contract inherits OpenZeppelin's `ReentrancyGuard`, not an upgradeable variant.
- All state-changing external transfer functions (`fundAgreement`, `approveMilestone`, `acceptResolutionProposal`) follow **Checks-Effects-Interactions**:
  1. Internal accounting is updated first (e.g. `milestone.state = MilestoneState.Approved`, `agreement.releasedAmount += amount`).
  2. External ERC-20 token transfers occur last.
  3. All external token operations use OpenZeppelin's `SafeERC20.safeTransfer` and `SafeERC20.safeTransferFrom`.
- Comprehensive reentrancy tests in `contracts/test/PactoraEscrow.t.sol` use `MaliciousERC20` attempting to re-enter during `approveMilestone`; the attack strictly reverts with `ReentrancyGuardReentrantCall()`.

### 1.3 Access Control & Privilege Separation
Every state-altering contract function validates caller identity via custom errors:
- Client checks: Only `agreement.client` can fund, approve milestones, or reject milestones. Either party may cancel an unfunded agreement.
- `onlyProvider`: Only `agreement.provider` can accept agreements or submit milestone proofs.
- `onlyParticipant`: Only client or provider can propose or accept mutual dispute resolutions.
- Zero-address checks: Prohibits address(0) for clients, providers, or token addresses upon creation.

### 1.4 Mutual Consent Settlement Math
When proposing a split via `proposeResolution`:
```solidity
uint256 remaining = getRemainingBalance(agreementId);
if (clientRefundAmount + providerReleaseAmount != remaining) {
    revert InvalidResolutionAmounts();
}
```
This guarantees that resolution math cannot mint, drain, or leave orphaned funds in escrow.

---

## 2. Wallet Authentication & Cryptographic Session Security

### 2.1 SIWE-Style Signed Nonces (Not EIP-4361)
The current custom signing message is not EIP-4361. The release gate requires a single-use, expiring nonce and a server-verified wallet-bound session for protected API calls:
1. Client requests a cryptographic nonce via `POST /api/auth/nonce`.
2. The server generates a 32-byte hex nonce via `crypto.randomBytes(32)` and stores it with a 5-minute time-to-live (TTL).
3. The user signs an unambiguous authentication message in their wallet:
   ```
   Pactora Authentication
   Sign this message to authenticate your wallet with Pactora.
   Wallet: 0x...
   Nonce: ...
   Issued At: 2026-10-20T...
   Terms: This request will not trigger any blockchain transaction or gas fee.
   ```
4. Server verifies the signature using `viem`'s `verifyMessage({ address, message, signature })`.
5. Required hardening: nonces must be consumed with one conditional database update, refusing expired, reused, unknown, or mismatched nonces and database failures. Protected APIs must require a wallet-bound session; a browser-supplied address is not authentication.

---

## 3. Telegram Account Linking Security

### 3.1 Single-Use Expiring Link Tokens
To link a Telegram account to a Mezo wallet address without exposing sensitive data:
1. `crypto.randomBytes(32)` produces a cryptographically secure 64-character hex token.
2. The server stores only the SHA-256 hash of the token (`hashToken(rawToken)`) in `telegram_link_tokens`.
3. The link token has a strict **15-minute time-to-live** (`expires_at`).
4. When the user sends `/start link_<token>` to the Telegram bot:
   - The token is re-hashed and looked up in the database.
   - If expired or already used (`is_used = true`), it is rejected.
   - It is marked `is_used = true` atomically within the database transaction.

### 3.2 Secret-Token Header Verification (Not HMAC)
Telegram sends incoming user updates via HTTP POST to `/api/telegram/webhook`.
- Required release control: validate the `X-Telegram-Bot-Api-Secret-Token` header with an equal-length guard and constant-time comparison:
  ```ts
  const bufA = Buffer.from(receivedToken);
  const bufB = Buffer.from(configuredSecret);
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  ```
- Possession of the shared secret authenticates the request; it is not an HMAC signature and does not independently prove its network origin. Missing secret configuration must fail closed.

### 3.3 Webhook Idempotency & Replay Protection
- Telegram updates carry a unique integer `update_id`.
- The webhook handler records each `update_id` in `webhook_events`.
- If Telegram retries delivery of an already-processed `update_id`, the handler returns HTTP 200 immediately without re-executing state changes or duplicate notifications.

---

## 4. Frontend & Client-Side Hardening

- **Zero Secret Leakage:** No server credentials (`DATABASE_URL`, `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`) are prefixed with `NEXT_PUBLIC_`. They are excluded from the client JavaScript bundle.
- **Strict RPC Read/Write Separation:** Wallet write actions require explicit user confirmation through their connected browser wallet (MetaMask, Rabby, Mezo Wallet).
- **Public Receipt Verification:** The `/receipts/[id]` route performs direct on-chain verification using Viem public clients against Mezo Testnet RPC, ensuring third-party auditability without depending on off-chain database consistency.
- **Fail-safe Test Endpoints:** The notification testing endpoint (`/api/notifications/test`) includes an explicit production circuit-breaker:
  ```ts
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_TEST_NOTIFICATIONS) {
    return NextResponse.json({ error: "Forbidden in production" }, { status: 403 });
  }
  ```
