"use client";

import { Suspense, use, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AgreementIdSchema } from "@/lib/validation/schemas";
import { CONTRACT_ADDRESSES } from "@/lib/chain/config";
import { JsonRequestError, jsonRequest } from "@/components/wallet/WalletSessionProvider";
import { AgreementNotFoundState } from "@/components/agreements/AgreementNotFoundState";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Receipt = {
  escrow: string; legacy: boolean; historyComplete: boolean; blockNumber: string;
  agreement: { id: number; client: string; provider: string; token: string; symbol: string; state: string; termsHash: string; totalAmount: string; fundedAmount: string; releasedAmount: string; refundedAmount: string; remainingAmount: string; createdAt: string; fundedAt: string; completedAt: string };
  milestones: { index: number; amount: string; state: string; submissionHash: string }[];
  transactions: { hash: string; event: string; blockNumber: string }[];
};

function date(seconds: string) {
  if (seconds === "0") return "Not recorded";
  const value = new Date(Number(seconds) * 1000);
  return Number.isFinite(value.getTime()) ? value.toISOString() : `${seconds} Unix seconds`;
}

function ReceiptContent({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const query = useSearchParams();
  const escrow = query.get("escrow") || CONTRACT_ADDRESSES.PACTORA_ESCROW;
  const parsed = AgreementIdSchema.safeParse(id);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);
  const receipt = useQuery({ queryKey: ["public-receipt", id, escrow], enabled: parsed.success, retry: false, queryFn: () => jsonRequest<Receipt>(`/api/receipts/${id}?escrow=${encodeURIComponent(escrow)}`) });
  const data = receipt.data;
  if (!parsed.success) return <div className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-semibold">Invalid receipt ID</h1><p className="mt-3">Use a positive numeric agreement ID.</p></div>;
  if (receipt.error instanceof JsonRequestError && receipt.error.code === "AGREEMENT_NOT_FOUND") return <AgreementNotFoundState agreementId={id} escrowAddress={escrow} onRetry={() => { void receipt.refetch(); }} />;

  return <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 space-y-6">
    <Link href="/dashboard" className="text-sm text-slate-300 hover:text-white">Back to Pactora</Link>
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div><h1 className="text-2xl sm:text-3xl font-semibold">Agreement #{id} Receipt</h1><p className="mt-2 text-sm text-slate-300">Public on-chain evidence from Mezo Testnet, chain 31611.</p></div>
      <div className="flex gap-2"><Button variant="outline" onClick={() => { void navigator.clipboard.writeText(window.location.href).then(() => { setCopied(true); setCopyError(null); }).catch(() => setCopyError("Clipboard access is unavailable.")); }}>{copied ? "Link copied" : "Copy receipt link"}</Button><Button variant="outline" onClick={() => window.print()}>Print receipt</Button></div>
    </div>
    {copyError && <p role="alert">{copyError}</p>}
    {receipt.isPending && <p role="status" className="text-slate-300">Reading agreement and confirmed transaction logs. No placeholder balances are shown.</p>}
    {receipt.error && <Card><CardHeader><CardTitle>Receipt unavailable</CardTitle><CardDescription>{receipt.error.message}</CardDescription></CardHeader><CardContent><Button onClick={() => { void receipt.refetch(); }}>Retry chain read</Button></CardContent></Card>}
    {data && <>
      <Card className="border-slate-800 bg-[#0f172a]"><CardHeader><div className="flex flex-wrap items-center gap-3"><CardTitle>Confirmed Agreement State</CardTitle><Badge>{data.agreement.state}</Badge>{data.legacy && <Badge variant="secondary">Legacy, read-only</Badge>}</div><CardDescription>Snapshot at Mezo Testnet block {data.blockNumber}. This is not an audit or a judgment of deliverable quality.</CardDescription></CardHeader><CardContent className="space-y-5">
        {data.legacy && <p className="text-sm text-amber-200">V1 has no timeout policy and retains the disclosed resolution/token-accounting issues. New agreements must use V2; this page only preserves historical verification.</p>}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">{[["Agreement total", data.agreement.totalAmount], ["Actually funded", data.agreement.fundedAmount], ["Currently locked", data.agreement.remainingAmount], ["Released", data.agreement.releasedAmount], ["Refunded", data.agreement.refundedAmount]].map(([label, amount]) => <div key={label} className="rounded-lg bg-slate-900 p-4"><p className="text-sm text-slate-300">{label}</p><p className="mt-2 break-all text-xl font-semibold tabular-nums">{amount} {data.agreement.symbol}</p></div>)}</div>
        <div className="space-y-3 text-sm">{[["Client", data.agreement.client], ["Provider", data.agreement.provider], ["Escrow contract", data.escrow], ["Token contract", data.agreement.token]].map(([label, address]) => <p key={label}>{label}: <a className="block break-all text-teal-300 underline" href={`https://explorer.test.mezo.org/${label === "Token contract" ? "token" : "address"}/${address}`} target="_blank" rel="noreferrer">{address}</a></p>)}</div>
        <p className="text-sm">Terms commitment (keccak256): <code className="block break-all mt-1">{data.agreement.termsHash}</code></p>
        <div className="space-y-1 text-sm text-slate-300"><p>Created: {date(data.agreement.createdAt)}</p><p>Funded: {date(data.agreement.fundedAt)}</p><p>Closed: {date(data.agreement.completedAt)}</p></div>
      </CardContent></Card>
      <Card className="border-slate-800 bg-[#0f172a]"><CardHeader><CardTitle>Milestones</CardTitle><CardDescription>States below are contract reads, not fabricated delivery or payment records. A mutual split can close an agreement without individually approving every milestone.</CardDescription></CardHeader><CardContent className="space-y-3">{data.milestones.map((milestone) => <div key={milestone.index} className="flex flex-wrap justify-between gap-3 rounded-lg bg-slate-900 p-4 text-sm"><span>Milestone {milestone.index + 1}: {milestone.state}</span><span className="tabular-nums">{milestone.amount} {data.agreement.symbol}</span></div>)}</CardContent></Card>
      <Card className="border-slate-800 bg-[#0f172a]"><CardHeader><CardTitle>Confirmed Transactions</CardTitle><CardDescription>Events emitted by this escrow for this agreement ID. {!data.historyComplete && "History is bounded to recent blocks plus creation/closure; a complete indexer is not yet implemented."}</CardDescription></CardHeader><CardContent className="space-y-4">{data.transactions.length ? data.transactions.map((transaction, index) => <div key={`${transaction.hash}:${index}`} className="text-sm space-y-1"><p>{transaction.event}, block {transaction.blockNumber}</p><a href={`https://explorer.test.mezo.org/tx/${transaction.hash}`} className="block break-all text-teal-300 underline" target="_blank" rel="noreferrer">{transaction.hash}</a></div>) : <p>No matching transaction logs were returned by the scanned ranges. No hashes have been invented.</p>}</CardContent></Card>
    </>}
  </div>;
}

export default function PublicReceiptPage(props: { params: Promise<{ id: string }> }) {
  return <Suspense fallback={<p className="p-8">Loading public receipt...</p>}><ReceiptContent {...props} /></Suspense>;
}
