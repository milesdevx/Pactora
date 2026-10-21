# Pactora — Milestone-Based MUSD Escrow for the Mezo Ecosystem

[![License: Apache 2.0](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![Mezo Testnet](https://img.shields.io/badge/Mezo%20Testnet-Chain%20ID%2031611-orange)](https://explorer.test.mezo.org)
[![Next.js](https://img.shields.io/badge/Next.js-15.5-black)](https://nextjs.org/)
[![Foundry](https://img.shields.io/badge/Foundry-Tested-blue)](https://getfoundry.sh/)

> **Work agreed. Funds protected. Payments verified.**  
> Pactora is a non-custodial milestone escrow and payment coordination protocol built specifically for freelancers, agencies, and clients operating within the Mezo ecosystem.

---

## 🚀 Key Highlights

- **Native to Mezo:** Built around Mezo's Bitcoin-based gas economics and canonical **MUSD** stablecoin.
- **Non-Custodial Escrow (`PactoraEscrow.sol`):** Funds are locked in smart contract escrow with OpenZeppelin `ReentrancyGuard` and strict mathematical invariants ($\sum \text{milestones} = \text{total}$).
- **Mutual Consent Settlement:** Cryptographic dispute engine requiring mutual agreement to resolve contested funds without centralized arbiter risk.
- **Real-Time Telegram Alerts:** Bidirectional bot integration delivering instant updates for milestone submissions, approvals, rejections, and fund releases.
- **Zero Mock Data:** Built with real Wagmi v2 + Viem hooks, live Mezo RPC integration, verified on-chain receipts, and authenticated single-use linking tokens.

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

- **Smart Contracts:** Solidity `^0.8.20`, Foundry (`forge`), OpenZeppelin Contracts (ReentrancyGuard, SafeERC20).
- **Web Application:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, Lucide Icons.
- **Web3 Connectivity:** Wagmi v2, Viem, TanStack Query.
- **Database & ORM:** PostgreSQL, Drizzle ORM, Drizzle Kit.
- **Notification Services:** Telegram Bot API, HMAC webhook authentication, single-use CSPRNG tokens.
- **Testing:** Foundry (19 Solidity unit & fuzz tests), Vitest (schemas, crypto, components).

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
- **Node.js:** `>= 18.18.0` (tested with v24)
- **pnpm:** `>= 9.0.0`
- **Foundry:** `forge` CLI installed (`curl -L https://foundry.paradigm.xyz | bash`)
- **PostgreSQL Database:** (Local PostgreSQL or Supabase/Neon instance)

### 2. Clone and Install Dependencies
```bash
git clone https://github.com/PactoraProtocol/pactora.git
cd pactora

# Install web dependencies
pnpm install

# Approve native build scripts if prompted
pnpm approve-builds --all
```

### 3. Configure Environment Variables
Copy the template to your local environment file:
```bash
cp .env.example .env.local
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
TELEGRAM_BOT_USERNAME="PactoraEscrowBot"
TELEGRAM_WEBHOOK_SECRET="random_secure_hex_secret_min_32_chars"
```

### 4. Database Setup
Generate and apply database migrations using Drizzle:
```bash
# Push schema to your database
pnpm db:push

# Or run migrations
pnpm db:generate
```

### 5. Start Development Server
```bash
pnpm dev

# On Windows PowerShell if script execution is restricted:
pnpm.cmd dev
# Or unrestrict execution policy:
# Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
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
**Test Results: 19 Passed, 0 Failed, 0 Skipped**
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
```bash
pnpm test
```
**Test Results: 11 Passed, 0 Failed**
- Validation schemas (Zod)
- Cryptographic nonce & token hashing
- UI component rendering and interaction

### Lint & Typecheck
```bash
pnpm lint
pnpm typecheck
```

---

## 📦 Smart Contract Deployment to Mezo Testnet

To deploy `PactoraEscrow.sol` to Mezo Testnet using Foundry:

```bash
cd contracts

forge script script/DeployPactoraEscrow.s.sol:DeployPactoraEscrow \
  --rpc-url https://rpc.test.mezo.org \
  --broadcast \
  --legacy \
  --private-key $DEPLOYER_PRIVATE_KEY
```

Once deployed, copy the output contract address to `NEXT_PUBLIC_PACTORA_ESCROW_ADDRESS` in `.env.local` and restart the web server.

---

## 🤖 Telegram Bot Configuration & Webhook Setup

1. **Create Bot:** Message `@BotFather` on Telegram, create a new bot (e.g. `@PactoraEscrowBot`), and obtain your `TELEGRAM_BOT_TOKEN`.
2. **Set Webhook Secret:** Generate a random 32+ character hex string for `TELEGRAM_WEBHOOK_SECRET`.
3. **Register Webhook:**
   ```bash
   curl -F "url=https://your-domain.vercel.app/api/telegram/webhook" \
        -F "secret_token=YOUR_TELEGRAM_WEBHOOK_SECRET" \
        https://api.telegram.org/botYOUR_TELEGRAM_BOT_TOKEN/setWebhook
   ```
4. **Supported Commands:**
   - `/start` — Welcome message and instructions
   - `/start link_<token>` — Connect Telegram account to wallet address
   - `/notifications` — View active notification status
   - `/unlink` — Disconnect Telegram account
   - `/help` — Protocol command guide

---

## 🔐 Security Architecture

- **Checks-Effects-Interactions:** State transitions are committed before external token operations.
- **Safe Token Transfers:** SafeERC20 wrapper mitigates non-standard ERC-20 return values.
- **Mutual Consent Settlement:** Invariant $\text{refund} + \text{release} == \text{escrowRemaining}$ prevents unauthorized capital leakage or fund entrapment.
- **Single-Use Linking Tokens:** Expire in 15 minutes and use SHA-256 hash storage.
- **Timing Attack Mitigation:** Webhook secrets are validated using `crypto.timingSafeEqual`.
- **SIWE-Compliant Nonces:** Wallet authentication uses single-use expiring nonces to prevent replay attacks.

For full threat models and analysis, see [docs/security.md](docs/security.md).

---

## 📄 License

This project is licensed under the [Apache License 2.0](LICENSE).