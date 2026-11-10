# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, PostgreSQL, Drizzle ORM, Solidity, Foundry, wagmi, viem, Telegram Bot API, Vercel.

## Target Users

1. **Clients**: Founders, product owners, and managers hiring freelance contractors or agencies who need to lock payment in escrow with clear milestone-based releases.
2. **Providers**: Freelancers, contractors, developers, and designers delivering work who need verified proof of locked funds before starting and transparent approvals.

## Product Purpose

Pactora coordinates milestone-based agreements, holds escrow funds on-chain in Mezo's Bitcoin-backed MUSD stablecoin, releases payments upon verified client approval, and alerts parties via opt-in Telegram notifications.

## Positioning

Pactora is a payment coordination and milestone escrow tool on Mezo Testnet. It does not hold wallet keys or judge deliverable quality; it relies on on-chain rules, verifiable receipts and mutual consent. Testnet only. Unaudited. No subjective dispute arbitration.

## Operating Context

- Web3 crypto-native and hybrid freelancers/clients working asynchronously across time zones.
- Mobile and desktop access with Telegram bot deep linking and best-effort confirmed-event alerts.
- Blockchain execution on Mezo Testnet (Chain ID `31611`) with MUSD ERC-20 token.

## Capabilities and Constraints

- **On-chain Escrow**: Agreements funded in MUSD held by `PactoraEscrow.sol`.
- **Milestone Workflow**: Provider acceptance -> Separate allowance and deposit -> Provider submission -> Client approval/rejection or eligible timeout/refund -> Completed if fully settled with no cumulative refund, otherwise Cancelled. Mutual settlement is hash-bound, not subjective arbitration.
- **Telegram Bot**: Signed-session linking through `/start link_<token>`, `/start`, `/help`, `/balance`, `/agreements`, `/pending`, `/getmusd`, `/unlink`, `/notifications`. Bot identity/webhook and V2 app address cutover were verified on 2026-11-10 UTC. Pending verification: actual private-chat linking/commands/alerts. `/link` is not a command.
- **Receipts**: Public read-only verifiable receipt page tied directly to on-chain transaction hashes and explorer links.
- **No fake transaction success**: Application balances and transactions must come from the chain. The homepage preview is labelled "Illustration, not real funds" and sends no transactions.

## Brand Commitments

- **Name**: Pactora
- **Descriptor**: MUSD escrow for milestone payments
- **Tagline**: Work agreed. Funds protected. Payments verified.
- **Visual Tone**: Professional fintech, dark navy ground, warm neutral surfaces, restrained teal accent.

## Evidence on Hand

- Verified Mezo Testnet configuration (`Chain ID 31611`, RPC `https://rpc.test.mezo.org`, Explorer `https://explorer.test.mezo.org`).
- Verified MUSD Testnet contract: `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`.
- Brand assets: [wordmark](public/logo.svg), [vector mark](public/pactora-mark.svg) and [favicon](app/icon.svg).
- Current verification record: [deployments](docs/deployments.md); the real V2 create/accept run is unfunded, not a completed payment. Pending verification: full funding/delivery/approval/payout.

## Product Principles

1. **Chain State is Authoritative**: The smart contract governs escrow accounting, milestone states and releases; the database holds metadata and auth/link/delivery records, not authoritative balances.
2. **Never Fabricate Success**: Transactions and states reflect confirmed on-chain events only.
3. **Restrained Financial Clarity**: No distracting decorative crypto tropes; every action highlights amounts, addresses, networks, and irreversibility.
4. **Defense in Depth**: Webhook secret verification, idempotent processing, single-use linking tokens, cryptographic signatures for auth.

## Accessibility & Inclusion

Target WCAG 2.1 AA compliance, visible focus states, full keyboard navigation, high contrast text, and responsive design down to 360px mobile viewports.
