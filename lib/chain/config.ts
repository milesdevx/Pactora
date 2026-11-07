import { defineChain } from "viem";
import { http, createConfig, injected } from "wagmi";

/**
 * Official Mezo Testnet chain definition
 * Verified from https://mezo.org/docs/developers/
 */
export const mezoTestnet = defineChain({
  id: 31611,
  name: "Mezo Testnet",
  nativeCurrency: {
    name: "Bitcoin",
    symbol: "BTC",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_RPC_URL || "https://rpc.test.mezo.org"],
    },
    public: {
      http: ["https://rpc.test.mezo.org", "https://mezo-testnet.drpc.org"],
    },
  },
  blockExplorers: {
    default: {
      name: "Mezo Explorer",
      url: process.env.NEXT_PUBLIC_EXPLORER_URL || "https://explorer.test.mezo.org",
    },
  },
  testnet: true,
});

/**
 * Official Verified Contract Addresses on Mezo Testnet
 */
export const CONTRACT_ADDRESSES = {
  // Verified MUSD Testnet address
  MUSD: (process.env.NEXT_PUBLIC_MUSD_ADDRESS ||
    "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503") as `0x${string}`,
  // PactoraEscrow contract (configured upon deployment)
  PACTORA_ESCROW: (process.env.NEXT_PUBLIC_PACTORA_ESCROW_ADDRESS ||
    "0x0000000000000000000000000000000000000000") as `0x${string}`,
};

export const wagmiConfig = createConfig({
  chains: [mezoTestnet],
  connectors: [injected()],
  transports: {
    [mezoTestnet.id]: http(mezoTestnet.rpcUrls.default.http[0]),
  },
  ssr: true,
});
