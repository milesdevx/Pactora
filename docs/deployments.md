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
- Telegram bot: https://t.me/PactoraAlertsBot
- Webhook target: https://pactora-tan.vercel.app/api/telegram/webhook
- The V2 public address is inlined during the Next.js build. Updating the Vercel production environment without a new production deployment does not cut over the client bundle.
- Database schema/reconciliation must be applied to the confirmed production database before the V2 web deployment.

## Database Migration Boundary

The last read-only production preflight found all baseline tables, no duplicate linked-wallet/chat groups, no non-normalized wallets, and no Drizzle migration journal. Therefore, do not blindly replay baseline migrations against existing production tables.

Safe order:

1. Confirm the private database target without printing its URL.
2. Apply the reviewed `0002` expand migration to the existing schema.
3. Run `pnpm.cmd db:reconcile-agreements` as a dry run, review affected IDs, then rerun with `--apply`.
4. Confirm `legacy_unverified` rows are preserved and hidden by default.
5. Set the V2 escrow in the Vercel Production environment and redeploy.
6. Re-register and verify the Telegram webhook.
7. Run the live HTTP, rendered-DOM, chain, log, and client-bundle secret checks.
