# Pactora Security Specification & Threat Model

This document outlines the security controls, invariant specifications, and threat mitigation strategies implemented across Pactora's smart contracts, cryptographic services, backend APIs, and Telegram integration.

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
- The contract inherits OpenZeppelin's `ReentrancyGuardUpgradeable` / `ReentrancyGuard`.
- All state-changing external transfer functions (`fundAgreement`, `approveMilestone`, `acceptResolution`) follow strict **Checks-Effects-Interactions**:
  1. Internal accounting is updated first (e.g. `milestone.state = MilestoneState.Approved`, `agreement.releasedAmount += amount`).
  2. External ERC-20 token transfers occur last.
  3. All external token operations use OpenZeppelin's `SafeERC20.safeTransfer` and `SafeERC20.safeTransferFrom`.
- Comprehensive reentrancy tests in `contracts/test/PactoraEscrow.t.sol` use `MaliciousERC20` attempting to re-enter during `approveMilestone`; the attack strictly reverts with `ReentrancyGuardReentrantCall()`.

### 1.3 Access Control & Privilege Separation
Every state-altering contract function validates caller identity via custom errors:
- `onlyClient`: Only `agreement.client` can fund, approve milestones, reject milestones, or cancel unfunded agreements.
- `onlyProvider`: Only `agreement.provider` can accept agreements or submit milestone proofs.
- `onlyParticipant`: Only client or provider can propose or accept mutual dispute resolutions.
- Zero-address checks: Prohibits address(0) for clients, providers, or token addresses upon creation.

### 1.4 Mutual Consent Settlement Math
When proposing a split via `proposeResolution`:
```solidity
uint256 remainingEscrow = agreement.totalAmount - agreement.releasedAmount - agreement.refundedAmount;
if (clientRefund + providerRelease != remainingEscrow) {
    revert InvalidSplitSum();
}
```
This guarantees that resolution math cannot mint, drain, or leave orphaned funds in escrow.

---

## 2. Wallet Authentication & Cryptographic Session Security

### 2.1 EIP-4361 Signed Nonces
Pactora does not use insecure bearer tokens or ambient session cookies. Backend interactions requiring authentication (e.g., account linking, private queries) use signed nonces:
1. Client requests a cryptographic nonce via `POST /api/auth/nonce`.
2. The server generates a 32-byte hex nonce via `crypto.randomBytes(32)` and stores it with a 5-minute time-to-live (TTL).
3. The user signs an unambiguous authentication message in their wallet:
   ```
   Sign in to Pactora with your Mezo wallet.
   
   Address: 0x...
   Nonce: ...
   Issued At: 2026-10-20T...
   Chain ID: 31611
   ```
4. Server verifies the signature using `viem`'s `verifyMessage({ address, message, signature })`.
5. Nonces are single-use; the nonce record is immediately invalidated upon first verification to prevent replay attacks.

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

### 3.2 Webhook Signature & Secret Verification
Telegram sends incoming user updates via HTTP POST to `/api/telegram/webhook`.
- The webhook endpoint validates the `X-Telegram-Bot-Api-Secret-Token` header using constant-time string comparison:
  ```ts
  const bufA = Buffer.from(receivedToken);
  const bufB = Buffer.from(configuredSecret);
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  ```
- This prevents timing attacks and guarantees requests originate solely from Telegram's servers.

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

