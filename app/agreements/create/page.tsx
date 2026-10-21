"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, keccak256, stringToBytes } from "viem";
import { CONTRACT_ADDRESSES } from "@/lib/chain/config";
import { PACTORA_ESCROW_ABI } from "@/lib/chain/abi/PactoraEscrow";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/input";
import { AnimatedInput } from "@/components/ui/AnimatedInput";
import { TxStatus } from "@/components/tx/TxStatus";
import { Badge } from "@/components/ui/badge";
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
    { title: "Milestone 1: Project Setup & Architecture Specs", amount: "500", description: "" },
    { title: "Milestone 2: Core Implementation & Smart Contracts", amount: "1000", description: "" },
  ]);

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { data: txHash, writeContractAsync, isPending: isTxPending, error: writeError } = useWriteContract();
  const {
    isLoading: isWaitingForReceipt,
    isSuccess: isReceiptSuccess,
    error: receiptError,
    data: receiptData,
  } = useWaitForTransactionReceipt({ hash: txHash });

  // Calculate sum of milestones
  const totalAmount = milestones.reduce((sum, m) => {
    const val = parseFloat(m.amount);
    return sum + (isNaN(val) ? 0 : val);
  }, 0);

  const handleAddMilestone = () => {
    if (milestones.length >= 20) return;
    setMilestones([
      ...milestones,
      { title: `Milestone ${milestones.length + 1}`, amount: "500", description: "" },
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
      if (!title.trim()) {
        setFormError("Agreement title is required.");
        return;
      }
      const cleanProvider = providerAddress.trim().toLowerCase();
      if (!/^0x[a-f0-9]{40}$/.test(cleanProvider)) {
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
        const val = parseFloat(m.amount);
        if (isNaN(val) || val <= 0) {
          setFormError(`Milestone #${i + 1} amount must be greater than zero.`);
          return;
        }
        if (!m.title.trim()) {
          setFormError(`Milestone #${i + 1} requires a title.`);
          return;
        }
      }
      setCurrentStep(3);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!isConnected || !address) {
      setFormError("Please connect your wallet first.");
      return;
    }

    const cleanProvider = providerAddress.trim().toLowerCase();

    setIsSubmitting(true);
    try {
      // Convert amounts to 18 decimals
      const milestoneAmounts = milestones.map((m) => parseUnits(m.amount, 18));

      // Compute termsHash
      const termsContent = JSON.stringify({
        title,
        description,
        client: address.toLowerCase(),
        provider: cleanProvider,
        milestones,
      });
      const termsHash = keccak256(stringToBytes(termsContent));

      // 1. Send transaction to PactoraEscrow contract
      const hash = await writeContractAsync({
        address: CONTRACT_ADDRESSES.PACTORA_ESCROW,
        abi: PACTORA_ESCROW_ABI,
        functionName: "createAgreement",
        args: [
          cleanProvider as `0x${string}`,
          CONTRACT_ADDRESSES.MUSD,
          milestoneAmounts,
          termsHash,
        ],
      });

      console.log("Transaction broadcasted:", hash);

      const tempOnChainId = Date.now() % 1000000;

      // 2. Persist off-chain metadata
      await fetch("/api/agreements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          onChainId: tempOnChainId,
          title,
          description,
          termsHash,
          clientAddress: address.toLowerCase(),
          providerAddress: cleanProvider,
          tokenAddress: CONTRACT_ADDRESSES.MUSD,
          totalAmount: totalAmount.toString(),
          milestoneDetails: milestones,
        }),
      });

      // Redirect to dashboard
      router.push(`/dashboard`);
    } catch (err: any) {
      console.error("Failed to create agreement:", err);
      setFormError(err?.shortMessage || err?.message || "Transaction rejected or failed.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
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
                      {totalAmount.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MUSD
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
                            type="number"
                            step="any"
                            min="0.01"
                            placeholder="500"
                            value={m.amount}
                            onChange={(e) => handleUpdateMilestone(idx, "amount", e.target.value)}
                            className="font-mono font-medium"
                            required
                          />
                        </div>
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
                      <p className="font-mono text-teal-300 text-xs truncate">{providerAddress}</p>
                    </div>
                  </div>

                  {/* Milestone Breakdown Summary */}
                  <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 space-y-2.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-300 pb-2 border-b border-slate-800">
                      <span>Milestones ({milestones.length})</span>
                      <span className="font-mono text-teal-400">Total: {totalAmount.toFixed(2)} MUSD</span>
                    </div>
                    {milestones.map((m, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs text-slate-300">
                        <span className="truncate max-w-sm">
                          {idx + 1}. {m.title}
                        </span>
                        <span className="font-mono font-bold text-slate-200">
                          {parseFloat(m.amount).toFixed(2)} MUSD
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
                        • <b>Non-Custodial:</b> Funds are held in audited Solidity escrow on Mezo Testnet.
                      </p>
                      <p>
                        • <b>Two-Step Funding:</b> Creation only registers the agreement. After the provider accepts terms, you will deposit <b>{totalAmount.toFixed(2)} MUSD</b>.
                      </p>
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
                  isLoading={isSubmitting || isTxPending || isWaitingForReceipt}
                  size="lg"
                  className="gap-2 font-semibold shadow-xl shadow-teal-500/25"
                >
                  {isWaitingForReceipt
                    ? "Mining on Mezo..."
                    : isTxPending
                    ? "Sign in Wallet..."
                    : `Deploy Agreement (${totalAmount.toFixed(2)} MUSD)`}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </form>
    </div>
  );
}
