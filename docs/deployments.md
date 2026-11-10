# Pactora Deployments

Last verified: **2026-11-10 UTC**. Verified by the repository coding agent using read-only `curl.exe`, `cast`, Vercel CLI inspection and Telegram Bot API reads. **Testnet only. Unaudited. No subjective dispute arbitration.**

This run did not deploy a contract/app, migrate a database, register a webhook or send a payment/message. A deployed contract, a configured web build and a completed payment are separate claims.

## Contracts

| Version | Status | Address | Deployment transaction | Block | Deployer | Chain | Explorer |
| --- | --- | --- | --- | --- | --- | --- | --- |
| **V2** | Deployed; successful receipt and runtime verified | `0x907AAB5A6d1710c477B9C1Da3c3b60b1324A060A` | `0x9398e478826ed8cc6abacb386b1040ccf21b5a4517f652ad2f29f76fe6a8aa98` | `16672530` | `0xb44ecBC98b74536fBe085eE9085aebC26e8Cb5b6` | Mezo Testnet, `31611` | [Address](https://explorer.test.mezo.org/address/0x907AAB5A6d1710c477B9C1Da3c3b60b1324A060A), [transaction](https://explorer.test.mezo.org/tx/0x9398e478826ed8cc6abacb386b1040ccf21b5a4517f652ad2f29f76fe6a8aa98) |
| **V1 (legacy)** | Runtime still present; retained for historical reads, not new app writes | `0x1Da50726E11bf828358f6b840900c0a731B2b40F` | `0xe234e5a2a79682feeb221cf21a7126852e432497c2f6a10b380826e6a4566bb9` | `16344913` | `0x724ECFFD7A0C3AbAC2D91945C5B2e63ecc029DFB` | Mezo Testnet, `31611` | [Address](https://explorer.test.mezo.org/address/0x1Da50726E11bf828358f6b840900c0a731B2b40F), [transaction](https://explorer.test.mezo.org/tx/0xe234e5a2a79682feeb221cf21a7126852e432497c2f6a10b380826e6a4566bb9) |

V1's address/hash/block/deployer come from the public [Foundry broadcast record](../contracts/broadcast/DeployPactoraEscrow.s.sol/31611/run-1792867757257.json). A current block read confirmed that exact creation transaction and caller in block `16344913`; `owner()` matched the caller. The saved receipt has status `0x1`.

**Not verified. Pending verification:** the required RPC returned `null` for a fresh V1 `eth_getTransactionReceipt` read. Current V1 receipt indexing/status was not independently reverified, even though the recorded deployment, block inclusion and present runtime were checked. V1 source changes cannot repair its immutable contract.

## Token and Network

| Parameter | Verified value |
| --- | --- |
| Chain | Mezo Testnet, `31611` / `0x7b7b` |
| RPC | https://rpc.test.mezo.org |
| Explorer | https://explorer.test.mezo.org |
| Canonical MUSD | `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` |
| MUSD decimals | `18`, read from `decimals()` |
| Token explorer | [Canonical MUSD](https://explorer.test.mezo.org/token/0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503) |
| Gas currency | BTC, 18 decimals, as defined in [network source](../lib/chain/mezo.ts) |

The [official MUSD reference](https://mezo.org/docs/developers/getting-started/musd-payments-x402/#mezo-x402-reference) lists the same testnet token. Pactora uses ERC-20 allowance and transferFrom, not an x402 gas-sponsored payment flow.

## On-Chain Checks

| Read actually made | Result |
| --- | --- |
| `eth_chainId` via `curl.exe` | `0x7b7b` |
| V2 `eth_getTransactionReceipt` and `cast receipt` | Status `0x1` / success; contract address, caller and block match the V2 row |
| V2 `cast code` | Nonempty runtime, **21,626 bytes** |
| V1 `cast code` | Nonempty runtime, **15,482 bytes** |
| V2 `VERSION()` | `2` |
| V2 `owner()` | V2 deployer in the table |
| V2 `defaultToken()` | Canonical MUSD |
| V2 `enforceTokenAllowlist()` | `true` |
| V2 `allowedTokens(MUSD)` | `true` |
| V2 `REVIEW_WINDOW()` | `604800` seconds |
| MUSD `decimals()` | `18` |
| V1 `getAgreementCount()` | `3`, a contract counter, not a user/traction metric |
| V2 live health / agreement read | Count `1`; agreement 1 Accepted, unfunded, with no release/refund |

The V2 receipt succeeds on this date. Earlier documentation of a `null` V2 receipt response is not the current result.

## Web App and Telegram

| Item | Observed status |
| --- | --- |
| Live app | https://pactora-tan.vercel.app; `/help` returned HTTP 200 |
| Current deployment | Vercel Production / Ready; `dpl_3MbV15k8sMNobnb2JEEW2wTdWSMy` |
| Immutable deployment URL | https://pactora-75top8niq-mfaver.vercel.app |
| Deployment created | `2026-11-10 22:33:58 GMT+03:00`, as reported by Vercel inspection |
| Public escrow env name | `NEXT_PUBLIC_PACTORA_ESCROW_ADDRESS` exists in Vercel Production; only names, not secret values, were inspected |
| Deployed client escrow | **V2**, `0x907AAB5A6d1710c477B9C1Da3c3b60b1324A060A`, extracted from deployed JavaScript |
| Backend escrow readiness | `/api/health` returned chain `31611`, V2 version `2`, canonical default token and enabled/allowed token checks |
| Database technology | PostgreSQL through postgres-js and Drizzle in [source](../lib/db/index.ts); `DATABASE_URL` exists in Production |
| Production DB provider/schema | **Not verified. Pending verification:** no production DB connection/schema inspection was made in this run; env-name presence is not provider or migration proof |
| Bot | [PactoraAlertsBot](https://t.me/PactoraAlertsBot), verified by Telegram `getMe` |
| Webhook | **Registered**, https://pactora-tan.vercel.app/api/telegram/webhook; verified by `getWebhookInfo` |
| Webhook health snapshot | `pending_update_count = 0`, allowed updates `message`, no reported last error |
| Real chat linking/commands/alerts | **Not verified. Pending verification:** no authenticated private-chat interaction or event-delivery capture was performed |

The deployed `/agreements/create` HTML referenced 17 client JavaScript URLs. V2's address appeared in `/_next/static/chunks/329-9f8d5e3fbc9b28a4.js` and `/_next/static/chunks/app/layout-52bf4892af7c98b2.js`. `/api/health` independently reported the same configured escrow. This verifies the address cutover, not every money/auth/Telegram workflow.

The November 8 V1 `/help` capture is historical: [capture record](submission/screenshots/capture.json). The current alias points to a V2-configured build. The live footer still has inaccurate "audited" and MIT wording; see [security limitations](security.md#known-limitations).

## Environment Variable Names

No actual environment values are reproduced here. Source consumers, not old templates, determine what is needed.

| Name | Classification | Used for |
| --- | --- | --- |
| `NEXT_PUBLIC_PACTORA_ESCROW_ADDRESS` | Public, build-time | Verified escrow address in client and server build |
| `NEXT_PUBLIC_EXPLORER_URL` | Public, optional, build-time | Explorer links in address chips and transaction status; defaults to the Mezo Testnet explorer |
| `APP_URL` | Server | Authentication origin, app links and production HTTPS check |
| `DATABASE_URL` | Server secret | PostgreSQL metadata, sessions, rate limits and outbox |
| `RATE_LIMIT_SECRET` | Server secret | Persistent rate-limit identity hashing |
| `TELEGRAM_BOT_TOKEN` | Server secret; needed for bot delivery | Telegram Bot API credential |
| `TELEGRAM_BOT_USERNAME` | Server config; needed for linking | Configured bot deep-link name |
| `TELEGRAM_WEBHOOK_SECRET` | Server secret; needed for webhook | Shared-secret header comparison |
| `ALLOW_TEST_NOTIFICATIONS` | Server, optional | Explicit production test-alert gate |
| `NODE_ENV`, `VERCEL` | Runtime/platform-managed | Cookie/origin behavior and trusted forwarding-header selection |

`NEXT_PUBLIC_*` values are inlined at build time: changing a public setting requires a rebuild and redeploy. Server secrets must never use that prefix.

The chain ID, RPC and canonical MUSD are fixed in current [chain source](../lib/chain/mezo.ts); the wallet connector is injected in [Wagmi config](../lib/chain/config.ts). The default explorer is also defined there, but [address chips](../components/ui/AddressChip.tsx) and [transaction status](../components/tx/TxStatus.tsx) can override their link destination with `NEXT_PUBLIC_EXPLORER_URL`. Template names `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_RPC_URL`, `NEXT_PUBLIC_MUSD_ADDRESS`, `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, `SESSION_SECRET`, `LINK_TOKEN_SECRET`, `TELEGRAM_WEBHOOK_URL` and `SENTRY_DSN` are not consumed by the current app paths. Legacy public Supabase settings listed by Vercel are not used by this source either.

## How to Verify Yourself

These are read-only PowerShell commands. `cast` must be on PATH; no wallet key is needed.

```powershell
cast chain-id --rpc-url https://rpc.test.mezo.org
cast receipt 0x9398e478826ed8cc6abacb386b1040ccf21b5a4517f652ad2f29f76fe6a8aa98 --rpc-url https://rpc.test.mezo.org
cast code 0x907AAB5A6d1710c477B9C1Da3c3b60b1324A060A --rpc-url https://rpc.test.mezo.org
cast call 0x907AAB5A6d1710c477B9C1Da3c3b60b1324A060A "defaultToken()(address)" --rpc-url https://rpc.test.mezo.org
cast call 0x907AAB5A6d1710c477B9C1Da3c3b60b1324A060A "VERSION()(uint256)" --rpc-url https://rpc.test.mezo.org
cast call 0x907AAB5A6d1710c477B9C1Da3c3b60b1324A060A "enforceTokenAllowlist()(bool)" --rpc-url https://rpc.test.mezo.org
cast call 0x907AAB5A6d1710c477B9C1Da3c3b60b1324A060A "allowedTokens(address)(bool)" 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503 --rpc-url https://rpc.test.mezo.org
cast call 0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503 "decimals()(uint8)" --rpc-url https://rpc.test.mezo.org
cast code 0x1Da50726E11bf828358f6b840900c0a731B2b40F --rpc-url https://rpc.test.mezo.org
cast receipt 0xe234e5a2a79682feeb221cf21a7126852e432497c2f6a10b380826e6a4566bb9 --rpc-url https://rpc.test.mezo.org
curl.exe --silent --show-error https://pactora-tan.vercel.app/api/health
pnpm.cmd dlx vercel env ls --environment production
pnpm.cmd dlx vercel inspect https://pactora-tan.vercel.app
```

Compare receipt status, deployment address/caller/block and MUSD to the table. A missing V1 receipt remains a verification gap, not a successful fresh receipt check. Inspect the [V2 address](https://explorer.test.mezo.org/address/0x907AAB5A6d1710c477B9C1Da3c3b60b1324A060A) and [deployment transaction](https://explorer.test.mezo.org/tx/0x9398e478826ed8cc6abacb386b1040ccf21b5a4517f652ad2f29f76fe6a8aa98) directly.

## Lifecycle Evidence

Successful RPC receipts and the live [V2 public receipt](https://pactora-tan.vercel.app/receipts/1) confirm only the following steps for agreement 1:

| Step | Actual transaction | Block | Evidence |
| --- | --- | --- | --- |
| Create | [0x3371ca6115b13fc5513cfba6fc6ccac644232ef337bad521e85df77fb89aa5c4](https://explorer.test.mezo.org/tx/0x3371ca6115b13fc5513cfba6fc6ccac644232ef337bad521e85df77fb89aa5c4) | `16674847` | Receipt status `0x1`; V2 `AgreementCreated`, ID 1 and client caller |
| Accept | [0x74264295045ba7c71cd6262658cc02d3aa6063fdd8c7d9e26ee72d0fbc19f571](https://explorer.test.mezo.org/tx/0x74264295045ba7c71cd6262658cc02d3aa6063fdd8c7d9e26ee72d0fbc19f571) | `16674863` | Receipt status `0x1`; `AgreementAccepted`, different provider caller |
| Allowance and fund | **Pending verification** | Not recorded | No verified deposit; agreement is Accepted with `fundedAt == 0` |
| Submit | **Pending verification** | Not recorded | No verified submission receipt |
| Approve/release | **Pending verification** | Not recorded | No verified release receipt or provider token-transfer evidence |

The public receipt snapshot at block `16700027` showed Accepted and zero funded/released/refunded amounts. A paged V2 log scan from deployment through `16699846` found only deployment, create and accept events; the RPC limits each log query to a 10,000-block distance. A first over-wide query failed and was not treated as evidence.

**Pending: real two-wallet run. Pending verification:** complete the remaining allowance, funding, delivery and approval steps with actual receipts and provider MUSD transfer evidence. The existing partial run is not a completed agreement, user metric or traction claim. No payment transactions were sent by this documentation task.

## Source Verification

[Sourcify's contract API](https://sourcify.dev/server/v2/contract/31611/0x907AAB5A6d1710c477B9C1Da3c3b60b1324A060A) returned `match: exact_match`, `runtimeMatch: exact_match`, `creationMatch: null` and verification time `2026-11-09T12:45:41Z`. This is verified runtime-match evidence, not a confirmed creation-bytecode match.

**Explorer publication: Not verified. Pending verification:** the [explorer contract API](https://api.explorer.test.mezo.org/api/v2/smart-contracts/0x907AAB5A6d1710c477B9C1Da3c3b60b1324A060A) returned creation/deployed bytecode fields, but no source name/compiler/verification-status fields. A successful explorer source publication was not established. Do not describe Sourcify's result as successful explorer publication.

## Redeploy and Rollback

Owner instructions, not operations performed in this run:

1. Review the intended source and [security limits](security.md). Back up off-chain data and verify the current database schema before applying any migration; do not blindly baseline an existing database.
2. If a new contract is needed, use the [testnet-only deployment command](../README.md#contract-deployment) with a dedicated testnet signer, then verify receipt, code, version, owner, MUSD and allowlist. Existing escrow balances do not migrate automatically.
3. Configure the required public/server env names in Vercel Production. A changed public escrow setting requires a new build. Run the documented tests, then deploy with `pnpm.cmd dlx vercel --prod`.
4. Recheck deployed JavaScript and `/api/health`, not just dashboard env names. If bot configuration changes, review `scripts/register-telegram-webhook.mjs` and run `pnpm.cmd telegram:webhook:production` only with intended production bot credentials; it calls `setWebhook`. Then read `getWebhookInfo` and verify actual private-chat delivery.
5. For an app rollback, promote a reviewed previous V2-compatible Vercel deployment and recheck its inlined address, schema compatibility and webhook. Do not roll new writes back to V1 or assume a contract rollback can recover funds. Preserve legacy receipts and metadata; never delete rows merely to make a migration pass.
