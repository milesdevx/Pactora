"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { WalletSessionControls, useWalletSession, jsonRequest } from "@/components/wallet/WalletSessionProvider";
import { TestnetGuard } from "@/components/wallet/TestnetGuard";
import { formatMusdAmount, parseMusdAmount } from "@/lib/chain/amounts";

type Agreement = { onChainId: number; title: string; clientAddress: string; providerAddress: string; totalAmount: string; remainingAmount: string; state: number; milestoneStates: number[] };
const states = ["Created", "Accepted", "Funded", "Completed", "Cancelled"];

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const session = useWalletSession();
  const [filter, setFilter] = useState<"all" | "client" | "provider">("all");
  const query = useQuery({ queryKey: ["wallet-agreements", address], enabled: session.authenticated, retry: false, queryFn: () => jsonRequest<{ agreements: Agreement[] }>(`/api/agreements?wallet=${address?.toLowerCase()}`) });
  const agreements = query.data?.agreements;
  const listed = agreements?.filter((agreement) => filter === "all" || (filter === "client" ? agreement.clientAddress === address?.toLowerCase() : agreement.providerAddress === address?.toLowerCase()));
  const funded = listed?.filter((agreement) => agreement.state === 2);
  const locked = funded?.reduce((sum, agreement) => sum + parseMusdAmount(agreement.remainingAmount), 0n);
  const needingAction = listed?.filter((agreement) => agreement.state === 0 && agreement.providerAddress === address?.toLowerCase() || agreement.state === 1 && agreement.clientAddress === address?.toLowerCase() || agreement.state === 2 && agreement.milestoneStates.some((state) => agreement.clientAddress === address?.toLowerCase() ? state === 1 : state === 0 || state === 3));
  return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 space-y-6">
    <div className="flex flex-wrap justify-between gap-4"><div><h1 className="text-2xl sm:text-3xl font-semibold">Agreements Dashboard</h1><p className="mt-2 text-sm text-slate-300">Verified terms, checked against current Mezo Testnet state. Up to 50 registered agreements are listed.</p></div><Link href="/agreements/create"><Button>Create New Agreement</Button></Link></div>
    <TestnetGuard /><WalletSessionControls />
    {!isConnected && <p className="text-sm text-slate-300">Connect and sign in with your wallet to see its agreements. Missing data is not displayed as a zero balance.</p>}
    {query.error && <Card><CardHeader><CardTitle>Agreement data unavailable</CardTitle><CardDescription>{query.error.message}</CardDescription></CardHeader><CardContent><Button onClick={() => { void query.refetch(); }}>Retry</Button></CardContent></Card>}
    {session.authenticated && query.isPending && <p role="status" className="text-slate-300">Reading registered agreements and confirming chain state...</p>}
    {listed && <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{[["Listed agreements", String(listed.length)], ["Funded escrow still locked", `${formatMusdAmount(locked || 0n)} MUSD`], ["Needing your action", String(needingAction?.length || 0)]].map(([label, value]) => <Card key={label} className="border-slate-800 bg-[#0f172a]"><CardContent className="p-5"><p className="text-sm text-slate-300">{label}</p><p className="mt-3 text-2xl font-semibold tabular-nums break-all">{value}</p></CardContent></Card>)}</div>}
    <Card className="border-slate-800 bg-[#0f172a]"><CardHeader><div className="flex flex-wrap justify-between gap-3"><CardTitle>Your Registered Agreements</CardTitle><div className="flex gap-2">{(["all", "client", "provider"] as const).map((value) => <Button key={value} variant={filter === value ? "default" : "outline"} size="sm" onClick={() => setFilter(value)}>{value === "all" ? "All" : value === "client" ? "As client" : "As provider"}</Button>)}</div></div><CardDescription>No decorative activity charts or fabricated balances. A missing registration is not proof an on-chain agreement does not exist.</CardDescription></CardHeader><CardContent className="space-y-3">
      {!session.authenticated && <p className="text-sm text-slate-300">Sign in to load protected agreement metadata.</p>}
      {listed?.length === 0 && <p className="text-sm text-slate-300">No verified registered agreements were found for this wallet and filter. Create an agreement, or use the public on-chain receipt for an unregistered or legacy agreement.</p>}
      {listed?.map((agreement) => <Link href={`/agreements/${agreement.onChainId}`} key={agreement.onChainId} className="flex flex-wrap justify-between gap-3 rounded-xl bg-slate-900 p-4 hover:bg-slate-800 focus-visible:outline focus-visible:outline-teal-300"><div><p className="text-sm font-semibold">#{agreement.onChainId}: {agreement.title}</p><p className="mt-1 text-sm text-slate-300">{agreement.clientAddress === address?.toLowerCase() ? "Client" : "Provider"}</p></div><div className="text-right space-y-2"><Badge>{states[agreement.state]}</Badge><p className="text-sm tabular-nums">{agreement.totalAmount} MUSD agreement total</p></div></Link>)}
    </CardContent></Card>
  </div>;
}
