# Mezo Network Configuration

Last verified: **2026-11-10 UTC**. **Testnet only. Unaudited. No subjective dispute arbitration.**

## Mezo Testnet

| Parameter | Value | Verification |
| --- | --- | --- |
| Chain ID | `31611` / `0x7b7b` | Required RPC `eth_chainId` and source registry |
| Gas currency | BTC, 18 decimals | `mezoTestnet.nativeCurrency` in source |
| RPC | https://rpc.test.mezo.org | Used by current server/wallet chain helpers |
| Explorer | https://explorer.test.mezo.org | Default explorer in source |
| Faucet | https://faucet.test.mezo.org/ | Page exposes test BTC/MEZO choices |
| Testnet app | https://testnet.mezo.org | HTTP 200 via `curl.exe`; `/getmusd` guidance links here |
| Canonical MUSD | `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503` | Official reference and V2 `defaultToken()` |
| MUSD decimals | 18 | Live `decimals()` read |
| V2 escrow | `0x907AAB5A6d1710c477B9C1Da3c3b60b1324A060A` | Successful deployment receipt and runtime |
| V1, legacy escrow | `0x1Da50726E11bf828358f6b840900c0a731B2b40F` | Public deployment record and present runtime; historical reads only |

The [network registry](../lib/chain/mezo.ts) and [Wagmi config](../lib/chain/config.ts) fix Mezo Testnet/RPC/MUSD. There is no configured fallback RPC or WebSocket transport in these app paths. Mainnet configuration is outside this testnet-only workflow.

`NEXT_PUBLIC_PACTORA_ESCROW_ADDRESS` supplies the app's build-time escrow. `NEXT_PUBLIC_EXPLORER_URL` optionally overrides link destinations in [AddressChip](../components/ui/AddressChip.tsx) and [TxStatus](../components/tx/TxStatus.tsx), not the chain or token. Legacy template names `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_RPC_URL` and `NEXT_PUBLIC_MUSD_ADDRESS` do not override the V2 registry. Never put server credentials under a `NEXT_PUBLIC_` name; no real env values are shown here.

## MUSD Integration

Pactora uses ERC-20 MUSD allowance, a separate `fundAgreement` deposit and token transfers on approval/timeout/refund/mutual settlement. It does not implement x402 gas sponsorship. Terms are **keccak256/bytes32** commitments; SHA-256 is used for session/link-token storage, not agreement terms.

The bot's real `/getmusd` command directs users to the faucet for test BTC and the Mezo testnet app for MUSD swap/BTC-backed borrowing guidance. The bot does not execute a loan or hold keys. **Pending verification:** actual faucet issuance, swap and borrowing transactions were not performed in Phase 0.

## References

- [Official MUSD reference](https://mezo.org/docs/developers/getting-started/musd-payments-x402/#mezo-x402-reference)
- [Mezo developer getting started](https://mezo.org/docs/developers/getting-started/)
- [Deployment reads, hashes and pending checks](deployments.md)
- [Exact timeout and refund rules](architecture.md#money-flow-and-time-windows)
