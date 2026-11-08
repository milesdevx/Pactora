"use client";

import React, { useState, useEffect, use } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useAccount, useBlock, useReadContract, useWriteContract } from "wagmi";
import { formatUnits, keccak256, stringToBytes } from "viem";
import { useQuery } from "@tanstack/react-query";
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
import { AgreementIdSchema } from "@/lib/validation/schemas";
import { formatChainTime, parseMusdAmount, percentageOf } from "@/lib/chain/amounts";
import { useConfirmedTransaction } from "@/lib/hooks/useConfirmedTransaction";
import { useMoneyConfirmation } from "@/components/tx/MoneyConfirmation";
import { TestnetGuard } from "@/components/wallet/TestnetGuard";
import { WalletSessionControls, useWalletSession, jsonRequest } from "@/components/wallet/WalletSessionProvider";
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
  const parsedId = AgreementIdSchema.safeParse(resolvedParams.id);
  const agreementId = parsedId.success ? BigInt(parsedId.data) : 0n;
  const { address, isConnected } = useAccount();
  const shouldReduceMotion = useReducedMotion();

  // Read on-chain agreement state
  const {
    data: contractAgreement,
    error: contractReadError,
    isLoading: isContractLoading,
    refetch: refetchAgreement,
  } = useReadContract({
    address: CONTRACT_ADDRESSES.PACTORA_ESCROW,
    abi: PACTORA_ESCROW_ABI,
    functionName: "getAgreement",
    args: [agreementId],
    chainId: 31611,
    query: { enabled: parsedId.success },
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
    chainId: 31611,
    query: { enabled: parsedId.success },
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
    chainId: 31611,
    query: { enabled: parsedId.success },
  });

  // Read MUSD allowance for client
  const { data: musdAllowance, refetch: refetchAllowance } = useReadContract({
    address: CONTRACT_ADDRESSES.MUSD,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: address && CONTRACT_ADDRESSES.PACTORA_ESCROW ? [address, CONTRACT_ADDRESSES.PACTORA_ESCROW] : undefined,
    chainId: 31611,
    query: { enabled: Boolean(address && parsedId.success) },
  });
  const { data: contractVersion } = useReadContract({ address: CONTRACT_ADDRESSES.PACTORA_ESCROW, abi: PACTORA_ESCROW_ABI, functionName: "VERSION", chainId: 31611 });
  const { data: block } = useBlock({ chainId: 31611, query: { refetchInterval: 15_000 } });
  const now = block?.timestamp || 0n;
  const reviewWindow = 7n * 24n * 60n * 60n;

  // Off-chain metadata state
  const session = useWalletSession();
  const metadataQuery = useQuery({ queryKey: ["agreement-metadata", resolvedParams.id, address], enabled: parsedId.success && session.authenticated, retry: false, queryFn: () => jsonRequest<{ agreement: { title: string; description?: string; creationTxHash?: string; milestoneDetails: { title: string; description?: string }[] } }>(`/api/agreements/${resolvedParams.id}`) });
  const metadata = metadataQuery.data?.agreement;
  const evidenceQuery = useQuery({ queryKey: ["agreement-evidence", resolvedParams.id, address], enabled: parsedId.success && session.authenticated, retry: false, queryFn: () => jsonRequest<{ evidence: { milestoneIndex: number; kind: string; text: string; contentHash: string; txHash: string }[] }>(`/api/agreements/${resolvedParams.id}/evidence`) });
  const [submissionNotes, setSubmissionNotes] = useState<{ [key: number]: string }>({});
  const [rejectionReasons, setRejectionReasons] = useState<{ [key: number]: string }>({});
  const [showRejectForm, setShowRejectForm] = useState<number | null>(null);

  // Dispute resolution inputs
  const [resolutionClientRefund, setResolutionClientRefund] = useState("");
  const [resolutionProviderRelease, setResolutionProviderRelease] = useState("");
  const [showDisputeModal, setShowDisputeModal] = useState(false);

  // Wagmi write hooks
  const { writeContractAsync } = useWriteContract();
  const transaction = useConfirmedTransaction();
  const money = useMoneyConfirmation();
  const { hash: txHash, isPending: isTxPending, isWaitingForReceipt, isSuccess: isReceiptSuccess, error: writeError, receipt: receiptData } = transaction;
  const receiptError = null;
  const [evidenceError, setEvidenceError] = useState<string | null>(null);

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
  const milestoneStateMap = ["Pending", "Submitted", "Approved", "Rejected", "Refunded"];

  const agreementStateIndex = contractAgreement ? Number(contractAgreement.state) : -1;
  const agreementState = agreementStateMap[agreementStateIndex] || "Unknown";

  const clientAddress = contractAgreement?.client?.toLowerCase();
  const providerAddress = contractAgreement?.provider?.toLowerCase();
  const currentAddress = address?.toLowerCase();

  const isClient = Boolean(currentAddress && currentAddress === clientAddress);
  const isProvider = Boolean(currentAddress && currentAddress === providerAddress);

  const remainingWei = contractAgreement ? contractAgreement.totalAmount - contractAgreement.releasedAmount - contractAgreement.refundedAmount : 0n;
  const totalAmountFormatted = contractAgreement ? formatUnits(contractAgreement.totalAmount, 18) : "Unavailable";
  const releasedAmountFormatted = contractAgreement ? formatUnits(contractAgreement.releasedAmount, 18) : "Unavailable";
  const remainingBalanceFormatted = contractAgreement ? formatUnits(remainingWei, 18) : "Unavailable";
  const percentReleased = contractAgreement ? percentageOf(contractAgreement.releasedAmount, contractAgreement.totalAmount) : 0;

  async function confirmTransfer(title: string, explanation: string, amount: bigint, recipient: string) {
    return money.confirm({ title, explanation, transfers: [{ label: "Exact amount", amount: formatUnits(amount, 18), recipient, token: contractAgreement!.token }] });
  }

  // --- Contract Action Handlers ---

  const handleAcceptAgreement = async () => {
    await transaction.execute(() => writeContractAsync({
      address: CONTRACT_ADDRESSES.PACTORA_ESCROW,
      abi: PACTORA_ESCROW_ABI,
      functionName: "acceptAgreement",
      args: [agreementId],
      chainId: 31611,
      account: address,
    }));
  };

  const handleApproveMUSD = async () => {
    if (!contractAgreement) return;
    if (!await confirmTransfer("Approve MUSD allowance", "This grants the escrow a limited allowance. It does not deposit funds yet.", contractAgreement.totalAmount, CONTRACT_ADDRESSES.PACTORA_ESCROW)) return;
    await transaction.execute(() => writeContractAsync({
      address: CONTRACT_ADDRESSES.MUSD,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [CONTRACT_ADDRESSES.PACTORA_ESCROW, contractAgreement.totalAmount],
      chainId: 31611,
      account: address,
    }), false);
    void refetchAllowance();
  };

  const handleFundAgreement = async () => {
    if (!contractAgreement || !await confirmTransfer("Fund agreement", "Deposit the exact agreement total into the testnet escrow.", contractAgreement.totalAmount, CONTRACT_ADDRESSES.PACTORA_ESCROW)) return;
    await transaction.execute(() => writeContractAsync({
      address: CONTRACT_ADDRESSES.PACTORA_ESCROW,
      abi: PACTORA_ESCROW_ABI,
      functionName: "fundAgreement",
      args: [agreementId],
      chainId: 31611,
      account: address,
    }));
  };

  const handleSubmitMilestone = async (milestoneIdx: number) => {
    const notes = submissionNotes[milestoneIdx]?.trim();
    if (!notes || notes.length > 2000) { transaction.setError(new Error("Enter actual deliverable notes or a URL, at most 2000 characters.")); return; }
    const submissionHash = keccak256(stringToBytes(notes));

    const confirmed = await transaction.execute(() => writeContractAsync({
      address: CONTRACT_ADDRESSES.PACTORA_ESCROW,
      abi: PACTORA_ESCROW_ABI,
      functionName: "submitMilestone",
      args: [agreementId, BigInt(milestoneIdx), submissionHash],
      chainId: 31611,
      account: address,
    }), false);
    if (confirmed) await storeEvidence(milestoneIdx, "submission", notes, confirmed.transactionHash);
  };

  const handleApproveMilestone = async (milestoneIdx: number) => {
    const milestone = contractMilestones?.[milestoneIdx];
    if (!milestone || !contractAgreement || !await confirmTransfer("Approve and release payment", "Transfer this milestone's amount from escrow to the provider.", milestone.amount, contractAgreement.provider)) return;
    await transaction.execute(() => writeContractAsync({
      address: CONTRACT_ADDRESSES.PACTORA_ESCROW,
      abi: PACTORA_ESCROW_ABI,
      functionName: "approveMilestone",
      args: [agreementId, BigInt(milestoneIdx)],
      chainId: 31611,
      account: address,
    }));
  };

  const handleRejectMilestone = async (milestoneIdx: number) => {
    const reason = rejectionReasons[milestoneIdx]?.trim();
    if (!reason || reason.length > 2000) { transaction.setError(new Error("Enter an actual rejection reason, at most 2000 characters.")); return; }
    const reasonHash = keccak256(stringToBytes(reason));

    const confirmed = await transaction.execute(() => writeContractAsync({
      address: CONTRACT_ADDRESSES.PACTORA_ESCROW,
      abi: PACTORA_ESCROW_ABI,
      functionName: "rejectMilestone",
      args: [agreementId, BigInt(milestoneIdx), reasonHash],
      chainId: 31611,
      account: address,
    }), false);
    if (confirmed) { await storeEvidence(milestoneIdx, "rejection", reason, confirmed.transactionHash); setShowRejectForm(null); }
  };

  const handleCancelUnfunded = async () => {
    await transaction.execute(() => writeContractAsync({
      address: CONTRACT_ADDRESSES.PACTORA_ESCROW,
      abi: PACTORA_ESCROW_ABI,
      functionName: "cancelUnfundedAgreement",
      args: [agreementId],
      chainId: 31611,
      account: address,
    }));
  };

  const handleProposeResolution = async () => {
    let clientRefundWei: bigint;
    let providerReleaseWei: bigint;
    try { clientRefundWei = parseMusdAmount(resolutionClientRefund); providerReleaseWei = parseMusdAmount(resolutionProviderRelease); }
    catch (error) { transaction.setError(error instanceof Error ? error : new Error("Invalid split amounts.")); return; }
    if (clientRefundWei + providerReleaseWei !== remainingWei) { transaction.setError(new Error("Refund plus release must exactly equal the remaining escrow.")); return; }
    const confirmed = await transaction.execute(() => writeContractAsync({
      address: CONTRACT_ADDRESSES.PACTORA_ESCROW,
      abi: PACTORA_ESCROW_ABI,
      functionName: "proposeResolution",
      args: [agreementId, clientRefundWei, providerReleaseWei],
      chainId: 31611,
      account: address,
    }));
    if (confirmed) setShowDisputeModal(false);
  };

  const handleAcceptResolution = async () => {
    if (!resolutionProposal?.exists || !contractAgreement) return;
    if (!await money.confirm({ title: "Accept mutual-consent split", explanation: "Accept exactly this reviewed proposal. Its unique hash prevents substituted terms.", transfers: [
      { label: "Refund to client", amount: formatUnits(resolutionProposal.clientRefundAmount, 18), recipient: contractAgreement.client, token: contractAgreement.token },
      { label: "Release to provider", amount: formatUnits(resolutionProposal.providerReleaseAmount, 18), recipient: contractAgreement.provider, token: contractAgreement.token },
    ] })) return;
    await transaction.execute(() => writeContractAsync({
      address: CONTRACT_ADDRESSES.PACTORA_ESCROW,
      abi: PACTORA_ESCROW_ABI,
      functionName: "acceptResolutionProposal",
      args: [agreementId, resolutionProposal.proposalHash],
      chainId: 31611,
      account: address,
    }));
  };

  const handleCancelProposal = async () => {
    await transaction.execute(() => writeContractAsync({
      address: CONTRACT_ADDRESSES.PACTORA_ESCROW,
      abi: PACTORA_ESCROW_ABI,
      functionName: "cancelResolutionProposal",
      args: [agreementId],
      chainId: 31611,
      account: address,
    }));
  };

  async function storeEvidence(milestoneIndex: number, kind: "submission" | "rejection", text: string, hash: `0x${string}`) {
    setEvidenceError(null);
    try { await jsonRequest(`/api/agreements/${resolvedParams.id}/evidence`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ milestoneIndex, kind, text, txHash: hash }) }); await evidenceQuery.refetch(); }
    catch { setEvidenceError("Transaction is confirmed, but its notes could not be stored. Keep the actual text and transaction hash; no attached evidence is being claimed."); }
    await transaction.notifyConfirmed(hash);
  }

  async function handleClaimTimeout(index: number) {
    const milestone = contractMilestones?.[index];
    if (!milestone || !contractAgreement || !await confirmTransfer("Claim after review timeout", "The seven-day review window has elapsed. Release this submitted milestone to its provider.", milestone.amount, contractAgreement.provider)) return;
    await transaction.execute(() => writeContractAsync({ address: CONTRACT_ADDRESSES.PACTORA_ESCROW, abi: PACTORA_ESCROW_ABI, functionName: "claimAfterTimeout", args: [agreementId, BigInt(index)], chainId: 31611, account: address }));
  }

  async function handleRefundNoShow(index: number) {
    const milestone = contractMilestones?.[index];
    if (!milestone || !contractAgreement || !await confirmTransfer("Refund unsubmitted work", "The agreed delivery or revision deadline has elapsed. Refund only this unsettled milestone to the client.", milestone.amount, contractAgreement.client)) return;
    await transaction.execute(() => writeContractAsync({ address: CONTRACT_ADDRESSES.PACTORA_ESCROW, abi: PACTORA_ESCROW_ABI, functionName: "refundNoShow", args: [agreementId, BigInt(index)], chainId: 31611, account: address }));
  }

  const needsAllowance =
    contractAgreement &&
    musdAllowance !== undefined &&
    musdAllowance < contractAgreement.totalAmount;

  const isZeroAddress = (addr?: string) => !addr || /^0x0{40}$/i.test(addr);
  const notFoundOnChain = Boolean(
    contractAgreement &&
    (isZeroAddress(contractAgreement.client) || contractAgreement.id === 0n)
  );

  if (!parsedId.success) return <div className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-semibold">Invalid agreement ID</h1><p className="mt-3">Use a positive numeric agreement ID.</p></div>;
  if (isContractLoading) return <div className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-semibold">Loading agreement</h1><p className="mt-3">Reading confirmed Mezo Testnet state.</p></div>;
  if (contractReadError || (!isContractLoading && !contractAgreement)) return <div className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-semibold">Agreement unavailable</h1><p className="mt-3">The agreement was not found or Mezo Testnet could not be read. No amounts or success state are being fabricated.</p><Button className="mt-4" onClick={() => { void refetchAgreement(); }}>Retry chain read</Button></div>;

  if (notFoundOnChain) {
    const creationTx = metadata?.creationTxHash;
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        <TestnetGuard />
        <Link
          href="/dashboard"
          className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
        >
          <span>← Back to Dashboard</span>
        </Link>
        <Card className="border-red-500/30 bg-red-950/20 shadow-2xl">
          <CardHeader>
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-400" />
              <CardTitle className="text-xl text-red-200">
                Not found on-chain for this contract address
              </CardTitle>
            </div>
            <CardDescription className="text-slate-300">
              Agreement #{resolvedParams.id} does not exist in the configured escrow contract on Mezo Testnet (Chain ID 31611). The contract returned an empty struct (<code className="text-red-300">client == address(0)</code>).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <div className="rounded-xl bg-slate-900/80 p-4 border border-slate-800 space-y-2">
              <span className="text-xs text-slate-400 block">Configured Escrow Contract</span>
              <a
                href={`https://explorer.test.mezo.org/address/${CONTRACT_ADDRESSES.PACTORA_ESCROW}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-teal-300 underline break-all inline-flex items-center gap-1"
              >
                {CONTRACT_ADDRESSES.PACTORA_ESCROW}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            {creationTx ? (
              <div className="rounded-xl bg-slate-900/80 p-4 border border-slate-800 space-y-2">
                <span className="text-xs text-slate-400 block">Creation Transaction</span>
                <a
                  href={`https://explorer.test.mezo.org/tx/${creationTx}`}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-xs text-teal-300 underline break-all inline-flex items-center gap-1"
                >
                  {creationTx}
                  <ExternalLink className="h-3 w-3" />
                </a>
                <p className="text-xs text-slate-400 mt-1">
                  Inspect this transaction on the explorer to confirm the on-chain agreement ID from the AgreementCreated event logs.
                </p>
              </div>
            ) : null}

            <div className="pt-2 flex gap-3">
              <Button onClick={() => { void refetchAgreement(); }} variant="outline" size="sm">
                Retry chain read
              </Button>
              <Link href="/agreements/create">
                <Button size="sm">Create New Agreement</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (contractAgreement && contractAgreement.token.toLowerCase() !== CONTRACT_ADDRESSES.MUSD.toLowerCase()) return <div className="mx-auto max-w-4xl p-8"><h1 className="text-2xl font-semibold">Unsupported escrow token</h1><p className="mt-3 break-all">This agreement uses {contractAgreement.token}. The current interface supports canonical MUSD only and will not label this token as MUSD.</p></div>;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      <TestnetGuard />
      <WalletSessionControls />
      {contractVersion !== 2n && <p role="alert" className="text-sm text-amber-200">This deployment is legacy or unavailable. Money-moving actions are disabled; use the public receipt for read-only verification.</p>}
      {metadataQuery.error && <p role="status" className="text-sm text-amber-200">Verified private terms could not be loaded: {metadataQuery.error.message}</p>}
      {evidenceError && <p role="alert" className="text-sm text-amber-200">{evidenceError}</p>}
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
                {totalAmountFormatted} MUSD
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
            totalAmount={contractAgreement && contractAgreement.fundedAt > 0n ? contractAgreement.totalAmount : 0n}
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
                {clientAddress ? (
                  <AddressChip
                    value={clientAddress}
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
                {providerAddress ? (
                  <AddressChip
                    value={providerAddress}
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
      {transaction.notificationWarning && <p role="status" className="text-sm text-amber-200">{transaction.notificationWarning}</p>}
      <fieldset disabled={transaction.busy || contractVersion !== 2n} className="space-y-8">

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
                disabled={!metadata}
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
                const reviewEnds = m.submittedAt + reviewWindow;
                const revisionEnds = m.rejectedAt + reviewWindow;
                const deliveryCutoff = mState === "Rejected" && revisionEnds > m.deliveryDeadline ? revisionEnds : m.deliveryDeadline;
                const delivered = evidenceQuery.data?.evidence.find((item) => item.milestoneIndex === idx && item.kind === "submission" && item.contentHash === m.submissionHash);
                const rejected = evidenceQuery.data?.evidence.find((item) => item.milestoneIndex === idx && item.kind === "rejection" && item.contentHash === m.rejectionReasonHash);

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

                      <p className="mt-3 text-sm text-slate-300">Delivery deadline: {formatChainTime(m.deliveryDeadline)}. {mState === "Submitted" && `Review ends: ${formatChainTime(reviewEnds)}.`} {mState === "Rejected" && `Resubmit before: ${formatChainTime(deliveryCutoff)}.`}</p>

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
                          <span className="text-teal-400 font-medium">{delivered ? "Evidence text verified against this hash" : "Hash committed; evidence text unavailable"}</span>
                        </div>
                      )}
                      {delivered && <div className="mt-3 space-y-2 text-sm text-slate-200"><p className="whitespace-pre-wrap break-words">{delivered.text}</p><a href={`https://explorer.test.mezo.org/tx/${delivered.txHash}`} target="_blank" rel="noreferrer" className="text-teal-300 underline">Submission transaction</a></div>}

                      {/* Rejection reason notice */}
                      {mState === "Rejected" && (
                        <div className="mt-3 p-3 rounded-lg border border-rose-500/30 bg-rose-950/20 text-xs text-rose-300">
                          <span className="font-semibold block mb-0.5">Rejection Notice:</span>
                          {rejected?.text || "A rejection hash is committed on-chain; its text is unavailable."}
                        </div>
                      )}

                      {/* Action buttons per milestone */}
                      {agreementState === "Funded" && (
                        <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-end gap-3">
                          {/* Provider Submission Form */}
                          {isProvider && (mState === "Pending" || mState === "Rejected") && now < deliveryCutoff && (
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
                                maxLength={2000}
                                aria-label={`Evidence for milestone ${idx + 1}`}
                              />
                              <div className="flex justify-end">
                                <Button
                                  size="sm"
                                    onClick={() => handleSubmitMilestone(idx)}
                                    disabled={!submissionNotes[idx]?.trim()}
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
                              {showRejectForm === idx && now < reviewEnds ? (
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
                                    maxLength={2000}
                                    aria-label={`Rejection reason for milestone ${idx + 1}`}
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
                                      disabled={!rejectionReasons[idx]?.trim() || now >= reviewEnds}
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
                                    disabled={now >= reviewEnds}
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
                          {isProvider && mState === "Submitted" && now >= reviewEnds && <Button size="sm" onClick={() => { void handleClaimTimeout(idx); }}>Claim after seven-day review window</Button>}
                          {isClient && (mState === "Pending" || mState === "Rejected") && now >= deliveryCutoff && <Button variant="outline" size="sm" onClick={() => { void handleRefundNoShow(idx); }}>Refund {amountFormatted} MUSD for no-show</Button>}
                        </div>
                      )}
                    </motion.div>
                  </div>
                );
              })}
            </div>
          ) : isMilestonesLoading ? (
            <div className="h-32 flex items-center justify-center text-slate-400 text-xs gap-2">
              <Clock className="h-4 w-4 animate-spin text-teal-400" />
              Loading milestone state from blockchain...
            </div>
          ) : (
            <div className="h-32 flex items-center justify-center text-slate-400 text-xs">
              No milestones recorded on-chain for this agreement.
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
                    type="text"
                    inputMode="decimal"
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
                    type="text"
                    inputMode="decimal"
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
      </fieldset>
      {money.dialog}
    </div>
  );
}
