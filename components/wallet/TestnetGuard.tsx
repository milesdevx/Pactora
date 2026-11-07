"use client";

import { useState } from "react";
import { useAccount, useSwitchChain } from "wagmi";
import { Button } from "@/components/ui/button";

export function TestnetGuard() {
  const { chainId, isConnected } = useAccount();
  const { switchChainAsync, isPending } = useSwitchChain();
  const [error, setError] = useState<string | null>(null);
  if (!isConnected || chainId === 31611) return null;
  return <div role="alert" className="rounded-xl bg-amber-950/30 p-4 text-sm text-amber-200 space-y-3">
    <p>Your wallet is not on Mezo Testnet. All Pactora actions use chain 31611 only.</p>
    <Button isLoading={isPending} onClick={() => { setError(null); void switchChainAsync({ chainId: 31611 }).catch(() => setError("Network switch was rejected. Select Mezo Testnet in your wallet.")); }}>Switch to Mezo Testnet</Button>
    {error && <p>{error}</p>}
  </div>;
}
