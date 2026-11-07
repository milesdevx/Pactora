# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Next.js App Router, TypeScript, Tailwind CSS, shadcn/ui, PostgreSQL, Drizzle ORM, Solidity, Foundry, wagmi, viem, Telegram Bot API, Vercel.

## Users

1. **Clients**: Founders, product owners, and managers hiring freelance contractors or agencies who need to lock payment in escrow with clear milestone-based releases.
2. **Providers**: Freelancers, contractors, developers, and designers delivering work who need verified proof of locked funds before starting and transparent approvals.

## Product Purpose

Pactora coordinates milestone-based agreements, holds escrow funds on-chain in Mezo's Bitcoin-backed MUSD stablecoin, releases payments upon verified client approval, and alerts parties via opt-in Telegram notifications.

## Positioning

Pactora is a payment coordination and trust-minimized milestone escrow tool on the Mezo network. It does not act as a licensed custodian, legal arbitrator, or subjective judge of quality—instead relying on transparent on-chain rules, verifiable blockchain receipts, and mutual consent.

## Operating Context

- Web3 crypto-native and hybrid freelancers/clients working asynchronously across time zones.
- Mobile and desktop access with Telegram bot deep linking for real-time notifications.
- Blockchain execution on Mezo Testnet (Chain ID `31611`) with MUSD ERC-20 token.

## Capabilities and Constraints

- **On-chain Escrow**: Agreements funded in MUSD held by `PactoraEscrow.sol`.
- **Milestone Workflow**: Provider acceptance -> Client MUSD funding -> Provider submission with evidence -> Client approval & release or rejection with reason -> Final completion or mutual-consent cancellation.
- **Telegram Bot**: Signed-session linking through `/start link_<token>`, `/start`, `/help`, `/balance`, `/agreements`, `/pending`, `/getmusd`, `/unlink`, `/notifications`. New commands are implemented locally; live verification awaits deployment. `/link` is not a command.
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
- Brand icon asset: `icon.jpg` in repository root.

## Product Principles

1. **Chain State is Authoritative**: The smart contract governs all balances, milestone states, and releases; the database holds metadata only.
2. **Never Fabricate Success**: Transactions and states reflect confirmed on-chain events only.
3. **Restrained Financial Clarity**: No distracting decorative crypto tropes; every action highlights amounts, addresses, networks, and irreversibility.
4. **Defense in Depth**: Webhook secret verification, idempotent processing, single-use linking tokens, cryptographic signatures for auth.

## Accessibility & Inclusion

Target WCAG 2.1 AA compliance, visible focus states, full keyboard navigation, high contrast text, and responsive design down to 360px mobile viewports.
