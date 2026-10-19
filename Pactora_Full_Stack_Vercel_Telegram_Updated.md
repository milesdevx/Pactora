# Pactora

## Updated Full-Stack Build Specification for Vercel + Telegram Bot + Mezo

**Revision:** UI, backend, tooling, and deployment architecture upgrade

**Product:** Pactora\
**Descriptor:** MUSD escrow for milestone payments\
**Tagline:** Work agreed. Funds protected. Payments verified.\
**Build target:** A production-minded MVP that can be deployed to Vercel
and connected to a Telegram bot, with Mezo Testnet support first.

> Important: This document is an implementation specification and
> coding-agent prompt. It does not claim that a live deployment, audited
> smart contract, verified MUSD address, or Telegram bot already exists.
> Verify all chain addresses and current Mezo documentation before
> deploying. Do not use mainnet funds until contracts have been
> independently reviewed.

------------------------------------------------------------------------

## 0. Required Design Skills and Local Setup

Run these commands from the project root in the coding environment you
use:

``` bash
npx skills add Leonxlnx/taste-skill
npx impeccable install
```

The Taste Skill repository also documents a focused frontend skill
install:

``` bash
npx skills add https://github.com/Leonxlnx/taste-skill --skill "design-taste-frontend"
```

Use the installed skills as design and review tools, not as substitutes
for implementation or testing. Taste Skill is particularly useful for
art direction and public-facing pages. Use Impeccable to initialize
design guidance and audit UI code for common design and accessibility
problems. Run `/impeccable init` inside a supported coding agent if its
installation guide recommends it. Confirm Node.js and browser
prerequisites in the current tool documentation.

### Recommended local environment

-   Node.js 22 or newer and pnpm.
-   Git and a public GitHub repository.
-   A supported AI coding agent with skill support.
-   Foundry for Solidity compilation and tests.
-   A Mezo testnet wallet and test funds.
-   Telegram account and bot created through BotFather.
-   Vercel account and a PostgreSQL provider account.

### Bootstrap the application

Use current stable package versions and commit the lockfile. Review
generated package scripts before running them.

``` bash
pnpm create next-app@latest pactora --typescript --tailwind --eslint --app --src-dir=false
cd pactora
pnpm dlx shadcn@latest init
pnpm add wagmi viem @tanstack/react-query zod react-hook-form @hookform/resolvers
pnpm add drizzle-orm postgres
pnpm add lucide-react
pnpm add -D drizzle-kit vitest @testing-library/react @testing-library/jest-dom playwright
```

Install and configure Foundry separately using its official
documentation. Initialize the Solidity project under `contracts/`. Keep
the app's package manager and lockfile consistent. If a command or
option has changed in a newer release, follow the current official
documentation instead of forcing an outdated command.

### Skill usage policy

1.  Read the installed skill instructions before implementing the
    design.
2.  Use Taste Skill for the landing page's art direction, typography,
    imagery, and distinctive brand presentation.
3.  Use Impeccable to define and audit interface quality, accessibility,
    and UI anti-patterns.
4.  Do not blindly apply public landing-page rules to the financial
    dashboard. Keep the dashboard calm, data-dense where useful, clear,
    accessible, and task-focused.
5.  Run the UI audit after implementation and fix real findings. Do not
    claim an audit passed unless it was run.

------------------------------------------------------------------------

## 1. Product Summary

Pactora helps clients and freelancers agree on work, divide it into
milestones, fund an agreement in MUSD, and release payments after
milestone approval. The escrow contract holds funds on-chain. The app
provides the agreement workflow, transaction status, event-based
receipts, and Telegram notifications.

### Core value

-   Clients can fund a defined scope of work without sending all payment
    directly to a provider.
-   Providers can see the agreed milestones and payment conditions
    before accepting.
-   Both parties can verify funding, approvals, releases, and refunds
    using on-chain transaction links.
-   Telegram notifications make milestone events harder to miss.

### Important positioning

Pactora is a payment coordination tool, not a law firm, licensed escrow
service, or guarantee of work quality. Do not advertise legal
arbitration, guaranteed recovery, or insurance unless those services
truly exist. The MVP uses clear on-chain rules and mutual-consent
dispute resolution.

------------------------------------------------------------------------

## 2. Buildathon Alignment

The Mezo buildathon requires meaningful MUSD and/or MEZO utility, a
working deployment on an accepted chain, a public GitHub repository, a
project deck, and a two-minute pitch video.

Pactora's intended integration: 1. Agreements are denominated and funded
in MUSD. 2. MUSD is transferred into a purpose-built escrow contract. 3.
Milestone releases and refunds are enforced by contract state. 4. App
receipts are based on contract events and transaction hashes. 5.
Telegram notifications are triggered by verified application/contract
events.

Use Mezo Testnet for the first release if supported by the current
official documentation. Verify chain ID, RPC URL, explorer URL, and
canonical MUSD contract address from official sources. Never hardcode an
unverified token address.

------------------------------------------------------------------------

## 3. Scope

### MVP features

-   Connect wallet using wagmi and viem.
-   Create a milestone agreement.
-   Invite a provider by shareable URL and/or Telegram deep link.
-   Provider reviews and accepts the agreement.
-   Client funds the escrow in MUSD.
-   Parties see milestones, due dates, amounts, status, and event
    history.
-   Provider submits a milestone for review.
-   Client approves and releases an approved milestone.
-   Client rejects a submission with a reason.
-   Cancel or refund only when contract rules permit.
-   Generate a public, read-only receipt/verifier page.
-   Telegram bot notifications for invites and important status changes.
-   Responsive dashboard, empty states, loading states, and transaction
    error recovery.
-   Testnet mode with clear labels and links to the correct block
    explorer.

### Explicitly out of scope for the MVP

-   Custody of users' private keys.
-   Off-chain holding of MUSD.
-   Automatic subjective judgement of work quality.
-   Legal arbitration or guaranteed dispute resolution.
-   Yield generation, lending, token launch, or speculative features.
-   Admin ability to arbitrarily move user funds.
-   Production mainnet deployment before security review.

------------------------------------------------------------------------

## 4. User Roles and Workflows

### Client

1.  Connect wallet.
2.  Create an agreement with provider address or invite link.
3.  Add title, description, currency, milestones, due dates, and
    approval window.
4.  Review the complete terms and confirm.
5.  Fund the contract with MUSD.
6.  Review submitted work.
7.  Approve a milestone to release the specified amount, or reject with
    a clear reason.
8.  Download/copy the transaction-backed receipt.

### Provider

1.  Open the invitation.
2.  Connect wallet and verify the agreement terms.
3.  Accept the agreement.
4.  Submit milestone notes and optional evidence URL.
5.  Follow status updates in the app or Telegram.
6.  Verify received payments through the transaction receipt.

### Dispute handling

For the MVP, disputes should be transparent and conservative: - Either
party can flag a milestone as disputed if the contract supports that
state. - Funds remain locked according to the contract's rules. -
Resolution requires the explicitly defined mutual-consent process or a
documented timeout/refund path. - Do not implement an admin backdoor or
imply independent arbitration. - Show exactly which actions are
available in each state.

------------------------------------------------------------------------

## 5. Recommended Architecture

### Recommended stack (use this as the source of truth)

**Frontend and server backend** - Next.js App Router with TypeScript,
using the current stable release. - React for UI components. - Tailwind
CSS for styling. - shadcn/ui and Radix primitives for accessible base
components. Customize the theme rather than shipping a generic
component-library look. - Framer Motion only for purposeful, lightweight
transitions. - wagmi + viem for wallet connection and EVM contract
calls. - TanStack Query for caching blockchain reads and remote data. -
React Hook Form + Zod for forms and runtime validation. - Lucide icons,
used consistently. - Vitest + React Testing Library for unit/component
tests. - Playwright for browser and end-to-end tests.

**Backend** - TypeScript on Node.js through Next.js Route Handlers
(`app/api/**/route.ts`). - PostgreSQL on Neon or Supabase. - Drizzle ORM
for typed database access and migrations. - Zod validation at every API
boundary. - Server-only modules for secrets, Telegram API calls,
database access, and signed-message verification. - Vercel Functions for
short-lived API/webhook work. Use Vercel Cron or an external
queue/scheduler for scheduled jobs. Do not rely on in-memory state or
permanent background processes.

**Smart contracts** - Solidity + Foundry. - OpenZeppelin libraries where
appropriate, after reviewing versions and compatibility. - viem/wagmi
integration from the frontend. - Contract events are the source for
verified payment history. Database records are metadata and notification
state, never the authority for escrow balances.

**Why this stack:** TypeScript covers the UI and API, Next.js deploys
naturally to Vercel, PostgreSQL stores account and notification
metadata, and Solidity handles trust-minimized MUSD escrow. Do not
introduce Python, a separate Express server, or extra infrastructure
unless a measured requirement justifies it.

### Deployment model

-   Vercel hosts the Next.js app, Route Handlers, and Telegram webhook.
-   Neon or Supabase Postgres stores linked Telegram accounts,
    preferences, one-time linking tokens, and idempotent notification
    jobs.
-   The blockchain remains the source of truth for escrow balances,
    milestone states, and releases.
-   A webhook/API call must not be treated as proof of a confirmed
    transaction. Verify a transaction receipt or read contract state
    before sending a confirmed notification.
-   Use Vercel Cron or a managed queue for bounded, idempotent scheduled
    jobs. Never assume serverless memory persists between invocations.

### Smart contracts

-   Solidity with Foundry.
-   ERC-20-compatible MUSD token interface.
-   A `PactoraEscrow` contract for agreement and milestone state.
-   Reentrancy protection, safe token transfer helpers, custom errors,
    events, and strict state transitions.
-   No upgradeability in the first MVP unless there is a clear, reviewed
    reason.

### Telegram

-   Telegram Bot API.
-   A webhook endpoint hosted on Vercel.
-   A deep link from the app to the bot for account linking.
-   Store Telegram chat/user identifiers only after explicit user
    interaction and consent.
-   Never ask for seed phrases, private keys, or wallet signatures
    through Telegram messages.

------------------------------------------------------------------------

## 6. Suggested Repository Layout

``` text
pactora/
├── app/
│   ├── (marketing)/
│   ├── (dashboard)/
│   ├── agreements/[id]/
│   ├── receipts/[id]/
│   ├── settings/telegram/
│   ├── api/telegram/webhook/route.ts
│   ├── api/telegram/link/route.ts
│   └── layout.tsx
├── components/
│   ├── ui/
│   ├── layout/
│   ├── agreements/
│   ├── milestones/
│   └── wallet/
├── lib/
│   ├── auth/
│   ├── db/
│   ├── telegram/
│   ├── chain/
│   ├── validation/
│   └── security/
├── drizzle/
├── contracts/
│   ├── src/PactoraEscrow.sol
│   ├── test/
│   └── script/
├── public/
├── tests/
│   ├── unit/
│   └── e2e/
├── docs/
│   ├── architecture.md
│   ├── security.md
│   ├── network-config.md
│   └── demo-script.md
├── .env.example
├── drizzle.config.ts
├── next.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

For a simpler first deployment, the bot webhook can live in
`apps/web/api/telegram/webhook.ts` as a Vercel Function. Keep bot logic
modular so it can be moved to a separate service later.

------------------------------------------------------------------------

## 7. Smart Contract Design

### Agreement data

Store only the minimum data needed on-chain: - client address - provider
address - ERC-20 token address - total funded amount - milestone amounts
and states - accepted/cancelled/completed state - timestamps and
approval deadlines where relevant

Store large descriptions and evidence off-chain. Emit a hash or URI when
a verifiable reference is needed. Warn users that public blockchain data
is not private.

### Candidate contract interface

The final interface must be reviewed against the chosen data model and
gas limits.

``` solidity
function createAgreement(
    address provider,
    address token,
    uint256[] calldata milestoneAmounts,
    bytes32 termsHash
) external returns (uint256 agreementId);

function acceptAgreement(uint256 agreementId) external;

function fundAgreement(uint256 agreementId) external;

function submitMilestone(
    uint256 agreementId,
    uint256 milestoneId,
    bytes32 submissionHash
) external;

function approveMilestone(
    uint256 agreementId,
    uint256 milestoneId
) external;

function rejectMilestone(
    uint256 agreementId,
    uint256 milestoneId,
    bytes32 reasonHash
) external;

function requestCancellation(uint256 agreementId) external;

function resolveByMutualConsent(
    uint256 agreementId,
    uint256[] calldata releaseAmounts
) external;
```

This interface is illustrative, not audited. The implementer must define
exact state transitions and ensure every external function is safe. Do
not deploy this interface without a complete implementation, tests, and
review.

### Required contract rules

-   Only the client can fund an agreement.
-   Only the named provider can accept and submit milestones.
-   Only the client can approve or reject submitted milestones.
-   A milestone can be paid at most once.
-   Total releases plus remaining refundable balance must never exceed
    the funded balance.
-   Token address must be allowlisted or otherwise validated.
-   Reject zero addresses and invalid milestone amounts.
-   Enforce a clear total amount and milestone sum invariant.
-   Use checks-effects-interactions and reentrancy protection.
-   Use safe ERC-20 transfers.
-   Emit events for creation, acceptance, funding, submission, approval,
    rejection, cancellation, refund, and completion.
-   No arbitrary owner withdrawal of user escrow funds.
-   Avoid an unrestricted pause function that could permanently trap
    user funds.
-   Clearly define what happens if a provider never accepts, work is
    never submitted, or the client becomes unresponsive.
-   Test fee-on-transfer and non-standard ERC-20 behavior or explicitly
    reject unsupported tokens.

### Minimum contract tests

-   Agreement creation validation.
-   Acceptance by provider only.
-   Funding with approved MUSD.
-   Funding twice is rejected.
-   Invalid token rejected.
-   Incorrect milestone totals rejected.
-   Milestone submission by provider only.
-   Approval by client only.
-   Rejected milestone cannot be released.
-   Duplicate release is impossible.
-   Cancellation/refund follows exact rules.
-   Mutual-consent resolution requires both parties' consent if
    implemented in two steps.
-   Reentrancy attempt cannot drain funds.
-   Events contain the correct IDs, parties, and amounts.
-   Fuzz/invariant test: escrow balance is never less than obligations.

------------------------------------------------------------------------

## 8. Telegram Bot Specification

### Bot capabilities

-   `/start` --- explain Pactora and provide the app link.
-   `/help` --- list commands and support information.
-   `/link` --- begin wallet-account linking through a one-time,
    expiring token.
-   `/agreements` --- show a short list of linked agreements, if the
    user has linked an account.
-   `/notifications` --- allow the user to opt in or out.
-   `/unlink` --- remove the Telegram-to-account link.
-   Event notifications --- invite received, agreement accepted, funding
    confirmed, milestone submitted, milestone approved, payment
    released, refund completed, and transaction failure.

### Safe account linking

1.  User opens Pactora and connects a wallet.
2.  User clicks "Link Telegram".
3.  Server creates a cryptographically random one-time token with a
    short expiry.
4.  App opens `https://t.me/<BOT_USERNAME>?start=<token>`.
5.  Bot receives the token and sends it to the server for validation.
6.  Server marks the token as consumed and binds the Telegram ID to the
    authenticated wallet account.
7.  Tokens must be single-use, short-lived, rate-limited, and stored
    hashed where practical.
8.  Provide an unlink action and notification consent controls.

Never trust a wallet address sent as plain text in Telegram as proof of
ownership. For stronger linking, require a signed nonce from the
connected wallet and verify the signature server-side.

### Webhook rules

-   Set a Telegram webhook to a secret URL path or verify Telegram's
    `X-Telegram-Bot-Api-Secret-Token` header.
-   Reject requests with a missing or invalid secret.
-   Validate payload shape before processing.
-   Respond quickly and make processing idempotent.
-   Never log bot tokens or one-time link tokens.
-   Do not include private agreement details in notifications unless the
    user has opted in.
-   Notifications should link to the app's public agreement page and a
    block explorer transaction, when available.

### Example notification

"Pactora: Milestone 2 was submitted for agreement #123. Review it in
Pactora: `<APP_URL>`{=html}/agreements/123"

Do not claim a transaction is confirmed merely because the frontend
initiated it. Confirm using a receipt or trusted chain read before
sending "confirmed" notifications.

------------------------------------------------------------------------

## 8A. Backend API Contract

Implement typed Next.js Route Handlers. Keep database access, Telegram
calls, and secrets in server-only modules.

Suggested routes: - `POST /api/telegram/link` --- create an expiring
one-time link token for an authenticated wallet session. -
`POST /api/telegram/webhook` --- validate Telegram's secret header,
deduplicate update IDs, and process commands. -
`POST /api/notifications/test` --- development-only notification test,
disabled in production unless explicitly authorized. - `GET /api/health`
--- return service health without revealing secrets, database URLs, or
internal configuration. - Optional `POST /api/events/ingest` --- accept
events only from a trusted indexer or authenticated internal process;
never trust a browser-posted event as proof of payment.

Every route must: - Validate input with Zod. - Return consistent JSON
errors and appropriate HTTP status codes. - Apply rate limits to linking
and notification actions. - Avoid logging private data, tokens,
signatures, or bot credentials. - Use server-side authentication and
authorization for account-specific records. - Be idempotent when
processing Telegram updates and blockchain notifications. - Return only
the minimum information required by the caller.

For wallet authentication, use a signed nonce with expiry and domain
separation. Verify the signature on the server, mark the nonce as
consumed, and bind the session to the verified wallet. Do not trust a
wallet address sent in a JSON body.

### Telegram event reliability

A serverless webhook may be retried. Use a unique event key, persisted
delivery state, bounded retries, and backoff. Confirm the transaction
from a trusted RPC/indexer before notifying users that a release
succeeded. If an event cannot be verified, label it pending or unknown
rather than confirmed.

------------------------------------------------------------------------

## 9. Database Model

The database stores application metadata only. Contract state is
authoritative.

Suggested tables: - `users`: internal ID, wallet address, created
time. - `telegram_links`: user ID, Telegram ID, linked time,
notification preference. - `telegram_link_tokens`: token hash, user ID,
expiry, consumed time. - `notification_jobs`: event key, recipient,
payload, status, attempts, timestamps. - `agreement_metadata`: on-chain
agreement ID, terms URI, display title, evidence references. -
`webhook_events`: unique update/event ID, processed time, status.

Requirements: - Unique constraint for Telegram update IDs to prevent
duplicate processing. - Unique constraint for wallet addresses after
normalization. - Encrypt sensitive fields if any are required. - Keep
secrets in environment variables, never in the frontend bundle. -
Provide data deletion and unlink flows. - Document data retention.

------------------------------------------------------------------------

## 9A. Premium UI Requirements

Treat this section as the design acceptance standard.

### Art direction

Build a distinctive, trustworthy fintech product. Use a warm neutral
canvas, ink/navy text, a restrained emerald/teal accent, and carefully
controlled amber/red only for warnings or destructive states. Avoid
generic purple gradients, excessive glassmorphism, glowing cards, giant
rounded cards everywhere, random decorative blobs, and default
AI-generated dashboard patterns.

Use a strong typographic hierarchy with a refined display face for major
marketing headlines and a highly legible sans-serif for interface data.
Use a consistent spacing scale, consistent radii, clear borders, and
meaningful negative space. Do not use color alone to communicate state.

### Landing page

-   A clear hero headline explaining milestone payments, not vague
    crypto slogans.
-   Primary action: "Create an agreement".
-   Secondary action: "Explore how it works".
-   A three-step visual workflow: Agree → Fund with MUSD → Release by
    milestone.
-   A real product preview built from actual components, not a fake
    screenshot.
-   Security and testnet disclosure near wallet actions.
-   A concise FAQ, supported network details, and a clear footer.
-   Use licensed imagery only when it contributes meaningfully. Prefer
    product UI and simple custom diagrams over stock-photo decoration.

### Dashboard

-   Persistent top bar with network status, wallet control, and user
    menu.
-   Compact left navigation on desktop and accessible mobile navigation.
-   Overview metrics only when they can be calculated from real data.
-   Agreement table/list with status, counterparty, funded amount, next
    action, and updated time.
-   A prominent "Needs your action" section for milestone reviews.
-   Useful skeletons, empty states, retry controls, and transaction
    progress.
-   No fabricated balances, agreement counts, activity, ratings, or
    analytics.

### Agreement workspace

-   Agreement summary and terms at the top.
-   A vertical milestone timeline with amount, state, due date,
    submitted evidence, and available action.
-   Separate clear actions for approve, reject, and permitted
    cancellation.
-   Show wallet transaction states and block-explorer links.
-   Before any money-moving action, display token, amount, recipient,
    network, and irreversible consequences.
-   Confirmations must explain what will happen, not use vague "Are you
    sure?" copy.

### Interaction and accessibility

-   Keyboard navigation and visible focus states.
-   WCAG AA color contrast target.
-   Accessible labels and error descriptions.
-   Reduced-motion support.
-   Respectful motion, typically 150--250 ms for small transitions.
-   Avoid layout shift, horizontal overflow, tiny click targets, and
    hover-only information.
-   Use realistic loading and error states; never fake a completed
    transaction.
-   Test at 360px mobile, tablet, and wide desktop widths.

### UI quality gate

Before release: 1. Run lint and type checks. 2. Run unit and Playwright
tests. 3. Run Impeccable's UI detector on the relevant source folders.
4. Fix all severe accessibility and usability issues. 5. Manually
inspect the landing page, dashboard, agreement flow, wallet modal, and
mobile layouts. 6. Record any known issues in the README instead of
hiding them.

------------------------------------------------------------------------

## 10. UI and Design Direction

### Visual system

-   Premium, trustworthy financial product.
-   Dark navy foundation, clean white surfaces, restrained teal accents.
-   Clear typography, generous spacing, strong contrast.
-   Avoid unnecessary gradients, fake activity, fake balances, or
    fabricated user counts.
-   Responsive from mobile to desktop.
-   Accessible focus states, keyboard navigation, labels, and error
    messages.

### Required screens

1.  Landing page --- product promise, workflow, risks, supported
    network.
2.  Dashboard --- active agreements, pending reviews, recent on-chain
    activity.
3.  Create agreement --- provider, title, terms, milestone amounts, due
    dates.
4.  Agreement workspace --- funding, milestones, submissions, approvals,
    event history.
5.  Receipt/verifier --- agreement status, contract address, transaction
    hashes, block explorer links.
6.  Wallet/network panel --- connected wallet and current chain.
7.  Telegram settings --- link, unlink, notification preferences.
8.  Help and safety --- explain that users must verify addresses and
    transaction details.

### UX rules

-   Always show the selected network and token contract.
-   Label testnet clearly and use test-token disclaimers.
-   Show transaction pending, confirmed, reverted, and rejected states.
-   Disable duplicate actions while a transaction is pending.
-   Show exact token amount and destination before a wallet
    confirmation.
-   Never say "success" before the chain confirms.
-   Use readable empty states and actionable error messages.

------------------------------------------------------------------------

## 11. Environment Variables

Create `.env.example` with placeholders only. Never commit real secrets.

``` bash
# Public configuration only. NEXT_PUBLIC_* values are exposed to browsers.
NEXT_PUBLIC_APP_URL=https://your-project.vercel.app
NEXT_PUBLIC_CHAIN_ID=
NEXT_PUBLIC_RPC_URL=
NEXT_PUBLIC_EXPLORER_URL=
NEXT_PUBLIC_MUSD_ADDRESS=
NEXT_PUBLIC_PACTORA_ESCROW_ADDRESS=
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=

# Server-only secrets. NEVER prefix these with NEXT_PUBLIC_.
DATABASE_URL=
TELEGRAM_BOT_TOKEN=
TELEGRAM_BOT_USERNAME=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_WEBHOOK_URL=https://your-project.vercel.app/api/telegram/webhook
APP_URL=https://your-project.vercel.app
LINK_TOKEN_SECRET=
RATE_LIMIT_SECRET=

# Optional monitoring/indexing
SENTRY_DSN=
```

Do not expose `TELEGRAM_BOT_TOKEN`, `DATABASE_URL`, webhook secrets, or
link-token secrets as `NEXT_PUBLIC_` variables. Next.js exposes
`NEXT_PUBLIC_` variables to browser code.

Do not assume the Mezo Testnet chain ID, RPC URL, explorer URL, or MUSD
address. Obtain them from current official Mezo documentation and verify
the contract before adding values.

------------------------------------------------------------------------

## 11A. Required package scripts

Configure package scripts equivalent to these. Adjust names to match the
final project layout:

``` json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:e2e": "playwright test",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
  }
}
```

Do not add scripts that point to files that do not exist. Add the
relevant Playwright and Foundry commands after their configuration is
committed. The release gate should run lint, typecheck, unit tests,
contract tests, and a production build.

### Local run checklist

``` bash
pnpm install
cp .env.example .env.local
# Fill in verified testnet configuration and local database credentials.
pnpm db:generate
pnpm db:migrate
pnpm dev
```

Run Foundry tests from `contracts/` using the documented project
scripts. Never put real production secrets in `.env.example` or commit
`.env.local`.

------------------------------------------------------------------------

## 12. Vercel Deployment

### Frontend deployment

1.  Push the repository to a public GitHub repository.
2.  Import the repository into Vercel.
3.  Set the correct root directory and build command for the selected
    workspace.
4.  Add frontend environment variables in Vercel Project Settings.
5.  Deploy a preview build first.
6.  Test wallet connection, chain switching, agreement creation, and
    transaction receipts.
7.  Promote to production only after the testnet checklist passes.

### API routes

-   Keep Telegram webhook logic in `app/api/telegram/webhook/route.ts`.
-   Set the webhook secret and bot token in Vercel server-only
    environment variables.
-   Configure the Telegram webhook to the production URL.
-   Ensure the endpoint responds within Telegram's timeout.
-   Use a database or queue for work that may exceed a short request.
-   Do not rely on in-memory state between function invocations.

### Telegram webhook setup

After deploying the API route, configure the webhook with Telegram's
official Bot API using a secure server-side script or admin command. Do
not paste the bot token into a public README, frontend code, or browser
console. Verify webhook status and test `/start`, `/help`, linking,
unlinking, and a notification.

### Production checklist

-   HTTPS enabled.
-   Correct environment variables for the deployment environment.
-   Webhook secret validation enabled.
-   Database migrations applied.
-   Contract addresses verified and matched to the deployed network.
-   CORS and rate limits configured where relevant.
-   Error monitoring enabled without secrets in logs.
-   A rollback plan exists.

------------------------------------------------------------------------

## 13. Security and Privacy Checklist

-   No private keys or seed phrases are ever collected.
-   No admin function can arbitrarily withdraw escrow funds.
-   All money-moving functions are tested and reviewed.
-   Token and chain addresses are displayed and validated.
-   Signatures use a nonce, expiry, and domain separation.
-   Telegram link tokens are single-use and expire quickly.
-   Webhook events are authenticated and idempotent.
-   API inputs are schema-validated.
-   Rate-limit account linking and notification endpoints.
-   Escape user-generated content to prevent injection.
-   Avoid putting sensitive information on-chain.
-   Explain that blockchain transactions and addresses are public.
-   Include a risk disclosure and support contact.
-   Conduct a security review before mainnet use.

------------------------------------------------------------------------

## 14. Test Plan

### Frontend

-   Create agreement form validation.
-   Wrong network handling.
-   Wallet disconnected state.
-   Wallet rejected transaction.
-   Pending and confirmed transaction states.
-   Empty dashboard.
-   Mobile responsive layouts.
-   Accessible keyboard navigation.

### API and bot

-   Missing/incorrect webhook secret rejected.
-   Duplicate Telegram update is ignored.
-   Invalid or expired link token rejected.
-   Reused token rejected.
-   Unlinked user cannot see private account data.
-   Bot token is never returned in an API response.
-   Telegram API failure is retried safely.
-   Notification preference is respected.

### End-to-end demo

1.  Connect test wallet.
2.  Create an agreement with two milestones.
3.  Provider accepts.
4.  Client approves MUSD and funds the agreement.
5.  Verify funding from a chain receipt.
6.  Provider submits milestone one.
7.  Client approves and releases milestone one.
8.  Confirm Telegram notification.
9.  Open the public receipt page and verify transaction links.
10. Show remaining balance and final agreement status.

------------------------------------------------------------------------

## 15. Build Sequence

### Phase 1: Validate the chain

-   Read current Mezo developer documentation.
-   Confirm network settings and canonical MUSD address.
-   Deploy a tiny test contract or run a fork/local integration test.
-   Record verified settings in `docs/network-config.md`.

### Phase 2: Contracts

-   Implement agreement and milestone state machine.
-   Write unit, negative, fuzz, and invariant tests.
-   Deploy to testnet.
-   Verify source code if an explorer supports verification.
-   Save the deployment address and transaction hash.

### Phase 3: Web app

-   Build design system and page structure.
-   Implement wallet/network states.
-   Connect contract reads and writes.
-   Add receipts from real events.
-   Test responsive and error states.

### Phase 4: Telegram

-   Create bot through BotFather.
-   Implement `/start`, `/help`, `/link`, `/unlink`, and preferences.
-   Build one-time linking and signature verification.
-   Configure authenticated webhook.
-   Send notifications only after verified events.

### Phase 5: Release

-   Deploy web app and API routes to Vercel.
-   Run complete testnet demo.
-   Publish public GitHub repository and README.
-   Create project deck and two-minute demo video.
-   Submit live link, repo, deck, video, track, status, and milestones
    to AKINDO.

------------------------------------------------------------------------

## 16. AKINDO Submission Draft

**Project name:** Pactora

**Category:** MUSD milestone payment escrow

**TL;DR:** Pactora lets clients and freelancers agree on milestones,
fund work in MUSD on Mezo, and release payments through transparent
on-chain approvals.

**How it works:** A client creates an agreement with milestone amounts
and terms. The provider accepts, the client funds the escrow with MUSD,
and each approved milestone releases its specified amount. Contract
events create verifiable receipts, while a Telegram bot sends opt-in
notifications for important updates.

**Target group:** Freelancers, independent developers, designers, small
agencies, and clients who need transparent milestone payments. Mobile
and desktop users, starting with crypto-native users and expanding to
less experienced users through a guided interface.

**Tech stack:** Next.js, React, TypeScript, Tailwind CSS, shadcn/ui,
wagmi, viem, Solidity, Foundry, Vercel Route Handlers, Telegram Bot API,
PostgreSQL, and Drizzle ORM.

**Track:** Select the official track that best matches the current
AKINDO challenge. Do not guess track names.

**Chain deployed on:** Mezo Testnet, only after successful deployment
and verification.

**Project status:** New project, if built from scratch during the
hackathon.

**Project readiness:** Testnet deployment only after it is live and
functional. Otherwise mark demo only.

**Future milestones:** 1. Weeks 1--2: finish testnet MVP, contract
tests, and Telegram linking. 2. Weeks 3--4: independent contract review,
usability testing, and improvements. 3. Weeks 5--8: evaluate mainnet
readiness, add more wallet flows, and onboard pilot users.

Only claim features that are implemented and demonstrable. For a Wave 2
resubmission, list concrete changes since Wave 1 with links to commits,
deployments, and demo evidence.

------------------------------------------------------------------------

## 17. Two-Minute Pitch Outline

**0:00--0:15 --- Problem**\
Freelancers and clients often rely on trust, screenshots, and manual
follow-ups to coordinate milestone payments.

**0:15--0:35 --- Solution**\
Pactora creates a shared agreement with clear milestones and funds it
using MUSD on Mezo.

**0:35--1:10 --- Live demo**\
Create an agreement, fund it, submit a milestone, approve a release, and
show the on-chain receipt.

**1:10--1:30 --- Telegram**\
Show an opt-in Telegram notification after a verified event. Explain
that Telegram informs users but does not custody funds.

**1:30--1:50 --- Mezo utility and viability**\
Explain why MUSD is central to funding and releasing milestone payments,
and identify the initial users and adoption plan.

**1:50--2:00 --- Roadmap**\
State what is working now, what remains, and the next security and pilot
milestones.

Do not use fake metrics, fabricated customer quotes, or a simulated
transaction presented as live.

------------------------------------------------------------------------

## 18. Definition of Done

-   [ ] Current Mezo network and MUSD details verified from official
    documentation.
-   [ ] Escrow contract implemented and tests pass.
-   [ ] Contract deployed to the selected testnet.
-   [ ] Contract address and transaction links are published.
-   [ ] Wallet connection and MUSD funding work end to end.
-   [ ] Milestone submission and release work end to end.
-   [ ] Telegram bot works with authenticated webhook.
-   [ ] Account linking is secure, revocable, and tested.
-   [ ] Notifications only follow verified events.
-   [ ] Vercel production URL works over HTTPS.
-   [ ] Public GitHub repository has setup instructions and
    `.env.example`.
-   [ ] README explains risks, testnet status, and known limitations.
-   [ ] Deck and two-minute pitch video are ready.
-   [ ] No secrets, fake data, or unsupported claims are published.

------------------------------------------------------------------------

## 19. Official References to Verify Before Building

-   Mezo developer documentation: https://mezo.org/docs/developers/
-   Mezo Testnet app: https://testnet.mezo.org
-   Mezo Testnet faucet: https://faucet.test.mezo.org/
-   Mezo GitHub organization: https://github.com/mezo-org/
-   Mezo Discord: https://discord.mezo.org
-   Telegram Bot API: https://core.telegram.org/bots/api
-   Telegram deep linking:
    https://core.telegram.org/bots/features#deep-linking
-   Vercel documentation: https://vercel.com/docs
-   Foundry documentation: https://book.getfoundry.sh/

**Final instruction to the implementation agent:** Build the working
product, not just the screens. Verify the official chain configuration,
implement and test the contract state machine, wire the frontend to real
contract calls, implement the Telegram webhook and secure account
linking, and document every required environment variable. If a feature
is incomplete, label it honestly rather than showing fake success.

## 20. Design Tool References

-   Taste Skill repository and install guide:
    https://github.com/Leonxlnx/taste-skill
-   Taste Skill documentation: https://www.tasteskill.dev/docs
-   Impeccable CLI and installation guide:
    https://www.npmjs.com/package/impeccable
-   Next.js documentation: https://nextjs.org/docs
-   shadcn/ui documentation: https://ui.shadcn.com/docs
-   Tailwind CSS documentation: https://tailwindcss.com/docs
-   Drizzle ORM documentation: https://orm.drizzle.team/docs/overview
-   Neon documentation: https://neon.tech/docs
-   wagmi documentation: https://wagmi.sh/
-   viem documentation: https://viem.sh/
-   Foundry documentation: https://book.getfoundry.sh/

## 21. Final Instruction to the Coding Agent

Build a functioning full-stack product, not a static prototype. Use
Next.js + TypeScript for the web application and API, PostgreSQL +
Drizzle for application metadata, Solidity + Foundry for escrow, wagmi +
viem for wallet interactions, and Telegram's authenticated webhook for
notifications. Apply the installed design skills, but make final design
decisions appropriate for a serious financial product. Keep chain state
authoritative, verify all Mezo configuration from official sources, test
every money-moving path, and deploy to Vercel only after the complete
testnet flow passes. Never claim deployment, security review, UI audit,
or tests succeeded unless they actually did.
