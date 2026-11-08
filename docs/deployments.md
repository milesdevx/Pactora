# Deployment Record: Draft, V2 Not Deployed

Checked **2026-11-08**. The owner confirmed that V2 has not been redeployed and authorized read-only preflight plus draft submission materials. This record is not a claim of V2 production readiness.

## Verified Existing Deployment

| Field | Observed value |
| --- | --- |
| Live web URL | https://pactora-tan.vercel.app |
| Vercel deployment URL | https://pactora-bm113yvkc-mfaver.vercel.app |
| Vercel production creation date | 2026-10-24, from `vercel inspect` |
| Chain | Mezo Testnet, `31611` |
| RPC | https://rpc.test.mezo.org |
| Configured legacy escrow | `0x1Da50726E11bf828358f6b840900c0a731B2b40F` |
| Escrow explorer | https://explorer.test.mezo.org/address/0x1Da50726E11bf828358f6b840900c0a731B2b40F |
| Canonical MUSD | `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`, 18 decimals |
| Token explorer | https://explorer.test.mezo.org/token/0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503 |
| Bot | https://t.me/PactoraAlertsBot |
| Webhook URL | https://pactora-tan.vercel.app/api/telegram/webhook |
| Contract deployment transaction hash/date | **Unverified, not provided**. Historical RPC lookup did not produce a verified matching creation receipt. |
| V2 escrow / deployment transaction | **Not deployed / unavailable**. Do not substitute the legacy address. |

`VERSION()` reverted on the configured legacy escrow. `/api/auth/session` returned HTTP `404`; the hardened application is not deployed. No owner key, keystore password, or server secret was printed or requested.

## Checks Actually Run

| Check | Result | Scope |
| --- | --- | --- |
| Live URL HTTP status | PASS: `200` | Existing V1 only |
| Wrong-secret webhook POST | PASS: `401` | Rejected before any real update; existing V1 only |
| Telegram `getMe` | PASS: `PactoraAlertsBot`, bot flag true | Actual bot identity |
| Telegram `getWebhookInfo` | PASS: production URL, pending updates `0`, no reported last error | Configuration only, not proof of new commands |
| RPC chain ID | PASS: `31611` | Actual Mezo Testnet |
| Configured escrow `VERSION()` | V2 gate unmet: reverted | Legacy deployment |
| Hardened session endpoint | V2 gate unmet: `404` | Existing web deployment |
| Live V1 help screenshots | PASS: HTTP `200`, visible main content, inspected desktop/mobile images | No wallet injection or simulated transaction |
| Historical deployment lookup | NOT VERIFIED | One candidate receipt was missing; another attempt returned HTTP `522` with an HTML response |
| V2 source verification | NOT RUN | No V2 address exists yet |
| Explorer v2 address API lookup | FAILED: `404` in the preceding phase | This is not a successful source verification |
| New bot commands, signed relinking, two-wallet payment demo | NOT RUN live | Local tests/RPC formatting are not Telegram or payment evidence |
| Production logs and live V2 secret-bundle scan | NOT RUN | Only local bundle scanning passed previously |

No `setWebhook`, contract broadcast, production database mutation, environment update, or production web deploy was run during this draft phase.

Local November 8 rerun: typecheck, lint, build, 125 web/unit tests, 71 Foundry tests, two browser smoke tests and the 49-file client-secret scan passed. These are not production V2 results.

## Read-Only Production Database Preflight

The owner confirmed that the existing private local connection points to the production database. The preflight used a transaction with `transaction_read_only=on` and reported counts/schema flags, not user records.

- All seven baseline application tables exist.
- Duplicate wallet-link groups: **0**; duplicate chat-link groups: **0**.
- Non-normalized wallet addresses: **0**.
- No `drizzle.__drizzle_migrations` journal exists.
- V2 `wallet_sessions`, `rate_limits`, and `milestone_evidence` tables are absent.
- Stored nonce message, scoped/verified metadata, creation hash, signed-token provenance, and verified-link columns are absent.
- Production requires V2 schema changes and an explicit baseline plan. This was a preflight PASS, not a migration PASS.

Vercel's sensitive production values were not exportable: it returned `[SENSITIVE]` placeholders for four variables. Those placeholders were never used to connect. `APP_URL` and `RATE_LIMIT_SECRET` were absent from the production configuration inspected.

## Safe Release Order: Pending Owner Action

1. The owner imports/uses a locally encrypted Foundry keystore and runs the testnet-only V2 deployment command below. The agent does not broadcast.
2. Provide only the public V2 address and deployment transaction hash. Verify chain `31611`, successful creation receipt, `VERSION()==2`, MUSD default token, enforced allowlist, and code/source identity.
3. Set the verified `NEXT_PUBLIC_PACTORA_ESCROW_ADDRESS` locally and in Vercel. Set HTTPS `APP_URL=https://pactora-tan.vercel.app`, a strong random `RATE_LIMIT_SECRET`, the real bot configuration, and the webhook secret without exposing values.
4. Rerun duplicate/normalization preflight immediately before schema changes. Because the baseline has no migration journal, do **not** blindly run all migrations. Review a schema-only `db:push` delta or establish an explicit, verified migration baseline first. Do not silently delete duplicate records.
5. If using `db:push`, separately execute the reviewed legacy-webhook payload redaction from `drizzle/0001_cute_talisman.sql`; schema pushing does not run data updates. Preserve update IDs/statuses and require signed relinking for old unverified links.
6. Apply the reviewed production schema before deploying the web app. Rerun typecheck, lint, tests, build, browser smoke and client-secret scan with verified public configuration.
7. Deploy with `vercel --prod`; the public escrow address is inlined at build time. Reset the production webhook with the exact configured shared secret and check `getWebhookInfo` for errors.
8. Run actual private-chat commands and the two-wallet create/accept/fund/submit/approve/receipt flow. Record only real successful transaction hashes and received bot replies. Check the live bundle and sanitized logs, then finalize submission materials.

Owner-only command from the repository root:

```powershell
pnpm.cmd exec node scripts/run-foundry.mjs script script/DeployPactoraEscrow.s.sol:DeployPactoraEscrow --rpc-url https://rpc.test.mezo.org --chain-id 31611 --account pactora-testnet --broadcast --legacy
```

The alias is a locally encrypted keystore, not a private key argument. If it does not exist, the owner can import it privately with `cast wallet import pactora-testnet --interactive`. Never send the key/password to the agent.

## Evidence Boundaries

The screenshots under `submission/screenshots/` show the **existing live V1 help page**, not V2 functionality or a successful payment. The old live footer's license text is not authoritative; the repository's `LICENSE` is Apache-2.0.

The 2026-11-07 direct RPC formatter run observed an unfunded legacy agreement #1 with a 300 MUSD budget and a wallet with 0 MUSD. It was not a funded escrow demo. V1 is immutable and retains disclosed issues; local V2 fixes do not retroactively fix it.
