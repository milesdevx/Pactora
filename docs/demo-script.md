# Pactora End-to-End Buildathon Demo Script

This document is a step-by-step presentation script designed for hackathon judges and technical evaluators exploring the Pactora application on Mezo Testnet.

---

## Prerequisites & Test Environment

1. **Browser Wallet:** MetaMask or Rabby configured for **Mezo Testnet**:
   - **RPC URL:** `https://rpc.test.mezo.org`
   - **Chain ID:** `31611` (`0x7b7b`)
   - **Currency Symbol:** `BTC`
   - **Explorer:** `https://explorer.test.mezo.org`
2. **Test Assets:**
   - Testnet BTC for gas: obtain via the Mezo Testnet faucet.
   - Testnet MUSD: canonical address `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`.
3. **Telegram Account:** Mobile or Desktop Telegram app.

---

## Demo Walkthrough (8 Minutes)

### Act 1: Landing Page & Protocol Overview (1 min)
1. Navigate to the Pactora homepage (`/`).
2. **Highlight the value proposition:**
   - "Work agreed. Funds protected. Payments verified."
   - Point out the real-time Mezo network badge in the navigation header indicating Chain ID 31611.
    - The homepage preview is **"Illustration, not real funds"**. It sends no transactions and must never be shown as proof of a live payout.
3. Click **"Launch App"** or **"Dashboard"**.

---

### Act 2: Connecting Telegram for Instant Alerts (1.5 min)
1. Go to **Settings > Telegram Notifications** (`/settings/telegram`).
2. Connect your wallet using the top-right button.
3. Click **"Generate Link Token"**:
   - Note the single-use 15-minute token generated securely via CSPRNG.
   - Click the deep-link button **"Open in Telegram (@PactoraAlertsBot)"**.
4. In Telegram, the bot displays the `/start` command with the token:
   - Send the message.
   - The bot responds instantly: *"Account successfully linked to wallet 0x123...!"*
5. Return to the browser and inspect the link status. Use **"Send Test Alert"** only if test notifications were explicitly enabled; production disables this endpoint by default. A test alert is not a chain payment notification.

---

### Act 3: Creating a Milestone Agreement (2 min)
1. Navigate to **New Agreement** (`/agreements/create`).
2. Input the contract terms:
   - **Title:** "Mezo Ecosystem Analytics Dashboard"
   - **Provider Address:** Enter the counterparty's address (or a secondary test wallet).
   - **Terms & Description:** Scope of work, deliverables, and deadlines.
3. Configure the Milestone Breakdown:
   - **Milestone 1:** "Architecture Design & Schema Specification" — `250 MUSD`
   - **Milestone 2:** "Smart Contract Development & Foundry Tests" — `500 MUSD`
    - **Milestone 3:** "Frontend Integration & Testnet Verification" - `250 MUSD`
4. These are **Illustration** amounts for planning the recording. Use only the real balances available in your two test wallets. The application anchors terms with `keccak256` of the JSON terms; SHA-256 is used for link tokens, not agreement terms.
5. Click **"Deploy Agreement"**:
   - The wallet prompts for transaction signature on `PactoraEscrow.createAgreement(...)`.
   - On confirmation, the agreement details page loads (`/agreements/[id]`).
    - Record a creation notification only if it was actually delivered after chain confirmation. Do not invent a notification or transaction hash.

---

### Act 4: Escrow Funding & Milestone Execution (2.5 min)
1. **Provider Acceptance:**
   - Switch to the provider wallet (or review provider actions).
   - Click **"Accept Agreement"** to formally accept the terms on-chain.
2. **Client MUSD Escrow Funding:**
   - As the client, click **"Approve MUSD Escrow"** (triggers ERC-20 `approve` for 1,000 MUSD).
   - Once approved, click **"Deposit 1,000 MUSD to Escrow"** (`fundAgreement`).
   - The escrow balance updates to 1,000 MUSD, held securely in the non-custodial smart contract.
   - Telegram sends a funding confirmation alert.
3. **Milestone 1 Submission:**
   - As provider, click **"Submit Proof"** on Milestone 1.
   - Paste deliverable link / GitHub commit hash.
   - The milestone status changes to `Submitted`.
   - The client receives a Telegram notification: *"Milestone 1 submitted for review"*.
4. **Milestone 1 Approval & Immediate Payout:**
   - As client, review the submission and click **"Approve & Release 250 MUSD"**.
   - The smart contract executes `approveMilestone`, releasing 250 MUSD directly to the provider's wallet.
   - The escrow balance decreases to 750 MUSD.
   - Telegram notifies the provider of payment receipt.

---

### Act 5: Public Audit Receipts & Mutual Settlement (1 min)
1. Click **"View Public Receipt"** or navigate to `/receipts/[id]`:
   - View the immutable, read-only payment receipt.
   - Show the verified Mezo Explorer transaction hashes, participant addresses, and milestone timestamps.
   - Click **"Print / Save PDF"** to demonstrate client accounting and invoice readiness.
2. **Mutual Consent Resolution Demo (Edge Case Handling):**
   - If the project scope changes, show the **Mutual Dispute Settlement** card on the agreement page.
   - Demonstrate how either party can propose a custom split of the remaining escrow (e.g. 500 MUSD refund to client, 250 MUSD payout to provider).
   - Explain how the smart contract guarantees mathematical invariance before executing mutual settlement without centralized arbiter risk.

---

## Conclusion & Judge Takeaways

- **Non-Custodial & Invariant-Enforced:** Funds are never controlled by Pactora servers; all releases follow strict Solidity state machine rules.
- **Tailored for Mezo:** Built specifically around Bitcoin gas mechanics and canonical MUSD escrow.
- **Testnet UX:** Record only confirmed transactions and messages actually received. The labelled homepage illustration is not a live demo.
