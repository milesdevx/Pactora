# Deployment Record: Pactora V2

Checked **2026-11-09**. Pactora V2 is deployed on Mezo Testnet. Production application and database cutover are recorded separately and must not be inferred from the contract deployment.

## Current V2 Contract

| Field | Verified value |
| --- | --- |
| Chain | Mezo Testnet, `31611` (`0x7b7b`) |
| RPC | https://rpc.test.mezo.org |
| Escrow | `0x907AAB5A6d1710c477B9C1Da3c3b60b1324A060A` |
| Escrow explorer | https://explorer.test.mezo.org/address/0x907AAB5A6d1710c477B9C1Da3c3b60b1324A060A |
| Deployment transaction | `0x9398e478826ed8cc6abacb386b1040ccf21b5a4517f652ad2f29f76fe6a8aa98` |
| Transaction explorer | https://explorer.test.mezo.org/tx/0x9398e478826ed8cc6abacb386b1040ccf21b5a4517f652ad2f29f76fe6a8aa98 |
| Block | `16672530` (`0xfe6712`) |
| Block timestamp | `2026-11-09T12:23:56.000Z` |
| Deployer / owner | `0xb44ecBC98b74536fBe085eE9085aebC26e8Cb5b6` |
| Canonical MUSD | `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` |
| Contract version | `2` |
| Token allowlist | Enforced; canonical MUSD allowed |
| Initial agreement count / next ID | `0` / `1` |
| Source verification | Sourcify `exact_match` |
| Verification job | https://sourcify.dev/server/verify-ui/jobs/43655119-6c0a-44f0-a1e5-00d613d0689b |

### Checks Actually Run

| Check | Result | Evidence |
| --- | --- | --- |
| `eth_getCode` | PASS | Non-empty V2 runtime at the escrow address |
| Deployment transaction in stated block | PASS | `eth_getBlockByNumber(0xfe6712, true)` contains the exact hash, deployer, nonce `0`, constructor MUSD and allowlist `true` |
| `eth_getTransactionReceipt` | FAIL: RPC returned `null` on three attempts | The required RPC also returned `null` for `eth_getTransactionByHash`; `eth_getBlockReceipts` is unsupported. This check is not labelled PASS. Persistent runtime code proves creation execution completed, but does not repair the RPC receipt index. |
| Contract address | PASS | The nonce-zero creation transaction and persisted runtime resolve to the recorded address |
| `VERSION()` | PASS: `2` | Direct `eth_call` |
| `owner()` | PASS: deployer address | Direct `eth_call` |
| `defaultToken()` | PASS: canonical MUSD | Direct `eth_call` |
| `enforceTokenAllowlist()` | PASS: `true` | Direct `eth_call` |
| `isTokenAllowed(MUSD)` | PASS: `true` | Direct `eth_call` |
| `getAgreementCount()` / `nextAgreementId()` | PASS: `0` / `1` | Direct `eth_call` |
| Source verification | PASS: Sourcify `exact_match` | Foundry verification job linked above |

## Legacy V1 Contract

The previous contract remains immutable and available for read-only historical receipts:

- Address: `0x1Da50726E11bf828358f6b840900c0a731B2b40F`
- Explorer: https://explorer.test.mezo.org/address/0x1Da50726E11bf828358f6b840900c0a731B2b40F
- Deployment transaction: `0xe234e5a2a79682feeb221cf21a7126852e432497c2f6a10b380826e6a4566bb9`
- Agreement count: `3`; known IDs are `1`, `2`, and `3`
- `VERSION()` is absent. It must not be configured as the V2 application escrow.

Historical metadata IDs such as `42364` and `910954` do not exist on that contract. The reviewed reconciliation marks matching production rows `legacy_unverified`; it does not delete or present them as agreements.

## Production Application Status

- Production alias: https://pactora-tan.vercel.app
- Immutable deployment URL: https://pactora-40tmszwxy-mfaver.vercel.app
- Vercel deployment ID: `dpl_Bvk7dEhcADXKzZukktHEmA4vg23t`
- Deployment target/status: Production / Ready
- Deployment created: `2026-11-09 16:52:19 GMT+03:00`
- Telegram bot: https://t.me/PactoraAlertsBot
- Webhook target: https://pactora-tan.vercel.app/api/telegram/webhook
- `NEXT_PUBLIC_PACTORA_ESCROW_ADDRESS` was set in the Vercel Production environment before this deployment.
- Telegram `setWebhook` returned success; `getWebhookInfo` reported the production URL, pending updates `0`, allowed updates `message`, and no `last_error_message`.

## Production Database Migration

The authorized production preflight found all `0001` schema features already present, no duplicate linked-wallet/chat groups, no non-normalized wallets, no `0002` agreement identity columns, and no Drizzle migration journal. The guarded baseline command verified that exact shape and the expected `0001` partial index, then recorded migrations `0000` and `0001`. Drizzle transactionally applied only `0002`.

- Post-migration preflight: PASS
- Migration journal entries: `3`
- Missing baseline tables: `0`
- Duplicate wallet/chat link groups: `0` / `0`
- Non-normalized wallets: `0`
- Required V2 tables and columns: present
- Agreement rows checked against chain: `1`
- Rows marked `legacy_unverified`: legacy escrow agreement ID `673070`
- Rows deleted: `0`
- Second reconciliation dry run: no additional changes

The database URL, bot token, webhook secret, and rate-limit secret were never printed or committed.
