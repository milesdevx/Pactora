![Pactora](public/logo.svg)

# Pactora

Milestone-based MUSD escrow on Mezo Testnet, coordinated through a web app and Telegram.

**Work agreed. Funds protected. Payments verified.**

## Status

**Testnet only. Unaudited. No subjective dispute arbitration.**

| Item | Status |
| --- | --- |
| Live app | https://pactora-tan.vercel.app; deployed client/backend use V2 |
| V2 escrow | [`0x907AAB5A6d1710c477B9C1Da3c3b60b1324A060A`](https://explorer.test.mezo.org/address/0x907AAB5A6d1710c477B9C1Da3c3b60b1324A060A) |
| Last verified | **2026-11-10 UTC**; [deployment and live-check evidence](docs/deployments.md) |
| Payment evidence | Real create/accept receipts verified; full funding/delivery/payout and private-chat alerts **Pending verification** |

## What It Does

- Creates wallet-owned agreements with positive MUSD milestone amounts and agreed delivery deadlines.
- Requires provider acceptance, then separate token allowance and escrow-deposit transactions.
- Records submission/rejection hashes and releases each milestone on client approval.
- Provides provider review-timeout claims and guarded client no-show refunds.
- Supports mutual settlement bound to the exact reviewed proposal hash, not subjective arbitration.
- Offers public chain receipts, verified metadata and wallet-linked Telegram commands/confirmed-event alerts; delivery is best-effort.

## How It Works

1. **Agree:** client sets provider, amounts and future delivery deadlines; provider accepts on-chain.
2. **Fund:** client approves the MUSD allowance, then deposits the full total in a separate transaction while deadlines remain future.
3. **Deliver:** provider submits a hash of actual notes or a URL; stored text is checked against the confirmed event.
4. **Release:** client reviews and approves a milestone; its MUSD is transferred to the provider and shown in public receipts.

Timeouts: provider claims still-Submitted work after **604,800 seconds**; client refunds only eligible Pending/Rejected work at the [coded cutoff](docs/architecture.md#money-flow-and-time-windows).
Mutual settlement: the other party accepts the exact `bytes32` proposal hash and remaining split; changed proposals cannot silently substitute consent.

## Mezo Integration

| Parameter | Value |
| --- | --- |
| Network | Mezo Testnet, chain `31611` / `0x7b7b` |
| RPC | https://rpc.test.mezo.org |
| Explorer | https://explorer.test.mezo.org |
| Canonical MUSD | `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`, 18 decimals |
| Gas currency | BTC, 18 decimals |
| Test-funds links | [Faucet](https://faucet.test.mezo.org/) and [Mezo testnet swap/borrowing app](https://testnet.mezo.org) |

## Telegram Bot

[PactoraAlertsBot](https://t.me/PactoraAlertsBot) and its production webhook were verified. Commands below exist in source; actual private-chat replies/alerts are **Pending verification**.

| Command | Purpose |
| --- | --- |
| `/start` | Welcome/link instructions; `/start link_<token>` consumes a one-time link |
| `/help` | Commands, test-funds guide and wallet safety |
| `/balance` | Linked wallet's MUSD and BTC gas balances |
| `/agreements` | Discovered on-chain states and next actions |
| `/pending` | Funded work awaiting review or delivery/resubmission |
| `/getmusd` | Faucet and testnet swap/borrowing links |
| `/notifications` | Toggle verified linked-wallet alerts |
| `/unlink` | Remove the chat link and unused tokens |

In [Telegram settings](https://pactora-tan.vercel.app/settings/telegram), sign a five-minute wallet nonce, request a 15-minute single-use link and send its Start command in the private chat. The bot never holds keys, signs escrow actions or executes a Mezo loan.

## Tech Stack

Declared dependency ranges are from [package.json](package.json), not claims that every dependency is the latest release.

| Layer | Version/configuration |
| --- | --- |
| Runtime | Node **22.x**, pnpm **12.14.0** |
| Web | Next.js `^15.1.7`, React `^19.0.0`, TypeScript `^5.7.3` |
| UI | Tailwind CSS `^3.4.17`, Framer Motion `^14.4.0` |
| Wallet/data | Wagmi `^2.14.12`, Viem `^2.23.5`, TanStack Query `^5.66.0` |
| Database | PostgreSQL, postgres-js `^3.4.5`, Drizzle ORM `^0.39.3`, Drizzle Kit `^0.30.4` |
| Tests | Vitest `^3.0.5`, Playwright `^1.56.1` |
| Contracts | Solidity `^0.8.24`; Foundry compiler **0.8.37**, Paris EVM; vendored OpenZeppelin and forge-std |

## Quickstart

Use Node 22, pnpm and a dedicated development PostgreSQL database. PowerShell:

```powershell
git clone https://github.com/milesdevx/Pactora.git
Set-Location Pactora
pnpm.cmd install --frozen-lockfile
Copy-Item -LiteralPath ".env.example" -Destination ".env.local"
```

Configure these **names**, without committing real env values:

| Name | Classification / purpose |
| --- | --- |
| `NEXT_PUBLIC_PACTORA_ESCROW_ADDRESS` | Public, build-time escrow address |
| `NEXT_PUBLIC_EXPLORER_URL` | Public, optional build-time explorer-link override |
| `APP_URL` | Server origin and app links |
| `DATABASE_URL` | Server-only PostgreSQL credential |
| `RATE_LIMIT_SECRET` | Server-only strong random rate-limit secret |
| `TELEGRAM_BOT_TOKEN` | Server-only bot credential; needed for delivery |
| `TELEGRAM_BOT_USERNAME` | Server bot-link configuration |
| `TELEGRAM_WEBHOOK_SECRET` | Server-only webhook shared secret |
| `ALLOW_TEST_NOTIFICATIONS` | Server, optional production test-alert gate |

Public values are inlined at build time; changing one needs a rebuild/redeploy. Network/RPC/MUSD are fixed in source. See [deployment configuration](docs/deployments.md#environment-variable-names) for unused legacy template names. Never prefix a server secret with `NEXT_PUBLIC_`.

```powershell
pnpm.cmd db:generate
pnpm.cmd db:migrate
pnpm.cmd dev
```

`db:generate` creates SQL; `db:migrate` applies it. Alternatively use `pnpm.cmd db:push` only for a dedicated development database. Review the target and generated SQL; do not blindly apply setup/baseline commands to an existing production database.

All in-app writes request a valid signed wallet session before broadcasting, so working DB/auth routes are required. Provider acceptance in the UI also requires verified metadata to load; wallet connection alone is not sufficient.

## Testing

Actually run on **2026-11-10 UTC**. Build before browser smoke tests; install Chromium with `pnpm.cmd exec playwright install chromium` if it is absent.

| Command | Result |
| --- | --- |
| `pnpm.cmd typecheck`, `pnpm.cmd lint`, `pnpm.cmd build` | Passed; build used Next.js 15.5.28 |
| `pnpm.cmd test` | **136 passed**, 14 files |
| `pnpm.cmd test:e2e` | **2 passed**, desktop/mobile smoke checks |
| `pnpm.cmd check:client-secrets` | Passed, **48** client JavaScript/map files |
| `forge test -vv` from `contracts` | **72 passed**, 0 failed/skipped |
| `forge coverage` from `contracts` | Escrow lines **238/239 (99.58%)**, branches **72/74 (97.30%)** |

Fixtures/local time warps are not real funds, Telegram delivery or seven days on a live chain. [Security evidence](docs/security.md#test-evidence) includes aggregate coverage and test limits.

## Contract Deployment

V2 is already deployed. Only an owner intending a new deployment should broadcast. Use a **testnet-only wallet**, keep its key local and never print/commit it. `DEPLOYER_PRIVATE_KEY` is a local CLI input, not an app setting.

```powershell
Push-Location contracts
forge script script/DeployPactoraEscrow.s.sol:DeployPactoraEscrow --rpc-url https://rpc.test.mezo.org --chain-id 31611 --private-key $env:DEPLOYER_PRIVATE_KEY --broadcast --legacy
Pop-Location
```

OpenZeppelin/forge-std are vendored in `contracts/lib`, so this checkout needs no fresh `forge install`. The script rejects a non-testnet chain and deploys canonical MUSD with enforced allowlisting. Verify the public receipt/getters, then follow [redeploy/rollback steps](docs/deployments.md#redeploy-and-rollback); public address changes require a new web build.

## Documentation

- [Architecture](docs/architecture.md)
- [Security](docs/security.md)
- [Deployments](docs/deployments.md)
- [Wave 1](docs/wave-1.md)
- [Wave 2](docs/wave-2.md)
- [Network configuration](docs/network-config.md)
- [Testnet verification walkthrough](docs/demo-script.md)

## Known Limitations

- V1 is immutable and retains disclosed timeout/settlement/token limitations; new app writes use V2.
- No subjective arbitration, external audit, complete indexer or automatic delivery retry. Discovery/history are bounded; Telegram delivery is best-effort.
- **Pending verification:** full live payout, private-chat linking/commands/alerts, production DB/schema/concurrency checks and explorer source publication. Sourcify's runtime match is not explorer publication.
- Authentication is SIWE-style signed nonce, not EIP-4361 SIWE. Current source targets EOA-style signatures. MEZO support and consenting pilots are planned, not achieved traction.

## License

[Apache-2.0](LICENSE). The repository license is authoritative; old live-footer text is not an audit or licensing record.
