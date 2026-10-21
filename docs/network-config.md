# Mezo Network Configuration & Verification

## Verified Mezo Testnet Parameters

Verified live against official Mezo documentation (`https://mezo.org/docs/developers/`) and live JSON-RPC query:

- **Network Name:** Mezo Testnet
- **Chain ID:** `31611` (Hex: `0x7b7b`)
- **Native Gas Token:** BTC (18 decimals)
- **HTTPS RPC URL:** `https://rpc.test.mezo.org`
- **Fallback RPC URL:** `https://mezo-testnet.drpc.org`
- **WebSocket RPC URL:** `wss://rpc-ws.test.mezo.org`
- **Block Explorer:** `https://explorer.test.mezo.org`
- **Faucet:** `https://faucet.test.mezo.org/`

## Verified MUSD Contract on Mezo Testnet

- **Contract Address:** `0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503`
- **Token Name:** Mezo USD (MUSD)
- **Decimals:** 18 (`0x12` verified via `eth_call` to `decimals()`)
- **Type:** ERC-20 Bitcoin-backed stablecoin

## Verified Mezo Mainnet Parameters (Reference Only)

- **Network Name:** Mezo Mainnet
- **Chain ID:** `31612` (Hex: `0x7b7c`)
- **Native Gas Token:** BTC (18 decimals)
- **HTTPS RPC URL:** `https://rpc.mezo.org`
- **Block Explorer:** `https://explorer.mezo.org`
- **MUSD Mainnet Address:** `0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186`

> **Security Note:** Contracts must not be deployed to mainnet without completed independent security audits.

