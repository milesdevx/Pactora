import { defineChain } from "viem";

export const mezoTestnet = defineChain({
  id: 31611,
  name: "Mezo Testnet",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.test.mezo.org"] } },
  blockExplorers: { default: { name: "Mezo Explorer", url: "https://explorer.test.mezo.org" } },
  testnet: true,
});

export const CONTRACT_ADDRESSES = {
  MUSD: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503" as `0x${string}`,
  PACTORA_ESCROW: (process.env.NEXT_PUBLIC_PACTORA_ESCROW_ADDRESS || "0x0000000000000000000000000000000000000000") as `0x${string}`,
};
