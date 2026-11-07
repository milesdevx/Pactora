# Pactora — Milestone-Based MUSD Escrow for the Mezo Ecosystem

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Mezo Testnet](https://img.shields.io/badge/Mezo%20Testnet-Chain%20ID%2031611-orange)](https://explorer.test.mezo.org)
[![Next.js](https://img.shields.io/badge/Next.js-15.5-black)](https://nextjs.org/)
[![Foundry](https://img.shields.io/badge/Foundry-Tested-blue)](https://getfoundry.sh/)
[![CI](https://github.com/milesdevx/Pactora/actions/workflows/ci.yml/badge.svg)](https://github.com/milesdevx/Pactora/actions/workflows/ci.yml)

> **Work agreed. Funds protected. Payments verified.**  
> Pactora is a non-custodial milestone escrow and payment coordination protocol built specifically for freelancers, agencies, and clients operating within the Mezo ecosystem.

---

## 🚀 Key Highlights

- **Native to Mezo:** Built around Mezo's Bitcoin-based gas economics and canonical **MUSD** stablecoin.
- **Non-Custodial Escrow (`PactoraEscrow.sol`):** Funds are locked in smart contract escrow with OpenZeppelin `ReentrancyGuard` and strict mathematical invariants ($\sum \text{milestones} = \text{total}$).
- **Mutual Consent Settlement:** On-chain mutual-consent split of the remaining escrow. Pactora does not arbitrate subjective disputes.
- **Telegram Coordination:** Wallet linking, notification preferences, and agreement lookup. Confirmed-event notifications are being hardened before submission.
- **Honest Data:** Wagmi v2 + Viem read Mezo Testnet. The homepage preview is explicitly labelled "Illustration, not real funds"; it is not deployment or payment evidence.

---

## 🌐 Verified Mezo Network Parameters

Verified against official [Mezo Documentation](https://mezo.org/docs/developers/):

| Property | Value | Notes |
| :--- | :--- | :--- |
| **Network Name** | Mezo Testnet | Public EVM testnet |
| **Chain ID** | `31611` (`0x7b7b`) | Verified via `eth_chainId` |
| **Gas Currency** | `BTC` | 18 decimals |
| **Default RPC** | `https://rpc.test.mezo.org` | Canonical endpoint |
| **Failover RPC** | `https://mezo-testnet.drpc.org` | Secondary provider |
| **Block Explorer** | `https://explorer.test.mezo.org` | Blockscout explorer |
| **Canonical MUSD** | `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` | Verified 18 decimals |

---

## 🛠 Tech Stack

- **Smart Contracts:** Solidity `^0.8.24`, Foundry (`forge`), OpenZeppelin Contracts (ReentrancyGuard, SafeERC20).
- **Web Application:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons.
- **Web3 Connectivity:** Wagmi v2, Viem, TanStack Query.
- **Database & ORM:** PostgreSQL, Drizzle ORM, Drizzle Kit.
- **Notification Services:** Telegram Bot API, secret-token header verification (not HMAC), single-use CSPRNG tokens. Constant-time enforcement and atomic consumption are release gates, not assumed guarantees.
- **Testing:** Foundry (Solidity unit and fuzz tests), Vitest (schemas, crypto, components), Playwright (desktop/mobile public-page smoke test).

---

## 📁 Repository Structure

```
├── contracts/                  # Foundry smart contract project
│   ├── src/
│   │   └── PactoraEscrow.sol   # Core milestone escrow implementation
│   ├── test/
│   │   ├── PactoraEscrow.t.sol # Unit, invariant, fuzz, & reentrancy test suite
│   │   └── mocks/              # MockERC20 & MaliciousERC20 for security testing
│   ├── script/
│   │   └── DeployPactoraEscrow.s.sol # Testnet deployment script
│   └── foundry.toml
├── app/                        # Next.js 15 App Router
│   ├── api/                    # Serverless API routes (auth, telegram, agreements)
│   ├── dashboard/              # User dashboard & agreement tracking
│   ├── agreements/
│   │   ├── create/             # Milestone builder & deployment form
│   │   └── [id]/               # Agreement timeline, submit/approve, mutual dispute
│   ├── receipts/[id]/          # Public verifiable audit receipt
│   ├── settings/telegram/      # Telegram account linking & notification center
│   └── help/                   # Documentation & testnet faucet guide
├── components/                 # Reusable UI components & Wagmi provider
├── lib/
│   ├── chain/                  # Mezo chain configuration & typed ABIs
│   ├── db/                     # Drizzle ORM schema & client
│   ├── security/               # Signed nonces, token hashing, crypto helpers
│   ├── telegram/               # Bot API client & notification message templates
│   └── validation/             # Zod input validation schemas
├── drizzle/                    # Generated SQL database migrations
└── docs/                       # Architecture, security, and demo specifications
    ├── architecture.md
    ├── security.md
    ├── demo-script.md
    └── network-config.md
```

---

## ⚡ Quickstart & Local Setup

### 1. Prerequisites
- **Node.js:** **22.x** (matches `engines.node`; pnpm can download the project-local runtime).
- **pnpm:** **12.14.0**, pinned in `packageManager`. Native build permissions are already configured in `pnpm-workspace.yaml`.
- **Foundry:** `forge` CLI installed using the [official installation guide](https://getfoundry.sh/introduction/installation/). On Windows, the executable may be under `$HOME\.foundry\bin\forge.exe`.
- **PostgreSQL Database:** (Local PostgreSQL or Supabase/Neon instance)

### 2. Clone and Install Dependencies
```powershell
git clone https://github.com/milesdevx/Pactora.git
Set-Location Pactora

# Install web dependencies
pnpm.cmd install --frozen-lockfile
```

### 3. Configure Environment Variables
Copy the template to your local environment file:
```powershell
Copy-Item .env.example .env.local
```
Fill in the required configuration variables:
```env
# Mezo Testnet (Chain ID 31611)
NEXT_PUBLIC_CHAIN_ID=31611
NEXT_PUBLIC_RPC_URL="https://rpc.test.mezo.org"
NEXT_PUBLIC_EXPLORER_URL="https://explorer.test.mezo.org"
NEXT_PUBLIC_MUSD_ADDRESS="0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503"
NEXT_PUBLIC_PACTORA_ESCROW_ADDRESS="0x..." # Updated upon contract deployment

# PostgreSQL Connection
DATABASE_URL="postgres://postgres:password@localhost:5432/pactora"

# Telegram Bot Integration
TELEGRAM_BOT_TOKEN="your_bot_token_from_botfather"
TELEGRAM_BOT_USERNAME="PactoraAlertsBot"
TELEGRAM_WEBHOOK_SECRET="random_secure_hex_secret_min_32_chars"
```

### 4. Database Setup
Generate and apply database migrations using Drizzle:
```powershell
# Development: apply the current schema directly
pnpm.cmd db:push

# Migration workflow: generate SQL, review it, then apply it
pnpm.cmd db:generate
pnpm.cmd db:migrate
```

### 5. Start Development Server
```powershell
pnpm.cmd dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing

### Smart Contract Tests (Foundry)
Execute the comprehensive test suite covering agreement creation, double-funding defense, milestone approval/rejection, reentrancy attacks, and mutual resolution invariants:
```bash
cd contracts
forge test -vv
```
Phase A run on **2026-11-07** from a clean temporary clone: **19 passed, 0 failed, 0 skipped**, including 256 fuzz runs. This is not an independent security audit.
- `test_CreateAgreement_Success`
- `test_CreateAgreement_Revert_ZeroAddress`
- `test_CreateAgreement_Revert_ZeroMilestoneAmount`
- `test_AcceptAgreement_Success`
- `test_AcceptAgreement_Revert_NotProvider`
- `test_FundAgreement_Success`
- `test_FundAgreement_Revert_NotClient`
- `test_FundAgreement_Revert_DoubleFunding`
- `test_SubmitMilestone_Success`
- `test_SubmitMilestone_Revert_NotProvider`
- `test_ApproveMilestone_Success`
- `test_ApproveMilestone_Revert_NotSubmitted`
- `test_ApproveMilestone_Revert_DuplicateApproval`
- `test_RejectAndResubmitMilestone_Success`
- `test_CancelUnfundedAgreement_Success`
- `test_CompleteAgreement_AllMilestonesApproved`
- `test_MutualConsentResolution_Success`
- `test_ReentrancyAttack_Reverts` (Validates `ReentrancyGuardReentrantCall()`)
- `testFuzz_MilestoneAmountsInvariant` (256 fuzz runs verifying conservation of escrow value)

### Web & Unit Tests (Vitest)
Run the TypeScript unit tests:
```powershell
pnpm.cmd test
```
Phase A run on **2026-11-07**: **11 passed, 0 failed**. Later phases must rerun the suites after changes.
- Validation schemas (Zod)
- Cryptographic nonce & token hashing
- UI component rendering and interaction

### Lint & Typecheck
```powershell
pnpm.cmd typecheck
pnpm.cmd lint
pnpm.cmd test
pnpm.cmd build
pnpm.cmd exec playwright install chromium
pnpm.cmd test:e2e
```

---

## 📦 Smart Contract Deployment to Mezo Testnet

To deploy `PactoraEscrow.sol` to Mezo Testnet using Foundry:

```powershell
Set-Location contracts
forge script script/DeployPactoraEscrow.s.sol:DeployPactoraEscrow `
  --rpc-url https://rpc.test.mezo.org `
  --chain-id 31611 `
  --broadcast `
  --legacy `
  --account pactora-testnet
```

Only the owner runs a redeploy, using a locally encrypted Foundry keystore. Never share a private key. Set the returned address in `NEXT_PUBLIC_PACTORA_ESCROW_ADDRESS` locally and in Vercel, then redeploy the web app because this value is inlined at build time.

OpenZeppelin and forge-std sources are committed under `contracts/lib/`; a fresh clone does not need `forge install` or a `.gitmodules` file. Run `forge build` and `forge test` from `contracts/`.

---

## 🤖 Telegram Bot Configuration & Webhook Setup

1. **Create Bot:** Use `@BotFather` and configure the actual `TELEGRAM_BOT_USERNAME` and server-only `TELEGRAM_BOT_TOKEN`.
2. **Set Webhook Secret:** Generate a random 32+ character hex string for `TELEGRAM_WEBHOOK_SECRET`.
3. **Register Webhook:** Use `curl.exe` with secrets loaded from your local environment, never literal credentials in shell history. Register the production `/api/telegram/webhook` URL using Telegram's `setWebhook` method and inspect `getWebhookInfo` for errors.
4. **Supported Commands:**
   - `/start` — Welcome message and instructions
    - `/start link_<token>` — Connect Telegram account to wallet address
    - `/agreements` - List linked agreement metadata
    - `/notifications` - Toggle notification preferences
   - `/unlink` — Disconnect Telegram account
   - `/help` — Protocol command guide

---

## 🔐 Security Architecture

- **Checks-Effects-Interactions:** State transitions are committed before external token operations.
- **Safe Token Transfers:** SafeERC20 wrapper mitigates non-standard ERC-20 return values.
- **Mutual Consent Settlement:** Invariant $\text{refund} + \text{release} == \text{escrowRemaining}$ protects accounting. It does not prevent funds being stuck when a party disappears.
- **Single-Use Linking Tokens:** Expire in 15 minutes and use SHA-256 hash storage.
- **Webhook Authentication:** Secret-token header verification, not HMAC. Constant-time verification is a required release gate.
- **SIWE-Style Signed Nonce:** Custom wallet authentication message, **not EIP-4361/SIWE compliant**. Replay protection and session authorization are required release gates.

This is testnet-only, unaudited software. Current source audit and live verification must finish before any submission claims of readiness.

For full threat models and analysis, see [docs/security.md](docs/security.md).

---

## 📄 License

This project is licensed under the [Apache License 2.0](LICENSE).
