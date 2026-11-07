"use client";

import React, { useState } from "react";
import { WagmiProvider as WagmiProviderBase } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { wagmiConfig } from "@/lib/chain/config";
import { WalletSessionProvider } from "./WalletSessionProvider";

export function WagmiProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            staleTime: 5000,
          },
        },
      })
  );

  return (
    <WagmiProviderBase config={wagmiConfig}>
      <QueryClientProvider client={queryClient}><WalletSessionProvider>{children}</WalletSessionProvider></QueryClientProvider>
    </WagmiProviderBase>
  );
}
