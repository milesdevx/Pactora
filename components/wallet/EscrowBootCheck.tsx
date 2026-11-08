"use client";

import React, { useEffect, useState } from "react";
import { usePublicClient } from "wagmi";
import { CONTRACT_ADDRESSES } from "@/lib/chain/config";
import { PACTORA_ESCROW_ABI } from "@/lib/chain/abi/PactoraEscrow";
import { AlertTriangle, ExternalLink, ShieldAlert, CheckCircle2 } from "lucide-react";

export function EscrowBootCheck() {
  const publicClient = usePublicClient({ chainId: 31611 });
  const [bootState, setBootState] = useState<{
    checked: boolean;
    error: string | null;
    isLegacy: boolean;
    hasCode: boolean;
    count: number | null;
  }>({
    checked: false,
    error: null,
    isLegacy: false,
    hasCode: true,
    count: null,
  });

  const escrowAddress = CONTRACT_ADDRESSES.PACTORA_ESCROW;

  useEffect(() => {
    let cancelled = false;

    async function checkContract() {
      if (!publicClient) return;

      if (!escrowAddress || escrowAddress === "0x0000000000000000000000000000000000000000") {
        setBootState({
          checked: true,
          error: "NEXT_PUBLIC_PACTORA_ESCROW_ADDRESS is not configured in the application environment.",
          isLegacy: false,
          hasCode: false,
          count: null,
        });
        return;
      }

      try {
        const bytecode = await publicClient.getBytecode({ address: escrowAddress });
        if (!bytecode || bytecode === "0x") {
          if (!cancelled) {
            setBootState({
              checked: true,
              error: `Escrow address ${escrowAddress} has no bytecode deployed on Mezo Testnet (Chain ID 31611). Confirm NEXT_PUBLIC_PACTORA_ESCROW_ADDRESS.`,
              isLegacy: false,
              hasCode: false,
              count: null,
            });
          }
          return;
        }

        let count: number | null = null;
        try {
          const countBigInt = await publicClient.readContract({
            address: escrowAddress,
            abi: PACTORA_ESCROW_ABI,
            functionName: "getAgreementCount",
          });
          count = Number(countBigInt);
        } catch {
          if (!cancelled) {
            setBootState({
              checked: true,
              error: `Contract at ${escrowAddress} does not match expected ABI (getAgreementCount reverted). Verify contract configuration.`,
              isLegacy: false,
              hasCode: true,
              count: null,
            });
          }
          return;
        }

        let isLegacy = false;
        try {
          const version = await publicClient.readContract({
            address: escrowAddress,
            abi: PACTORA_ESCROW_ABI,
            functionName: "VERSION",
          });
          isLegacy = version !== 2n;
        } catch {
          // Revert indicates legacy V1 deployment
          isLegacy = true;
        }

        if (!cancelled) {
          setBootState({
            checked: true,
            error: null,
            isLegacy,
            hasCode: true,
            count,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setBootState({
            checked: true,
            error: err instanceof Error ? err.message : "Escrow verification failed.",
            isLegacy: false,
            hasCode: true,
            count: null,
          });
        }
      }
    }

    void checkContract();
    return () => {
      cancelled = true;
    };
  }, [publicClient, escrowAddress]);

  if (!bootState.checked) return null;

  if (bootState.error) {
    return (
      <div
        role="alert"
        className="w-full bg-red-950/80 border-b border-red-500/40 px-4 py-2.5 text-xs text-red-200 flex flex-wrap items-center justify-between gap-3 shadow-lg"
      >
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-red-400 shrink-0" />
          <span className="font-semibold">Escrow Contract Configuration Error:</span>
          <span>{bootState.error}</span>
        </div>
        <a
          href={`https://explorer.test.mezo.org/address/${escrowAddress}`}
          target="_blank"
          rel="noreferrer"
          className="underline inline-flex items-center gap-1 font-mono text-red-300 hover:text-white"
        >
          View Address on Mezo Explorer
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    );
  }

  if (bootState.isLegacy) {
    return (
      <div
        role="status"
        className="w-full bg-amber-950/40 border-b border-amber-500/30 px-4 py-2 text-xs text-amber-200 flex flex-wrap items-center justify-between gap-3"
      >
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span>
            <b>Legacy Contract Active:</b> Deployed escrow at{" "}
            <code className="font-mono text-amber-300">{escrowAddress.slice(0, 8)}...{escrowAddress.slice(-6)}</code>{" "}
            is running Pactora V1 (Agreement count: {bootState.count}). New agreements require Pactora V2.
          </span>
        </div>
        <a
          href={`https://explorer.test.mezo.org/address/${escrowAddress}`}
          target="_blank"
          rel="noreferrer"
          className="underline inline-flex items-center gap-1 font-mono text-amber-300 hover:text-white"
        >
          Mezo Explorer
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    );
  }

  return null;
}
