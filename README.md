# Pactora: MUSD Milestone Escrow on Mezo

[![Production Cutover](https://img.shields.io/badge/V2_cutover-pending-orange)](https://pactora-tan.vercel.app)
[![Mezo Testnet](https://img.shields.io/badge/Mezo_Testnet-31611-blue)](https://explorer.test.mezo.org)
[![CI](https://github.com/milesdevx/Pactora/actions/workflows/ci.yml/badge.svg)](https://github.com/milesdevx/Pactora/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue)](LICENSE)

Pactora coordinates MUSD milestone payments between freelancers and clients on Mezo Testnet. Wallets authorize agreement acceptance, funding, delivery and payouts; Telegram helps participants understand balances and the next action.

**Release status, checked November 9, 2026:** the hardened **V2 contract is deployed and exactly source-verified**, while production database/application cutover and the two-wallet live flow remain pending. The current public bundle must not be treated as V2 until the deployment record confirms the web release.

- Production alias: https://pactora-tan.vercel.app
- Verified V2 escrow: `0x907AAB5A6d1710c477B9C1Da3c3b60b1324A060A`
- Public repository: https://github.com/milesdevx/Pactora
- Actual bot: https://t.me/PactoraAlertsBot
- [Deployment evidence and pending release gates](docs/deployments.md)
- [Draft AKINDO form](docs/submission/akindo-form.md), [deck outline](docs/submission/deck-outline.md), [pitch script](docs/submission/pitch-script-2min.md), [Wave 2 plan](docs/submission/wave2-plan.md)

The public repository is currently behind the locally committed fixes. CI is configured locally; no green remote run is claimed until the intended commits are published and checked.

## Why Pactora Fits Mezo

**Track 2: Access and Distribution.** MUSD is the actual deposit and payout asset, and BTC is Mezo's gas currency. Pactora adds a concrete payment use case to MUSD and uses Telegram to reduce coordination and test-funding friction. `/getmusd` points to the existing Mezo faucet and swap/borrowing app; no invented Passport, yield, or borrowing integration is claimed. MEZO funding is a roadmap item, not a shipped feature.

## Implemented V2 Source

- Milestone escrow with explicit provider acceptance, exact MUSD allowance/funding, submission, client approval/rejection and public receipts.
- Agreed future delivery deadlines, seven-day review-timeout claims and seven-day rejection/resubmission grace. No-show refunds affect only eligible unsettled milestones.
- Hash-bound mutual-consent settlement. It is not subjective dispute arbitration; a fully released settlement is `Completed`, while settlement with any refund is `Cancelled`.
- OpenZeppelin `ReentrancyGuard` and `SafeERC20`, exact sender/receiver balance changes, token contract validation, and an enforced MUSD allowlist in the deployment script.
- Server-verified SIWE-style signed nonces, five-minute atomic consumption, hashed DB session tokens, protected metadata/link APIs and persistent PostgreSQL rate limits.
- Constant-time secret-token header verification, not HMAC; unique Telegram update deduplication, hashed one-time linking and confirmed-receipt notification checks.
- Exact bigint monetary formatting, explicit testnet/account writes, money-action confirmation, real receipt-derived agreement IDs and evidence text verified against chain hashes.
- `/balance`, `/agreements`, `/pending`, `/getmusd`, `/help`, `/notifications` and `/unlink` in the new bot source.

These features are implemented and tested in the V2 source. The production application must not be represented as cut over until its inlined address and live behavior are verified.

## Network and Deployment

| Parameter | Value |
| --- | --- |
| Chain | **Mezo Testnet** |
| Chain ID | **31611**, hex `0x7b7b` |
| Native gas | **BTC**, 18 decimals |
| RPC | https://rpc.test.mezo.org |
| Explorer | https://explorer.test.mezo.org |
| Canonical MUSD | `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`, 18 decimals |
| Existing legacy V1 escrow | `0x1Da50726E11bf828358f6b840900c0a731B2b40F` |
| Verified V2 escrow | `0x907AAB5A6d1710c477B9C1Da3c3b60b1324A060A` |
| V2 deployment hash | `0x9398e478826ed8cc6abacb386b1040ccf21b5a4517f652ad2f29f76fe6a8aa98` |

[Official Mezo network guide](https://mezo.org/docs/developers/getting-started/) and [MUSD reference](https://mezo.org/docs/developers/getting-started/musd-payments-x402/#mezo-x402-reference).

## Try It

The production site's [help page](https://pactora-tan.vercel.app/help) is available for read-only network information. Use the transaction flow only after the deployment record confirms the V2 web cutover.

1. Select Mezo Testnet `31611`. Obtain test BTC at https://faucet.test.mezo.org/ using your wallet address and CAPTCHA.
2. Open https://testnet.mezo.org and swap test BTC for MUSD or use BTC-backed MUSD borrowing. The faucet offers BTC/MEZO, not direct MUSD; review any borrowing minimum/terms. Retain test BTC for gas.
3. Verify the actual V2 escrow address in the deployment record before using two real test wallets. Keep all keys and seed phrases in your own wallets.
4. As client, create amounts and future delivery deadlines. As provider, review and accept. As client, approve the exact token allowance, then fund escrow as a separate transaction.
5. Submit actual deliverable notes or a URL. Approve one milestone and wait for the successful receipt. Inspect the real MUSD token, amount, recipient and transaction hash in the public receipt/explorer.
6. Sign in with your wallet, generate a one-time link in Telegram settings, open the private bot chat and click Start. New source requires signed relinking for pre-upgrade unverified links.
7. Use `/balance`, `/agreements`, `/pending` and `/getmusd`. Verify actual replies; a terminal formatter or local test is not proof of delivery.

The local homepage preview is visibly labelled **Illustration, not real funds**. It sends no transactions and is not payment evidence. Real screenshots in `docs/submission/screenshots/` show the existing V1 help page only.

## Telegram Commands

| Command | Purpose in new source |
| --- | --- |
| `/start` | Welcome and wallet-linking instructions |
| `/start link_<token>` | Consume the signed-session one-time private link |
| `/balance` | Read linked wallet's canonical MUSD and test BTC gas balance |
| `/agreements` | Confirm on-chain states and show the next action |
| `/pending` | Funded milestones needing review or delivery |
| `/getmusd` | Real Mezo faucet and testnet swap/borrowing guide |
| `/notifications` | Toggle verified linked-wallet alerts |
| `/unlink` | Disconnect the chat and revoke unused link tokens |
| `/help` | Commands, test funds and wallet safety |

There is no `/link` command. Money-moving actions are signed in the app/wallet, not Telegram. Available transaction hashes link to the Mezo explorer; read-only commands never invent a transaction hash. New-command live verification is still pending.

## Local Setup: Windows PowerShell

Use **Node 22.x**, **pnpm 12.14.0**, Foundry and a dedicated development PostgreSQL database. The package pins pnpm/runtime requirements; native build permissions are in `pnpm-workspace.yaml`, so `approve-builds --all` is not needed.

```powershell
git clone https://github.com/milesdevx/Pactora.git
Set-Location Pactora
pnpm.cmd install --frozen-lockfile
Copy-Item .env.example .env.local
```

Configure the actual public escrow address and private server settings. Never commit the environment file or expose server secrets under `NEXT_PUBLIC_*`.

| Setting | Purpose |
| --- | --- |
| `NEXT_PUBLIC_PACTORA_ESCROW_ADDRESS` | Actual verified V2 contract; inlined at web build time |
| `APP_URL` | Local origin for development; production must be HTTPS, using the actual production domain |
| `DATABASE_URL` | Private PostgreSQL connection for sessions, metadata, rates and outbox |
| `TELEGRAM_BOT_TOKEN` | Server-only bot credential |
| `TELEGRAM_BOT_USERNAME` | Actual configured bot username |
| `TELEGRAM_WEBHOOK_SECRET` | Strong random shared secret, never printed |
| `RATE_LIMIT_SECRET` | At least 32 random bytes, conventionally 64 hex characters |
| `ALLOW_TEST_NOTIFICATIONS` | Optional literal `true`; production testing is disabled otherwise |

Wallet sessions use opaque tokens hashed in PostgreSQL. `SESSION_SECRET` and `LINK_TOKEN_SECRET` legacy settings are not used by V2. The chain and MUSD registry in new source are fixed to Mezo Testnet/canonical MUSD, not arbitrary network overrides.

Only run these setup commands against a **development** database. The existing production database lacks a migration journal and needs its separate reviewed baseline plan.

```powershell
# Create SQL, review it, then apply it to a suitable migration-based database:
pnpm.cmd db:generate
pnpm.cmd db:migrate

# Alternative for a dedicated development database:
pnpm.cmd db:push
pnpm.cmd dev
```

`db:generate` creates SQL; it does not apply migrations. Database scripts load `.env.local`; check the target before running them. Do not blindly migrate the existing production tables or delete duplicate data to force a pass.

## Validation

```powershell
pnpm.cmd typecheck
pnpm.cmd lint
pnpm.cmd test
pnpm.cmd build
pnpm.cmd exec playwright install chromium
pnpm.cmd test:e2e
pnpm.cmd check:client-secrets
pnpm.cmd contracts:build
pnpm.cmd contracts:test
pnpm.cmd exec node scripts/run-foundry.mjs coverage --report lcov
```

Recorded local November 7 checks: **125 web/unit tests**, **71 Foundry tests**, two desktop/mobile browser smoke tests and a **49-file client-secret scan** passed. Contract coverage was **238/239 lines**, **72/74 branches** and **27/27 functions**. These are dated local results, not an external audit, DB concurrency integration proof, or live payout/Telegram proof. Re-run before release.

The same typecheck/lint/build, 125-test web suite, 71-test contract suite, two browser tests and 49-file scan were rerun and passed on **November 8** while preparing these drafts. Coverage figures above remain from the November 7 coverage run.

OpenZeppelin and forge-std are committed under `contracts/lib/`; the Phase A clean-clone build/test passed. No `.gitmodules` or fresh `forge install` is required. Solidity source uses `^0.8.24`; Foundry pins compiler `0.8.37` and Paris EVM. The Windows runner finds `$HOME\.foundry\bin\forge.exe`.

## Owner-Only Deployment

The agent never broadcasts a contract or asks for a private key. The owner uses a locally encrypted keystore:

```powershell
pnpm.cmd exec node scripts/run-foundry.mjs script script/DeployPactoraEscrow.s.sol:DeployPactoraEscrow --rpc-url https://rpc.test.mezo.org --chain-id 31611 --account pactora-testnet --broadcast --legacy
```

The script checks chain `31611` before broadcast. After successful deployment, verify the public address/hash, update environment, apply the reviewed DB upgrade, then deploy the web app and reset/check the webhook. The public escrow address requires a new web build. See [the full safe order](docs/deployments.md#safe-release-order-pending-owner-action).

## Known Limitations

- **Testnet only, unaudited, no subjective dispute arbitration.** Timeout rules address silence, not proof of deliverable quality or bad-faith rejection.
- Existing V1 is immutable, lacks timeouts and retains disclosed resolution/token-accounting issues. Do not route new funds there as if it were fixed.
- V2 deployment, schema/config upgrade, real private-chat command checks, two-wallet demo, live bundle/log inspection and source verification are still pending.
- The production read-only preflight found no duplicate links or non-normalized wallets, but all V2 schema additions and the migration journal were absent. Read-only inspection is not a migration pass.
- Discovery covers registered metadata plus the first 50 on-chain IDs; complete indexing and automatic notification retry are not implemented. Delivery is best-effort and currently relies on confirmed app callbacks.
- Public receipt history is bounded to recent blocks plus creation/closure anchors when older; RPC errors are not hidden with fabricated history.
- Authentication is SIWE-style personal signing, **not EIP-4361**. The current signature flow targets EOA wallets, not a verified ERC-1271 smart-wallet flow.
- Exact-transfer checks cannot eliminate later negative rebases or dishonest token balance reporting. Only reviewed tokens should be allowed.
- Isolated PostgreSQL concurrency/rollback integration was not run because Docker was unavailable.
- MEZO funding UI and the insufficient-MUSD funding step are P1/roadmap work, blocked until P0 live gates pass. No fake Mezo Passport or yield feature exists.
- A deck outline and pitch script do not satisfy the required published deck and recorded video.

## Submission and Commitment

The first commit is October 19, 2026, inside the announced Wave 1 build period. The current entry is intended for **Track 2**; Wave 2 qualification still needs owner confirmation. Future indexing, MEZO verification, independent review and consenting pilot targets are documented as plans, not traction.

On November 8, [AKINDO's live Wave 2 data](https://api.akindo.io/public/wave-hacks/OVOO0gdrVU8379D10/waves) reported **November 13, 2026 at 05:30:06 UTC**. [Mezo's written schedule](https://mezo.org/blog/mezo-buildathon-is-underway/) says November 15. Plan against the earlier cutoff unless corrected; winner announcement is November 23, 2026.

[Architecture](docs/architecture.md) | [Security findings and limits](docs/security.md) | [Deployment record](docs/deployments.md) | [Draft submission](docs/submission/akindo-form.md)

## License

Apache-2.0. The repository `LICENSE` is authoritative; old live-footer text is not.
