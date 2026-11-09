"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useAccount, useReadContract, useWriteContract } from "wagmi";
import { CONTRACT_ADDRESSES } from "@/lib/chain/config";
import { PACTORA_ESCROW_ABI } from "@/lib/chain/abi/PactoraEscrow";
import { decodeAgreementCreated } from "@/lib/chain/creation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { AnimatedInput } from "@/components/ui/AnimatedInput";
import { TxStatus } from "@/components/tx/TxStatus";
import { Badge } from "@/components/ui/badge";
import { formatMusdAmount, parseMusdAmount } from "@/lib/chain/amounts";
import { hashAgreementTerms } from "@/lib/chain/terms";
import { useConfirmedTransaction } from "@/lib/hooks/useConfirmedTransaction";
import { WalletSessionControls, jsonRequest } from "@/components/wallet/WalletSessionProvider";
import { TestnetGuard } from "@/components/wallet/TestnetGuard";
import {
  Plus,
  Trash2,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Lock,
  Sparkles,
} from "lucide-react";

interface MilestoneInput {
  title: string;
  amount: string;
  description: string;
  deliveryDeadline: string;
}

export default function CreateAgreementPage() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const shouldReduceMotion = useReducedMotion();

  // Wizard state: 1: Terms, 2: Milestones, 3: Review
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [providerAddress, setProviderAddress] = useState("");
  const [milestones, setMilestones] = useState<MilestoneInput[]>([
    { title: "", amount: "", description: "", deliveryDeadline: "" },
  ]);

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [registration, setRegistration] = useState<{ id: number; txHash: `0x${string}`; body: Record<string, unknown> } | null>(null);

  const { writeContractAsync } = useWriteContract();
  const transaction = useConfirmedTransaction();
  const { hash: txHash, isPending: isTxPending, isWaitingForReceipt, isSuccess: isReceiptSuccess, error: writeError } = transaction;
  const receiptError = null;
  const receiptData = transaction.receipt;
  const { data: contractVersion } = useReadContract({ address: CONTRACT_ADDRESSES.PACTORA_ESCROW, abi: PACTORA_ESCROW_ABI, functionName: "VERSION", chainId: 31611 });

  // Calculate sum of milestones
  let totalAmount: bigint | null = null;
  try { totalAmount = milestones.reduce((sum, milestone) => sum + parseMusdAmount(milestone.amount), 0n); } catch { /* Incomplete form inputs are not balances. */ }
  const totalAmountLabel = totalAmount === null ? "Enter valid amounts" : formatMusdAmount(totalAmount);

  const handleAddMilestone = () => {
    if (milestones.length >= 20) return;
    setMilestones([
      ...milestones,
      { title: "", amount: "", description: "", deliveryDeadline: "" },
    ]);
  };

  const handleRemoveMilestone = (index: number) => {
    if (milestones.length <= 1) return;
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const handleUpdateMilestone = (
    index: number,
    field: keyof MilestoneInput,
    value: string
  ) => {
    const updated = [...milestones];
    updated[index][field] = value;
    setMilestones(updated);
  };

  // Validation before proceeding to next step
  const handleNextStep = () => {
    setFormError(null);

    if (currentStep === 1) {
      if (title.trim().length < 3 || title.length > 120 || description.length > 2000) {
        setFormError("Use a 3-120 character title and at most 2000 description characters.");
        return;
      }
      const cleanProvider = providerAddress.trim().toLowerCase();
      if (!/^0x[a-f0-9]{40}$/.test(cleanProvider) || /^0x0{40}$/.test(cleanProvider)) {
        setFormError("Invalid provider address. Must be a valid 42-character 0x EVM address.");
        return;
      }
      if (address && cleanProvider === address.toLowerCase()) {
        setFormError("You cannot assign yourself as the provider.");
        return;
      }
      setCurrentStep(2);
    } else if (currentStep === 2) {
      if (milestones.length === 0) {
        setFormError("You must specify at least one milestone.");
        return;
      }
      for (let i = 0; i < milestones.length; i++) {
        const m = milestones[i];
        try { if (parseMusdAmount(m.amount) <= 0n) throw new Error(); } catch {
          setFormError(`Milestone #${i + 1} needs a positive amount with at most 18 decimals.`); return;
        }
        if (!m.title.trim() || m.title.length > 100 || m.description.length > 500) {
          setFormError(`Milestone #${i + 1} needs a 1-100 character title and at most 500 description characters.`);
          return;
        }
        if (!Number.isFinite(new Date(m.deliveryDeadline).getTime()) || new Date(m.deliveryDeadline).getTime() <= Date.now()) { setFormError(`Milestone #${i + 1} needs a future delivery deadline.`); return; }
      }
      setCurrentStep(3);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || transaction.busy) return;
    setFormError(null);

    if (!isConnected || !address) {
      setFormError("Please connect your wallet first.");
      return;
    }

    if (contractVersion !== 2n) { setFormError("Pactora V2 must be deployed before new agreements can be created. The legacy contract is read-only in this app."); return; }
    const cleanProvider = providerAddress.trim().toLowerCase();

    setIsSubmitting(true);
    try {
      const details = milestones.map((milestone) => ({ title: milestone.title.trim(), amount: milestone.amount, description: milestone.description, deliveryDeadline: Math.floor(new Date(milestone.deliveryDeadline).getTime() / 1000) }));
      const terms = { title: title.trim(), description, clientAddress: address.toLowerCase(), providerAddress: cleanProvider, milestoneDetails: details };
      const milestoneAmounts = details.map((milestone) => parseMusdAmount(milestone.amount));
      const total = milestoneAmounts.reduce((sum, amount) => sum + amount, 0n);
      const termsHash = hashAgreementTerms(terms);
      const confirmed = await transaction.execute(() => writeContractAsync({
        address: CONTRACT_ADDRESSES.PACTORA_ESCROW,
        abi: PACTORA_ESCROW_ABI,
        functionName: "createAgreement",
        args: [
          cleanProvider as `0x${string}`,
          CONTRACT_ADDRESSES.MUSD,
          milestoneAmounts,
          details.map((milestone) => BigInt(milestone.deliveryDeadline)),
          termsHash,
        ],
        chainId: 31611,
        account: address,
      }), false);
      if (!confirmed) return;
      const event = decodeAgreementCreated(confirmed, CONTRACT_ADDRESSES.PACTORA_ESCROW, address, cleanProvider as `0x${string}`);
      const onChainId = Number(event.args.agreementId);
      if (!Number.isSafeInteger(onChainId) || onChainId > 2_147_483_647) throw new Error("Agreement ID exceeds metadata support; use the explorer receipt.");
      const body = { ...terms, onChainId, termsHash, creationTxHash: confirmed.transactionHash, tokenAddress: CONTRACT_ADDRESSES.MUSD, totalAmount: formatMusdAmount(total) };
      setRegistration({ id: onChainId, txHash: confirmed.transactionHash, body });
      await jsonRequest("/api/agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setRegistration(null);
      await transaction.notifyConfirmed(confirmed.transactionHash);
      router.push(`/agreements/${onChainId}`);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Agreement could not be created or its terms could not be registered.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      <TestnetGuard />
      <WalletSessionControls />
      {contractVersion !== 2n && <p role="status" className="text-sm text-amber-200">New agreements require the approved V2 testnet deployment. Existing escrow receipts remain read-only.</p>}
      {registration && <div className="space-y-2 text-sm"><p>Agreement #{registration.id} is confirmed on-chain. Its terms registration still needs to succeed; do not create a duplicate.</p><Button variant="outline" isLoading={isSubmitting} onClick={() => { setIsSubmitting(true); void jsonRequest("/api/agreements", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(registration.body) }).then(async () => { setRegistration(null); await transaction.notifyConfirmed(registration.txHash); router.push(`/agreements/${registration.id}`); }).catch((error: unknown) => setFormError(error instanceof Error ? error.message : "Registration failed.")).finally(() => setIsSubmitting(false)); }}>Retry verified terms registration</Button></div>}
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">Client Action</Badge>
          <Badge variant="testnet">Mezo Testnet</Badge>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-2">
          Create Milestone Escrow Agreement
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Configure project scope, milestone amounts in MUSD, and designate the provider.
        </p>
      </div>

      {/* 3-Step Wizard Progress Bar */}
      <div className="rounded-2xl border border-slate-800 bg-[#0f172a] p-4 shadow-xl">
        <div className="flex items-center justify-between text-xs font-semibold mb-2">
          <span className={currentStep >= 1 ? "text-teal-300" : "text-slate-500"}>
            1. Parties & Terms
          </span>
          <span className={currentStep >= 2 ? "text-teal-300" : "text-slate-500"}>
            2. Milestone Breakdown
          </span>
          <span className={currentStep === 3 ? "text-teal-300" : "text-slate-500"}>
            3. Review & Deploy
          </span>
        </div>
        <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-teal-400 to-emerald-400"
            initial={{ width: "33%" }}
            animate={{
              width: currentStep === 1 ? "33%" : currentStep === 2 ? "66%" : "100%",
            }}
            transition={{ duration: 0.35, ease: "easeInOut" }}
          />
        </div>
      </div>

      {/* Error alert */}
      {formError && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 flex items-start gap-3 shadow-lg"
        >
          <AlertCircle className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-rose-300">Action Required</p>
            <p className="text-xs text-rose-200/80 mt-0.5">{formError}</p>
          </div>
        </motion.div>
      )}

      {/* Wizard Step Views with Slide Transition */}
      <form onSubmit={handleSubmit}>
        <fieldset disabled={isSubmitting || transaction.busy}>
        <AnimatePresence mode="wait">
          {/* STEP 1: Parties & Terms */}
          {currentStep === 1 && (
            <motion.div
              key="step1"
              initial={{ opacity: 0, x: shouldReduceMotion ? 0 : 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: shouldReduceMotion ? 0 : -24 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <Card className="border-slate-800 bg-[#0f172a] shadow-xl">
                <CardHeader>
                  <CardTitle>1. General Agreement Details</CardTitle>
                  <CardDescription>
                    Name your project and assign the freelancer or agency wallet address.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Agreement Title *
                    </label>
                    <AnimatedInput
                      placeholder="e.g. DeFi Protocol Frontend & Wallet Integration"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Provider Wallet Address (Freelancer) *
                    </label>
                    <AnimatedInput
                      placeholder="0x..."
                      value={providerAddress}
                      onChange={(e) => setProviderAddress(e.target.value)}
                      className="font-mono"
                      required
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      The provider connects with this address to accept the agreement and submit deliverables.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Project Description & Deliverable Specs (Optional)
                    </label>
                    <Textarea
                      placeholder="Describe key objectives, acceptance criteria, Figma links, or GitHub repo..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      rows={4}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => router.push("/dashboard")}
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={handleNextStep}
                  className="gap-2 shadow-lg shadow-teal-500/20"
                >
                  <span>Continue to Milestones</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* STEP 2: Milestone Breakdown */}
          {currentStep === 2 && (
            <motion.div
              key="step2"
              initial={{ opacity: 0, x: shouldReduceMotion ? 0 : 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: shouldReduceMotion ? 0 : -24 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <Card className="border-slate-800 bg-[#0f172a] shadow-xl">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div>
                    <CardTitle>2. Milestone Breakdown</CardTitle>
                    <CardDescription>
                      Divide project scope into verifiable increments. Funds are released per milestone.
                    </CardDescription>
                  </div>
                  {/* Live animated total with glow border */}
                  <div className="text-right px-3 py-1.5 rounded-xl border border-teal-500/30 bg-teal-500/10 shadow-[0_0_15px_rgba(20,184,166,0.15)]">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                      Escrow Total
                    </span>
                    <p className="text-base font-bold font-mono text-teal-300">
                      {totalAmountLabel} MUSD
                    </p>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4 pt-4">
                  {milestones.map((m, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3 }}
                      className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 space-y-3 relative group hover:border-slate-700 transition-colors shadow-sm"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-teal-400 uppercase tracking-wider">
                          Milestone #{idx + 1}
                        </span>
                        {milestones.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMilestone(idx)}
                            className="text-slate-500 hover:text-rose-400 transition-colors cursor-pointer"
                            title="Remove milestone"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2">
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Milestone Title *
                          </label>
                          <AnimatedInput
                            placeholder={`e.g. Phase ${idx + 1} Deliverable`}
                            value={m.title}
                            onChange={(e) => handleUpdateMilestone(idx, "title", e.target.value)}
                            required
                          />
                        </div>

                        <div>
                          <label className="block text-[11px] font-medium text-slate-400 mb-1">
                            Amount (MUSD) *
                          </label>
                          <AnimatedInput
                            type="text"
                            inputMode="decimal"
                            placeholder="Amount with up to 18 decimals"
                            value={m.amount}
                            onChange={(e) => handleUpdateMilestone(idx, "amount", e.target.value)}
                            className="font-mono font-medium"
                            required
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor={`deadline-${idx}`} className="block text-sm font-medium text-slate-300 mb-2">Delivery deadline (your local time) *</label>
                        <AnimatedInput id={`deadline-${idx}`} type="datetime-local" value={m.deliveryDeadline} onChange={(event) => handleUpdateMilestone(idx, "deliveryDeadline", event.target.value)} required />
                        <p className="mt-2 text-xs text-slate-300">Agreed on-chain when the provider accepts. Unsubmitted work can be refunded after this deadline. Submitted work has seven days for review; a rejection grants seven days to resubmit.</p>
                      </div>

                      <div>
                        <label className="block text-[11px] font-medium text-slate-400 mb-1">
                          Acceptance Criteria / Deliverables Proof
                        </label>
                        <AnimatedInput
                          placeholder="e.g. GitHub Pull Request link, test passing video, Figma URL"
                          value={m.description}
                          onChange={(e) => handleUpdateMilestone(idx, "description", e.target.value)}
                        />
                      </div>
                    </motion.div>
                  ))}

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddMilestone}
                    className="w-full gap-2 border-dashed border-slate-700 py-3 hover:border-teal-500/40 text-slate-300"
                  >
                    <Plus className="h-4 w-4 text-teal-400" />
                    Add Another Milestone
                  </Button>
                </CardContent>
              </Card>

              <div className="flex justify-between gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  className="gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>
                <Button
                  type="button"
                  onClick={handleNextStep}
                  className="gap-2 shadow-lg shadow-teal-500/20"
                >
                  <span>Review & Summary</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: Review & Pre-Flight Deploy */}
          {currentStep === 3 && (
            <motion.div
              key="step3"
              initial={{ opacity: 0, x: shouldReduceMotion ? 0 : 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: shouldReduceMotion ? 0 : -24 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              <Card className="border-slate-800 bg-[#0f172a] shadow-xl">
                <CardHeader>
                  <CardTitle>3. Agreement Summary & Review</CardTitle>
                  <CardDescription>
                    Please review all parameters carefully before broadcasting to Mezo Testnet.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="rounded-xl bg-slate-900/70 p-3.5 border border-slate-800">
                      <span className="text-slate-400 block mb-1">Title</span>
                      <p className="font-semibold text-white text-sm">{title}</p>
                    </div>

                    <div className="rounded-xl bg-slate-900/70 p-3.5 border border-slate-800">
                      <span className="text-slate-400 block mb-1">Provider Address</span>
                      <p className="font-mono text-teal-300 text-xs break-all">{providerAddress.toLowerCase()}</p>
                    </div>
                  </div>

                  {/* Milestone Breakdown Summary */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-300 pb-2 border-b border-slate-800">
                      <span>Milestones ({milestones.length})</span>
                      <span className="font-mono text-teal-400">Total: {totalAmountLabel} MUSD</span>
                    </div>
                    {milestones.map((m, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs text-slate-300">
                        <div><span>{idx + 1}. {m.title}</span><p className="mt-1 text-slate-400">Due: {new Date(m.deliveryDeadline).toISOString()}</p></div>
                        <span className="font-mono font-bold text-slate-200">
                          {m.amount} MUSD
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Pre-Flight Disclosure */}
                  <div className="rounded-xl border border-teal-500/25 bg-teal-950/15 p-4 flex items-start gap-3">
                    <ShieldCheck className="h-5 w-5 text-teal-400 shrink-0 mt-0.5" />
                    <div className="text-xs text-slate-300 leading-relaxed">
                      <p className="font-semibold text-white">Pre-Flight Escrow Disclosure</p>
                      <p className="mt-1">
                        <b>Non-Custodial:</b> Funds are held in unaudited Solidity escrow on Mezo Testnet.
                      </p>
                      <p>
                        <b>Two-Step Funding:</b> Creation only registers the agreement. After the provider accepts terms, you will deposit <b>{totalAmountLabel} MUSD</b>.
                      </p>
                      <p className="mt-2">Token contract: <a className="break-all text-teal-300 underline" href={`https://explorer.test.mezo.org/token/${CONTRACT_ADDRESSES.MUSD}`} target="_blank" rel="noreferrer">{CONTRACT_ADDRESSES.MUSD}</a></p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <TxStatus
                isPending={isTxPending}
                hash={txHash}
                isWaitingForReceipt={isWaitingForReceipt}
                isSuccess={isReceiptSuccess}
                error={writeError || receiptError}
                reverted={receiptData?.status === "reverted"}
              />

              <div className="flex justify-between gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep(2)}
                  className="gap-2"
                  disabled={isSubmitting || isTxPending || isWaitingForReceipt}
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Button>

                <Button
                  type="submit"
                  disabled={contractVersion !== 2n || transaction.isSuccess}
                  isLoading={isSubmitting || isTxPending || isWaitingForReceipt}
                  size="lg"
                  className="gap-2 font-semibold shadow-xl shadow-teal-500/25"
                >
                  {isWaitingForReceipt
                    ? "Mining on Mezo..."
                    : isTxPending
                    ? "Sign in Wallet..."
                    : `Create Agreement (${totalAmountLabel} MUSD)`}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        </fieldset>
      </form>
    </div>
  );
}
