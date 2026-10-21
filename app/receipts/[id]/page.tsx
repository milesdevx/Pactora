"use client";

import React, { useEffect, useState, use } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { CONTRACT_ADDRESSES } from "@/lib/chain/config";
import { PACTORA_ESCROW_ABI } from "@/lib/chain/abi/PactoraEscrow";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AddressChip } from "@/components/ui/AddressChip";
import { EscrowVaultBar } from "@/components/agreements/EscrowVaultBar";
import {
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Copy,
  Check,
  Printer,
  Receipt,
  FileCheck,
  Clock,
  Sparkles,
} from "lucide-react";

interface ReceiptPageProps {
  params: Promise<{ id: string }>;
}

export default function ReceiptVerifierPage({ params }: ReceiptPageProps) {
  const resolvedParams = use(params);
  const agreementId = BigInt(resolvedParams.id);
  const shouldReduceMotion = useReducedMotion();

  const [copied, setCopied] = useState(false);
  const [metadata, setMetadata] = useState<any>(null);
  const [isPrinting, setIsPrinting] = useState(false);

  // Read on-chain contract state
  const { data: agreement, isLoading } = useReadContract({
    address: CONTRACT_ADDRESSES.PACTORA_ESCROW,
    abi: PACTORA_ESCROW_ABI,
    functionName: "getAgreement",
    args: [agreementId],
  });

  const { data: milestones } = useReadContract({
    address: CONTRACT_ADDRESSES.PACTORA_ESCROW,
    abi: PACTORA_ESCROW_ABI,
    functionName: "getMilestones",
    args: [agreementId],
  });

  // Fetch off-chain metadata
  useEffect(() => {
    fetch(`/api/agreements/${resolvedParams.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.agreement) setMetadata(data.agreement);
      })
      .catch((err) => console.warn("Failed to fetch metadata:", err));
  }, [resolvedParams.id]);

  const agreementStateMap = ["Created", "Accepted", "Funded", "Completed", "Cancelled"];
  const milestoneStateMap = ["Pending", "Submitted", "Approved", "Rejected"];

  const stateIndex = agreement ? Number(agreement.state) : 0;
  const stateLabel = agreementStateMap[stateIndex] || "Unknown";

  const totalAmount = agreement ? formatUnits(agreement.totalAmount, 18) : metadata?.totalAmount || "0";
  const releasedAmount = agreement ? formatUnits(agreement.releasedAmount, 18) : "0";
  const remainingAmount = agreement
    ? formatUnits(agreement.totalAmount - agreement.releasedAmount - agreement.refundedAmount, 18)
    : "0";

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    setIsPrinting(true);
    setTimeout(() => {
      window.print();
      setIsPrinting(false);
    }, 300);
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8 space-y-8">
      {/* Top Controls */}
      <div className="flex items-center justify-between no-print">
        <Link
          href={`/agreements/${resolvedParams.id}`}
          className="text-xs text-slate-400 hover:text-white transition-colors"
        >
          ← Return to Workspace
        </Link>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyLink}
            className="gap-1.5 text-xs border-slate-700 bg-slate-900/60"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-teal-400" /> : <Copy className="h-3.5 w-3.5" />}
            {copied ? "Link Copied!" : "Copy Verifier Link"}
          </Button>

          <Button
            variant="secondary"
            size="sm"
            onClick={handlePrint}
            className={`gap-1.5 text-xs transition-all ${isPrinting ? "scale-95 ring-2 ring-teal-400" : ""}`}
          >
            <Printer className="h-3.5 w-3.5" />
            Print Receipt
          </Button>
        </div>
      </div>

      {/* Main Verifiable Receipt Card with 3D Flip-in */}
      <motion.div
        initial={{
          opacity: 0,
          rotateX: shouldReduceMotion ? 0 : 12,
          y: shouldReduceMotion ? 0 : 20,
        }}
        animate={{ opacity: 1, rotateX: 0, y: 0 }}
        transition={{ duration: 0.55, ease: [0.25, 0.1, 0.25, 1] }}
        style={{ perspective: 1000 }}
      >
        <Card className="border-slate-800 bg-[#0f172a] shadow-2xl overflow-hidden">
          {/* Receipt Header */}
          <div className="border-b border-slate-800 p-6 sm:p-8 bg-slate-900/60">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded bg-teal-500/10 border border-teal-500/30 text-teal-400 font-bold text-xs">
                    P
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-teal-400">
                    Pactora On-Chain Verifier Receipt
                  </span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                  {metadata?.title || `Escrow Agreement #${resolvedParams.id}`}
                </h1>
                <p className="text-xs text-slate-400">
                  Network: <b>Mezo Testnet (31611)</b> • Token: <b>MUSD (ERC-20)</b>
                </p>
              </div>

              <div className="text-left sm:text-right">
                <Badge
                  variant={
                    stateLabel === "Completed"
                      ? "success"
                      : stateLabel === "Funded"
                      ? "default"
                      : stateLabel === "Cancelled"
                      ? "destructive"
                      : "warning"
                  }
                  className="text-xs px-3.5 py-1 font-semibold"
                >
                  {stateLabel}
                </Badge>
                <p className="text-[11px] font-mono text-slate-400 mt-2">
                  Agreement ID #{resolvedParams.id}
                </p>
              </div>
            </div>
          </div>

          {/* Financial Settlement Breakdown */}
          <CardContent className="p-6 sm:p-8 space-y-8">
            <EscrowVaultBar
              totalAmount={agreement?.totalAmount || BigInt(0)}
              releasedAmount={agreement?.releasedAmount || BigInt(0)}
              refundedAmount={agreement?.refundedAmount || BigInt(0)}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-md">
                <span className="text-xs text-slate-400 block mb-1">Total Funded Escrow</span>
                <p className="text-2xl font-bold font-mono text-white">
                  {totalAmount} <span className="text-sm font-sans font-medium text-teal-400">MUSD</span>
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-md">
                <span className="text-xs text-slate-400 block mb-1">Released Payouts</span>
                <p className="text-2xl font-bold font-mono text-emerald-400">
                  {releasedAmount} <span className="text-sm font-sans font-medium text-emerald-300">MUSD</span>
                </p>
              </div>

              <div className="rounded-2xl border border-slate-800 bg-slate-900/60 p-4 shadow-md">
                <span className="text-xs text-slate-400 block mb-1">Remaining Balance</span>
                <p className="text-2xl font-bold font-mono text-teal-300">
                  {remainingAmount} <span className="text-sm font-sans font-medium text-slate-400">MUSD</span>
                </p>
              </div>
            </div>

            {/* Parties & Cryptographic Addresses */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Contract & Participant Details
              </h3>

              <div className="space-y-2 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-slate-800/80 gap-2">
                  <span className="text-slate-400">Client Address:</span>
                  <AddressChip
                    value={agreement?.client || metadata?.clientAddress || ""}
                    label="Client"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-slate-800/80 gap-2">
                  <span className="text-slate-400">Provider Address:</span>
                  <AddressChip
                    value={agreement?.provider || metadata?.providerAddress || ""}
                    label="Provider"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-slate-800/80 gap-2">
                  <span className="text-slate-400">Pactora Escrow Contract:</span>
                  <AddressChip
                    value={CONTRACT_ADDRESSES.PACTORA_ESCROW}
                    label="Escrow"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-slate-900/40 border border-slate-800/80 gap-2">
                  <span className="text-slate-400">Canonical MUSD Contract:</span>
                  <AddressChip
                    value={CONTRACT_ADDRESSES.MUSD}
                    label="Token"
                  />
                </div>
              </div>
            </div>

            {/* Milestone Payment Schedule with Staggered Entrance */}
            <div className="space-y-3 pt-4 border-t border-slate-800">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Milestone Payment Schedule
              </h3>

              <div className="space-y-2.5">
                {milestones?.map((m, idx) => {
                  const mState = milestoneStateMap[Number(m.state)] || "Pending";
                  const mAmount = formatUnits(m.amount, 18);
                  const offChain = metadata?.milestoneDetails?.[idx];

                  return (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, x: shouldReduceMotion ? 0 : -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        duration: 0.35,
                        delay: shouldReduceMotion ? 0 : idx * 0.08,
                      }}
                      className="flex items-center justify-between p-3.5 rounded-xl border border-slate-800 bg-slate-900/40 text-xs shadow-sm"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-800 text-slate-300 font-bold text-xs border border-slate-700">
                          {idx + 1}
                        </div>
                        <div>
                          <p className="font-semibold text-slate-200">
                            {offChain?.title || `Milestone #${idx + 1}`}
                          </p>
                          <p className="text-[11px] text-slate-400">
                            State: <span className="font-medium text-slate-300">{mState}</span>
                          </p>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="font-mono font-bold text-teal-400">{mAmount} MUSD</p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* Verification Stamp Footer */}
            <div className="pt-6 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-500">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-teal-400" />
                <span>Verifiable on Mezo Testnet Block Explorer</span>
              </div>
              <span className="font-mono">Pactora Protocol v1.0</span>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
