"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AGREEMENT_NOT_FOUND_MESSAGE } from "@/lib/chain/agreements";

export function AgreementNotFoundState({
  agreementId,
  escrowAddress,
  creationTxHash,
  onRetry,
}: {
  agreementId: string;
  escrowAddress: string;
  creationTxHash?: string | null;
  onRetry?: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-6 space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">Agreement #{agreementId}</p>
          <h1 className="mt-2 text-2xl font-semibold text-white">{AGREEMENT_NOT_FOUND_MESSAGE}</h1>
          <p className="mt-2 text-sm text-slate-300">No confirmed agreement with this ID exists at the configured Mezo Testnet escrow. No status or zero-value balances are shown.</p>
        </div>
        <div className="text-sm text-slate-300">
          <p>Escrow contract</p>
          <a className="mt-1 block break-all text-teal-300 underline" href={`https://explorer.test.mezo.org/address/${escrowAddress}`} target="_blank" rel="noreferrer">{escrowAddress}</a>
        </div>
        {creationTxHash && <a className="block break-all text-sm text-teal-300 underline" href={`https://explorer.test.mezo.org/tx/${creationTxHash}`} target="_blank" rel="noreferrer">View the recorded creation transaction</a>}
        <div className="flex flex-wrap gap-3">
          {onRetry && <Button onClick={onRetry}>Retry chain read</Button>}
          <Link href="/dashboard"><Button variant="outline">Back to dashboard</Button></Link>
        </div>
      </div>
    </div>
  );
}
