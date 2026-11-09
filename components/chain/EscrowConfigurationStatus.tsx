"use client";

import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { jsonRequest } from "@/components/wallet/WalletSessionProvider";
import { CONTRACT_ADDRESSES } from "@/lib/chain/config";

type HealthResponse = { status: "ok"; escrow: { address: string; version: number; agreementCount: string; defaultToken: string; allowlistEnforced: boolean; defaultTokenAllowed: boolean } };

export function EscrowConfigurationStatus() {
  const health = useQuery({
    queryKey: ["pactora-health"],
    queryFn: () => jsonRequest<HealthResponse>("/api/health"),
    retry: false,
  });

  if (!health.error) return null;
  return (
    <div role="alert" className="border-b border-rose-500/30 bg-rose-950/30 px-4 py-3 text-sm text-rose-100">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold">Pactora contract configuration error</p>
          <p className="mt-1 text-xs text-rose-200">{health.error.message} On-chain reads and actions are unavailable at <span className="break-all font-mono">{CONTRACT_ADDRESSES.PACTORA_ESCROW}</span>.</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => { void health.refetch(); }}>Retry configuration check</Button>
      </div>
    </div>
  );
}
