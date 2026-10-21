"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatUnits, parseUnits, keccak256, stringToBytes } from "viem";
import { CONTRACT_ADDRESSES, mezoTestnet } from "@/lib/chain/config";
import { PACTORA_ESCROW_ABI } from "@/lib/chain/abi/PactoraEscrow";
import { ERC20_ABI } from "@/lib/chain/abi/IERC20";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input, Textarea } from "@/components/ui/input";
import { StatusDot } from "@/components/agreements/StatusDot";
import { TxStatus } from "@/components/tx/TxStatus";
import { AddressChip } from "@/components/ui/AddressChip";
import { EscrowVaultBar } from "@/components/agreements/EscrowVaultBar";
import {
  ShieldCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  ExternalLink,
  Receipt,
  FileCheck,
  Scale,
  Send,
  XCircle,
  DollarSign,
  Lock,
  ChevronRight,
  AlertTriangle,
  Coins,
  Sparkles,
  X,
} from "lucide-react";

interface AgreementWorkspaceProps {
  params: Promise<{ id: string }>;
}

export default function AgreementWorkspacePage({ params }: AgreementWorkspaceProps) {
  const resolvedParams = use(params);
  const agreementId = BigInt(resolvedParams.id);
  const { address, isConnected } = useAccount();
  const shouldReduceMotion = useReducedMotion();

  // Read on-chain agreement state
  const {
    data: contractAgreement,
    isLoading: isContractLoading,
    refetch: refetchAgreement,
  } = useReadContract({
    address: CONTRACT_ADDRESSES.PACTORA_ESCROW,
    abi: PACTORA_ESCROW_ABI,
    functionName: "getAgreement",
    args: [agreementId],
  });

  // Read on-chain milestones
  const {
    data: contractMilestones,
    isLoading: isMilestonesLoading,
    refetch: refetchMilestones,
  } = useReadContract({
    address: CONTRACT_ADDRESSES.PACTORA_ESCROW,
    abi: PACTORA_ESCROW_ABI,
    functionName: "getMilestones",
    args: [agreementId],
  });

  // Read resolution proposal if any
  const {
    data: resolutionProposal,
    refetch: refetchProposal,
  } = useReadContract({
    address: CONTRACT_ADDRESSES.PACTORA_ESCROW,
    abi: PACTORA_ESCROW_ABI,
    functionName: "getResolutionProposal",
    args: [agreementId],
  });

  // Read MUSD allowance for client
  const { data: musdAllowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACT_ADDRESSES.MUSD,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && CONTRACT_ADDRESSES.PACTORA_ESCROW ? [address, CONTRACT_ADDRESSES.PACTORA_ESCROW] : undefined,
  });

  // Off-chain metadata state
  const [metadata, setMetadata] = useState<any>(null);
  const [submissionNotes, setSubmissionNotes] = useState<{ [key: number]: string }>({});
  const [rejectionReasons, setRejectionReasons] = useState<{ [key: number]: string }>({});
  const [showRejectForm, setShowRejectForm] = useState<number | null>(null);

  // Dispute resolution inputs
  const [resolutionClientRefund, setResolutionClientRefund] = useState("");
  const [resolutionProviderRelease, setResolutionProviderRelease] = useState("");
  const [showDisputeModal, setShowDisputeModal] = useState(false);

  // Wagmi write hooks
  const { data: txHash, writeContractAsync, isPending: isTxPending, error: writeError } = useWriteContract();
  const {
    isLoading: isWaitingForReceipt,
    isSuccess: isReceiptSuccess,
    error: receiptError,
    data: receiptData,
  } = useWaitForTransactionReceipt({ hash: txHash });

  // Fetch off-chain metadata
  useEffect(() => {
    fetch(`/api/agreements/${resolvedParams.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.agreement) setMetadata(data.agreement);
      })
      .catch((err) => console.warn("Off-chain metadata fetch error:", err));
  }, [resolvedParams.id]);

  // Refresh on transaction success
  useEffect(() => {
    if (isReceiptSuccess) {
      refetchAgreement();
      refetchMilestones();
      refetchProposal();
      refetchAllowance();
    }
  }, [isReceiptSuccess, refetchAgreement, refetchMilestones, refetchProposal, refetchAllowance]);

  const agreementStateMap = ["Created", "Accepted", "Funded", "Completed", "Cancelled"];
  const milestoneStateMap = ["Pending", "Submitted", "Approved", "Rejected"];

  const agreementStateIndex = contractAgreement ? Number(contractAgreement.state) : 0;
  const agreementState = agreementStateMap[agreementStateIndex] || "Unknown";

  const clientAddress = contractAgreement?.client?.toLowerCase();
  const providerAddress = contractAgreement?.provider?.toLowerCase();
  const currentAddress = address?.toLowerCase();

  const isClient = currentAddress === clientAddress;
  const isProvider = currentAddress === providerAddress;

  const totalAmountNum = contractAgreement
    ? parseFloat(formatUnits(contractAgreement.totalAmount, 18))
    : parseFloat(metadata?.totalAmount || "0");

  const releasedAmountNum = contractAgreement
    ? parseFloat(formatUnits(contractAgreement.releasedAmount, 18))
    : 0;

  const remainingBalanceNum = contractAgreement
    ? parseFloat(
        formatUnits(
          contractAgreement.totalAmount -
            contractAgreement.releasedAmount -
            contractAgreement.refundedAmount,
          18
        )
      )
    : 0;

  const totalAmountFormatted = totalAmountNum.toFixed(2);
  const releasedAmountFormatted = releasedAmountNum.toFixed(2);
  const remainingBalanceFormatted = remainingBalanceNum.toFixed(2);

  const percentReleased =
    totalAmountNum > 0 ? Math.min(100, Math.round((releasedAmountNum / totalAmountNum) * 100)) : 0;

  // --- Contract Action Handlers ---

  const handleAcceptAgreement = async () => {
    await writeContractAsync({
      address: CONTRACT_ADDRESSES.PACTORA_ESCROW,
      abi: PACTORA_ESCROW_ABI,
      functionName: "acceptAgreement",
      args: [agreementId],
    });
  };

  const handleApproveMUSD = async () => {
    if (!contractAgreement) return;
    await writeContractAsync({
      address: CONTRACT_ADDRESSES.MUSD,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [CONTRACT_ADDRESSES.PACTORA_ESCROW, contractAgreement.totalAmount],
    });
  };

  const handleFundAgreement = async () => {
    await writeContractAsync({
      address: CONTRACT_ADDRESSES.PACTORA_ESCROW,
      abi: PACTORA_ESCROW_ABI,
      functionName: "fundAgreement",
      args: [agreementId],
    });
  };

  const handleSubmitMilestone = async (milestoneIdx: number) => {
    const notes = submissionNotes[milestoneIdx] || `Deliverable for Milestone ${milestoneIdx + 1}`;
    const submissionHash = keccak256(stringToBytes(notes));

    await writeContractAsync({
      address: CONTRACT_ADDRESSES.PACTORA_ESCROW,
      abi: PACTORA_ESCROW_ABI,
      functionName: "submitMilestone",
      args: [agreementId, BigInt(milestoneIdx), submissionHash],
    });
  };

  const handleApproveMilestone = async (milestoneIdx: number) => {
    await writeContractAsync({
      address: CONTRACT_ADDRESSES.PACTORA_ESCROW,
      abi: PACTORA_ESCROW_ABI,
      functionName: "approveMilestone",
      args: [agreementId, BigInt(milestoneIdx)],
    });
  };

  const handleRejectMilestone = async (milestoneIdx: number) => {
    const reason = rejectionReasons[milestoneIdx] || "Revision required";
    const reasonHash = keccak256(stringToBytes(reason));

    await writeContractAsync({
      address: CONTRACT_ADDRESSES.PACTORA_ESCROW,
      abi: PACTORA_ESCROW_ABI,
      functionName: "rejectMilestone",
      args: [agreementId, BigInt(milestoneIdx), reasonHash],
    });

    setShowRejectForm(null);
  };

  const handleCancelUnfunded = async () => {
    await writeContractAsync({
      address: CONTRACT_ADDRESSES.PACTORA_ESCROW,
      abi: PACTORA_ESCROW_ABI,
      functionName: "cancelUnfundedAgreement",
      args: [agreementId],
    });
  };

  const handleProposeResolution = async () => {
    const clientRefundWei = parseUnits(resolutionClientRefund || "0", 18);
    const providerReleaseWei = parseUnits(resolutionProviderRelease || "0", 18);

    await writeContractAsync({
      address: CONTRACT_ADDRESSES.PACTORA_ESCROW,
      abi: PACTORA_ESCROW_ABI,
      functionName: "proposeResolution",
      args: [agreementId, clientRefundWei, providerReleaseWei],
    });

    setShowDisputeModal(false);
  };

  const handleAcceptResolution = async () => {
    await writeContractAsync({
      address: CONTRACT_ADDRESSES.PACTORA_ESCROW,
      abi: PACTORA_ESCROW_ABI,
      functionName: "acceptResolutionProposal",
      args: [agreementId],
    });
  };

  const handleCancelProposal = async () => {
    await writeContractAsync({
      address: CONTRACT_ADDRESSES.PACTORA_ESCROW,
      abi: PACTORA_ESCROW_ABI,
      functionName: "cancelResolutionProposal",
      args: [agreementId],
    });
  };

  const needsAllowance =
    contractAgreement &&
    musdAllowance !== undefined &&
    musdAllowance < contractAgreement.totalAmount;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Breadcrumb & Public Verifier Link */}
      <div className="flex items-center justify-between">
        <Link
          href="/dashboard"
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
        >
          <span>← Back to Dashboard</span>
        </Link>

        <Link href={`/receipts/${resolvedParams.id}`}>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs border-slate-700 bg-slate-900/60">
            <Receipt className="h-3.5 w-3.5 text-teal-400" />
            Public Verifier Receipt
          </Button>
        </Link>
      </div>

      {/* Agreement Top Header Card */}
      <Card className="border-slate-800 bg-[#0f172a] shadow-2xl">
        <CardContent className="pt-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono text-slate-400">
                  Agreement #{resolvedParams.id}
                </span>
                <Badge
                  variant={
                    agreementState === "Funded"
                      ? "default"
                      : agreementState === "Completed"
                      ? "success"
                      : agreementState === "Cancelled"
                      ? "destructive"
                      : "warning"
                  }
                >
                  {agreementState}
                </Badge>
                <Badge variant="outline">Mezo Testnet</Badge>
              </div>

              <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-1">
                {metadata?.title || `Escrow Agreement #${resolvedParams.id}`}
              </h1>
              {metadata?.description && (
                <p className="text-xs text-slate-400 mt-2 max-w-2xl leading-relaxed">
                  {metadata.description}
                </p>
              )}
            </div>

            <div className="text-left sm:text-right">
              <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                Total Escrow Value
              </span>
              <p className="text-2xl sm:text-3xl font-bold font-mono text-teal-400">
                {totalAmountNum.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MUSD
              </p>
              <div className="flex items-center gap-3 mt-1 text-xs text-slate-400 sm:justify-end">
                <span>
                  Released: <b className="text-slate-200 font-mono">{releasedAmountFormatted}</b>
                </span>
                <span>•</span>
                <span>
                  Remaining: <b className="text-teal-300 font-mono">{remainingBalanceFormatted}</b>
                </span>
              </div>
            </div>
          </div>

          {/* Escrow Vault Bar with Released, Refunded & Remaining breakdown */}
          <EscrowVaultBar
            totalAmount={contractAgreement?.totalAmount || BigInt(0)}
            releasedAmount={contractAgreement?.releasedAmount || BigInt(0)}
            refundedAmount={contractAgreement?.refundedAmount || BigInt(0)}
          />

          {/* Parties & On-chain Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            <div className="rounded-xl bg-slate-900/60 p-3.5 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Client Address</span>
                {isClient && <Badge variant="secondary">You</Badge>}
              </div>
              <div>
                {clientAddress || metadata?.clientAddress ? (
                  <AddressChip
                    value={clientAddress || metadata?.clientAddress}
                    className="w-full justify-between"
                  />
                ) : (
                  <span className="text-slate-500 font-mono">Loading...</span>
                )}
              </div>
            </div>

            <div className="rounded-xl bg-slate-900/60 p-3.5 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Provider Address</span>
                {isProvider && <Badge variant="secondary">You</Badge>}
              </div>
              <div>
                {providerAddress || metadata?.providerAddress ? (
                  <AddressChip
                    value={providerAddress || metadata?.providerAddress}
                    className="w-full justify-between"
                  />
                ) : (
                  <span className="text-slate-500 font-mono">Loading...</span>
                )}
              </div>
            </div>

            <div className="rounded-xl bg-slate-900/60 p-3.5 border border-slate-800 space-y-2">
              <span className="text-slate-400 block">Escrow Token</span>
              <div className="flex items-center justify-between">
                <span className="font-medium text-teal-400">MUSD (Canonical Mezo)</span>
                <a
                  href={`https://explorer.test.mezo.org/token/${CONTRACT_ADDRESSES.MUSD}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-slate-400 hover:text-white"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Honest Transaction Choreography */}
      <TxStatus
        isPending={isTxPending}
        hash={txHash}
        isWaitingForReceipt={isWaitingForReceipt}
        isSuccess={isReceiptSuccess}
        error={writeError || receiptError}
        reverted={receiptData?.status === "reverted"}
      />

      {/* Action Bar for Agreement State Transitions */}
      {/* 1. Created -> Provider needs to accept */}
      {agreementState === "Created" && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-200">
                Awaiting Provider Acceptance
              </p>
              <p className="text-xs text-amber-300/80 mt-0.5">
                The designated provider must review and accept the agreement terms before escrow can be funded.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {isProvider && (
              <Button
                onClick={handleAcceptAgreement}
                isLoading={isTxPending || isWaitingForReceipt}
                size="sm"
                className="gap-1.5 shadow-md shadow-teal-500/20"
              >
                <CheckCircle2 className="h-4 w-4" />
                Accept Agreement Terms
              </Button>
            )}

            {isClient && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleCancelUnfunded}
                isLoading={isTxPending || isWaitingForReceipt}
              >
                Cancel Agreement
              </Button>
            )}
          </div>
        </div>
      )}

      {/* 2. Accepted -> Client needs to fund in MUSD (Enhanced with coin animation) */}
      {agreementState === "Accepted" && (
        <div className="rounded-2xl border border-teal-500/30 bg-teal-950/20 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-start gap-3.5">
            {/* Spinning Coin Icon */}
            <motion.div
              animate={shouldReduceMotion ? {} : { rotateY: [0, 360] }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-500/15 text-teal-400 border border-teal-500/30 shrink-0 mt-0.5"
            >
              <Coins className="h-5 w-5" />
            </motion.div>
            <div>
              <p className="text-sm font-semibold text-teal-200">
                Ready for Escrow Deposit
              </p>
              <p className="text-xs text-teal-300/80 mt-0.5">
                The provider has accepted terms. Deposit <b>{totalAmountFormatted} MUSD</b> into the smart contract escrow.
              </p>
            </div>
          </div>

          {isClient && (
            <div className="flex items-center gap-3">
              {needsAllowance ? (
                <Button
                  onClick={handleApproveMUSD}
                  isLoading={isTxPending || isWaitingForReceipt}
                  size="sm"
                  className="gap-1.5 shadow-lg shadow-teal-500/20"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Step 1: Approve MUSD
                </Button>
              ) : (
                <Button
                  onClick={handleFundAgreement}
                  isLoading={isTxPending || isWaitingForReceipt}
                  size="sm"
                  className="gap-1.5 shadow-lg shadow-teal-500/20"
                >
                  <DollarSign className="h-4 w-4" />
                  Step 2: Deposit {totalAmountFormatted} MUSD
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Active Resolution Proposal Banner */}
      {resolutionProposal?.exists && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/20 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
          <div className="flex items-start gap-3">
            <Scale className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-200">
                Mutual Dispute Resolution Proposed
              </p>
              <p className="text-xs text-amber-300/80 mt-1">
                Proposed split:{" "}
                <b>{formatUnits(resolutionProposal.clientRefundAmount, 18)} MUSD</b> refunded to
                Client,{" "}
                <b>{formatUnits(resolutionProposal.providerReleaseAmount, 18)} MUSD</b> released to
                Provider.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {resolutionProposal.proposedBy.toLowerCase() !== currentAddress ? (
              <Button
                onClick={handleAcceptResolution}
                isLoading={isTxPending || isWaitingForReceipt}
                size="sm"
                className="gap-1.5"
              >
                Accept Resolution Split
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleCancelProposal}
                isLoading={isTxPending || isWaitingForReceipt}
              >
                Withdraw Proposal
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Milestone Timeline with 2px Vertical Connected Track */}
      <Card className="border-slate-800 bg-[#0f172a] shadow-xl">
        <CardHeader className="flex flex-row items-center justify-between pb-4">
          <div>
            <CardTitle>Milestone Timeline & Deliverables</CardTitle>
            <CardDescription>
              Submit deliverable evidence or approve milestones to disburse funds.
            </CardDescription>
          </div>

          {agreementState === "Funded" && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowDisputeModal(true)}
              className="gap-1.5 text-xs border-amber-500/40 text-amber-300 hover:bg-amber-950/30"
            >
              <Scale className="h-3.5 w-3.5 text-amber-400" />
              Propose Resolution
            </Button>
          )}
        </CardHeader>

        <CardContent className="space-y-6 pt-2">
          {/* Milestones list with Left Vertical Track */}
          {contractMilestones && contractMilestones.length > 0 ? (
            <div className="relative pl-6 sm:pl-8 space-y-6">
              {/* 2px Gradient Vertical Track */}
              <div className="absolute left-2.5 sm:left-3.5 top-4 bottom-4 w-0.5 bg-gradient-to-b from-teal-500 via-slate-700 to-slate-800" />

              {contractMilestones.map((m, idx) => {
                const milestoneStateIndex = Number(m.state);
                const mState = milestoneStateMap[milestoneStateIndex] || "Pending";
                const amountFormatted = formatUnits(m.amount, 18);
                const offChainMilestone = metadata?.milestoneDetails?.[idx];

                const yourMove =
                  (isClient && mState === "Submitted") ||
                  (isProvider && (mState === "Pending" || mState === "Rejected"));

                return (
                  <div key={idx} className="relative">
                    {/* Node on vertical track with meaningful pulse */}
                    <div className="absolute -left-6 sm:-left-8 top-5 flex items-center justify-center">
                      <StatusDot yourMove={yourMove} />
                    </div>

                    {/* Milestone Card with Motion & Rejection Shake */}
                    <motion.div
                      animate={
                        mState === "Rejected" && !shouldReduceMotion
                          ? { x: [0, -6, 6, -4, 4, -2, 2, 0] }
                          : {}
                      }
                      transition={{ duration: 0.4 }}
                      className={`rounded-2xl border p-5 transition-all shadow-md ${
                        mState === "Approved"
                          ? "border-emerald-500/30 bg-emerald-950/10 shadow-emerald-500/5"
                          : mState === "Submitted"
                          ? "border-teal-500/40 bg-teal-950/15 shadow-teal-500/5"
                          : mState === "Rejected"
                          ? "border-rose-500/40 bg-rose-950/15 shadow-rose-500/5"
                          : "border-slate-800 bg-slate-900/40"
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <div
                            className={`flex h-8 w-8 items-center justify-center rounded-xl font-bold text-xs shrink-0 mt-0.5 border ${
                              mState === "Approved"
                                ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                                : mState === "Submitted"
                                ? "bg-teal-500/20 text-teal-300 border-teal-500/30"
                                : mState === "Rejected"
                                ? "bg-rose-500/20 text-rose-400 border-rose-500/30"
                                : "bg-slate-800 text-slate-400 border-slate-700"
                            }`}
                          >
                            {mState === "Approved" ? (
                              <CheckCircle2 className="h-4 w-4" />
                            ) : (
                              idx + 1
                            )}
                          </div>

                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="text-sm font-semibold text-white">
                                {offChainMilestone?.title || `Milestone #${idx + 1}`}
                              </h4>
                              <motion.div
                                layoutId={shouldReduceMotion ? undefined : `milestone-badge-${idx}`}
                                transition={{ type: "spring", stiffness: 400, damping: 30 }}
                              >
                                <Badge
                                  variant={
                                    mState === "Approved"
                                      ? "success"
                                      : mState === "Submitted"
                                      ? "default"
                                      : mState === "Rejected"
                                      ? "destructive"
                                      : "secondary"
                                  }
                                >
                                  {mState}
                                </Badge>
                              </motion.div>
                              {yourMove && (
                                <span className="text-[10px] font-semibold text-teal-300 bg-teal-500/15 border border-teal-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
                                  Your action needed
                                </span>
                              )}
                            </div>

                            {offChainMilestone?.description && (
                              <p className="text-xs text-slate-400 mt-1">
                                {offChainMilestone.description}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="text-left sm:text-right">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                            Milestone Payout
                          </span>
                          <p className="text-base font-bold font-mono text-teal-400">
                            {amountFormatted} MUSD
                          </p>
                        </div>
                      </div>

                      {/* Deliverable submission proof */}
                      {m.submissionHash !==
                        "0x0000000000000000000000000000000000000000000000000000000000000000" && (
                        <div className="mt-3 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400 gap-2 flex-wrap">
                          <AddressChip
                            value={m.submissionHash}
                            type="tx"
                            label="Proof Hash"
                            showExplorerLink={false}
                          />
                          <span className="text-teal-400 font-medium">Deliverable Attached</span>
                        </div>
                      )}

                      {/* Rejection reason notice */}
                      {mState === "Rejected" && (
                        <div className="mt-3 p-3 rounded-lg border border-rose-500/30 bg-rose-950/20 text-xs text-rose-300">
                          <span className="font-semibold block mb-0.5">Rejection Notice:</span>
                          Client requested revisions. Please review specs and resubmit deliverable.
                        </div>
                      )}

                      {/* Action buttons per milestone */}
                      {agreementState === "Funded" && (
                        <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-end gap-3">
                          {/* Provider Submission Form */}
                          {isProvider && (mState === "Pending" || mState === "Rejected") && (
                            <div className="w-full space-y-2">
                              <Input
                                placeholder="Enter deliverable notes, PR link, or IPFS URI..."
                                value={submissionNotes[idx] || ""}
                                onChange={(e) =>
                                  setSubmissionNotes({
                                    ...submissionNotes,
                                    [idx]: e.target.value,
                                  })
                                }
                                className="text-xs"
                              />
                              <div className="flex justify-end">
                                <Button
                                  size="sm"
                                  onClick={() => handleSubmitMilestone(idx)}
                                  isLoading={isTxPending || isWaitingForReceipt}
                                  className="gap-1.5 text-xs shadow-md shadow-teal-500/20"
                                >
                                  <Send className="h-3.5 w-3.5" />
                                  Submit for Client Review
                                </Button>
                              </div>
                            </div>
                          )}

                          {/* Client Approval / Rejection Controls */}
                          {isClient && mState === "Submitted" && (
                            <>
                              {showRejectForm === idx ? (
                                <div className="w-full space-y-2">
                                  <Input
                                    placeholder="State reason for rejection / requested revisions..."
                                    value={rejectionReasons[idx] || ""}
                                    onChange={(e) =>
                                      setRejectionReasons({
                                        ...rejectionReasons,
                                        [idx]: e.target.value,
                                      })
                                    }
                                    className="text-xs"
                                  />
                                  <div className="flex justify-end gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => setShowRejectForm(null)}
                                    >
                                      Cancel
                                    </Button>
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      onClick={() => handleRejectMilestone(idx)}
                                      isLoading={isTxPending || isWaitingForReceipt}
                                    >
                                      Confirm Rejection
                                    </Button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setShowRejectForm(idx)}
                                    className="text-xs text-rose-400 hover:text-rose-300 hover:bg-rose-950/20"
                                  >
                                    Reject with Reason
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={() => handleApproveMilestone(idx)}
                                    isLoading={isTxPending || isWaitingForReceipt}
                                    className="gap-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-lg shadow-emerald-500/20"
                                  >
                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                    Approve & Release {amountFormatted} MUSD
                                  </Button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      )}
                    </motion.div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-slate-500 text-xs">
              Loading milestone state from blockchain...
            </div>
          )}
        </CardContent>
      </Card>

      {/* AnimatePresence Dispute Settlement Modal */}
      <AnimatePresence>
        {showDisputeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowDisputeModal(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            />

            {/* Modal Panel */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 16 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg rounded-2xl border border-amber-500/30 bg-[#0f172a] p-6 shadow-2xl z-10 space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="text-base font-bold text-white flex items-center gap-2">
                    <Scale className="h-5 w-5 text-amber-400" />
                    Propose Mutual Consent Settlement
                  </h4>
                  <p className="text-xs text-slate-400 mt-1">
                    Divide remaining unreleased escrow of{" "}
                    <b className="text-white">{remainingBalanceFormatted} MUSD</b>. Both parties must execute consent on-chain.
                  </p>
                </div>
                <button
                  onClick={() => setShowDisputeModal(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Refund to Client (MUSD)
                  </label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={resolutionClientRefund}
                    onChange={(e) => setResolutionClientRefund(e.target.value)}
                    className="font-mono focus:ring-teal-400 focus:border-teal-400"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Release to Provider (MUSD)
                  </label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="0"
                    value={resolutionProviderRelease}
                    onChange={(e) => setResolutionProviderRelease(e.target.value)}
                    className="font-mono focus:ring-teal-400 focus:border-teal-400"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowDisputeModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleProposeResolution}
                  isLoading={isTxPending || isWaitingForReceipt}
                  className="shadow-lg shadow-teal-500/20"
                >
                  Submit Proposal
                </Button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
