"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AgreementCardSkeleton } from "@/components/ui/SkeletonCard";
import {
  PlusCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  Send,
  Wallet,
  ArrowUpRight,
  RefreshCw,
  TrendingUp,
  Sparkles,
} from "lucide-react";

interface AgreementItem {
  id: string;
  onChainId: number;
  title: string;
  description?: string;
  clientAddress: string;
  providerAddress: string;
  totalAmount: string;
  createdAt: string;
}

export default function DashboardPage() {
  const { address, isConnected } = useAccount();
  const [agreements, setAgreements] = useState<AgreementItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState<"all" | "client" | "provider">("all");
  const shouldReduceMotion = useReducedMotion();

  const fetchAgreements = useCallback(async () => {
    setLoading(true);
    try {
      const url = address ? `/api/agreements?wallet=${address}` : `/api/agreements`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setAgreements(data.agreements || []);
      }
    } catch (err) {
      console.error("Failed to fetch agreements:", err);
    } finally {
      setLoading(false);
    }
  }, [address]);

  useEffect(() => {
    fetchAgreements();
  }, [fetchAgreements]);

  const filteredAgreements = agreements.filter((ag) => {
    if (!address) return true;
    const isClient = ag.clientAddress.toLowerCase() === address.toLowerCase();
    const isProvider = ag.providerAddress.toLowerCase() === address.toLowerCase();
    if (filterRole === "client") return isClient;
    if (filterRole === "provider") return isProvider;
    return true;
  });

  const totalValue = filteredAgreements.reduce((acc, curr) => {
    const val = parseFloat(curr.totalAmount);
    return acc + (isNaN(val) ? 0 : val);
  }, 0);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Escrow Dashboard
            </h1>
            <Badge variant="testnet" className="py-0.5">
              Mezo Testnet
            </Badge>
          </div>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Manage your milestone agreements, inspect deliverables, and track verified MUSD payouts.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={fetchAgreements}
            className="gap-1.5 border-slate-700 bg-slate-900/60 hover:bg-slate-800"
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>

          <Link href="/agreements/create">
            <Button size="sm" className="gap-1.5 shadow-md shadow-teal-500/20">
              <PlusCircle className="h-4 w-4" />
              New Agreement
            </Button>
          </Link>
        </div>
      </div>

      {/* Wallet Disconnected Banner */}
      {!isConnected && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 flex items-center justify-between gap-4 shadow-lg"
        >
          <div className="flex items-center gap-3">
            <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-200">Wallet Disconnected</p>
              <p className="text-xs text-amber-300/80 mt-0.5">
                Connect your Web3 wallet to inspect your agreements and execute on-chain milestone approvals.
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* Redesigned Metric Cards with 3px Accent Border, CountUp & Sparklines */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        {/* Metric 1 */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800/90 bg-gradient-to-br from-[#0f172a] to-[#131d35] p-5 shadow-xl border-l-4 border-l-teal-500">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">Active Agreements</span>
            <FileText className="h-4 w-4 text-teal-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <p className="text-3xl font-extrabold font-mono text-white tracking-tight">
              {filteredAgreements.length}
            </p>
            {/* Stylized SVG Sparkline */}
            <svg className="w-20 h-7 text-teal-400/50 stroke-current fill-none" viewBox="0 0 100 35">
              <path
                d="M 0 30 Q 25 10, 50 25 T 100 5"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Tracked across client & provider roles
          </p>
        </div>

        {/* Metric 2 */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800/90 bg-gradient-to-br from-[#0f172a] to-[#131d35] p-5 shadow-xl border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">Total Value In Escrow</span>
            <TrendingUp className="h-4 w-4 text-amber-400" />
          </div>
          <div className="flex items-baseline justify-between">
            <p className="text-3xl font-extrabold font-mono text-teal-300 tracking-tight">
              {totalValue.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MUSD
            </p>
            {/* Stylized SVG Sparkline */}
            <svg className="w-20 h-7 text-amber-400/50 stroke-current fill-none" viewBox="0 0 100 35">
              <path
                d="M 0 25 Q 35 32, 60 12 T 100 4"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <p className="text-[11px] text-slate-500 mt-2">
            Denominated in Bitcoin-backed MUSD
          </p>
        </div>

        {/* Metric 3 */}
        <div className="relative overflow-hidden rounded-2xl border border-slate-800/90 bg-gradient-to-br from-[#0f172a] to-[#131d35] p-5 shadow-xl border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
            <span className="font-medium">Active Network</span>
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="flex items-center gap-2.5 my-1">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-teal-500"></span>
            </span>
            <p className="text-xl font-bold text-white">Mezo Testnet</p>
          </div>
          <p className="text-[11px] text-slate-400 mt-2 font-mono">
            Chain ID: 31611 • Canonical MUSD
          </p>
        </div>
      </div>

      {/* Role Filter Tabs with Framer Motion Sliding Pill */}
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <div className="flex items-center gap-2 relative">
          {(
            [
              { id: "all", label: `All Agreements (${agreements.length})` },
              { id: "client", label: "As Client" },
              { id: "provider", label: "As Provider" },
            ] as const
          ).map((tab) => {
            const isSelected = filterRole === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setFilterRole(tab.id)}
                className={`relative px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  isSelected ? "text-teal-300" : "text-slate-400 hover:text-white"
                }`}
              >
                <span className="relative z-10">{tab.label}</span>
                {isSelected && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute inset-0 rounded-lg bg-slate-800 border border-slate-700/80 shadow-sm"
                    transition={{
                      type: "spring",
                      stiffness: 450,
                      damping: 35,
                    }}
                  />
                )}
              </button>
            );
          })}
        </div>

        <span className="text-xs text-slate-500">
          Showing {filteredAgreements.length} results
        </span>
      </div>

      {/* Agreements List / Table */}
      {!isConnected ? (
        <div className="rounded-2xl border border-slate-800/90 bg-[#0f172a] text-center p-14 shadow-xl">
          <div className="relative w-20 h-20 mx-auto mb-5">
            <div className="w-full h-full flex items-center justify-center rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400">
              <Wallet className="h-10 w-10 text-teal-400/80" />
            </div>
          </div>
          <h3 className="text-lg font-bold text-white">Wallet Not Connected</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-2 leading-relaxed">
            Please connect your Web3 wallet in the navigation bar to inspect your agreements and execute on-chain milestone approvals.
          </p>
        </div>
      ) : loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <AgreementCardSkeleton key={i} />
          ))}
        </div>
      ) : filteredAgreements.length === 0 ? (
        <div className="rounded-2xl border border-slate-800/90 bg-[#0f172a] text-center p-14 shadow-xl">
          {/* Animated SVG Illustration of Vault */}
          <div className="relative w-20 h-20 mx-auto mb-5">
            <motion.div
              animate={shouldReduceMotion ? {} : { y: [-3, 3, -3] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="w-full h-full flex items-center justify-center rounded-2xl bg-teal-500/10 border border-teal-500/20 text-teal-400 shadow-[0_0_25px_rgba(20,184,166,0.15)]"
            >
              <FileText className="h-10 w-10 text-teal-400/80" />
            </motion.div>
          </div>
          <h3 className="text-lg font-bold text-white">No Agreements Found</h3>
          <p className="text-xs text-slate-400 max-w-sm mx-auto mt-2 leading-relaxed">
            You don&apos;t have any active milestone escrow agreements yet. Create an agreement to define deliverables and lock funds in MUSD.
          </p>
          <div className="mt-6">
            <Link href="/agreements/create">
              <Button size="sm" className="gap-2 shadow-lg shadow-teal-500/20">
                <PlusCircle className="h-4 w-4" />
                Create First Agreement
              </Button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredAgreements.map((ag, idx) => {
            const isClient =
              address && ag.clientAddress.toLowerCase() === address.toLowerCase();

            return (
              <motion.div
                key={ag.onChainId}
                initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.4,
                  delay: shouldReduceMotion ? 0 : idx * 0.06,
                  ease: [0.25, 0.1, 0.25, 1],
                }}
                whileHover={
                  shouldReduceMotion
                    ? {}
                    : {
                        y: -3,
                        boxShadow: "0 16px 32px -4px rgba(20, 184, 166, 0.08)",
                      }
                }
                className="group rounded-2xl border border-slate-800/90 bg-[#0f172a] p-5 hover:border-slate-700 hover:bg-slate-900/80 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 font-bold shrink-0 mt-0.5 border border-teal-500/25 group-hover:scale-105 transition-transform">
                    #{ag.onChainId}
                  </div>
                  <div>
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h4 className="text-base font-semibold text-white group-hover:text-teal-300 transition-colors">
                        {ag.title}
                      </h4>
                      <Badge variant={isClient ? "default" : "secondary"}>
                        {isClient ? "Client" : "Provider"}
                      </Badge>
                      <Badge variant="outline" className="text-[10px] text-slate-400">
                        Mezo Testnet
                      </Badge>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-slate-400">
                      <span>
                        Counterparty:{" "}
                        <span className="font-mono text-slate-300">
                          {isClient
                            ? `${ag.providerAddress.slice(0, 6)}...${ag.providerAddress.slice(-4)}`
                            : `${ag.clientAddress.slice(0, 6)}...${ag.clientAddress.slice(-4)}`}
                        </span>
                      </span>
                      <span>
                        Created:{" "}
                        <span className="text-slate-300">
                          {new Date(ag.createdAt).toLocaleDateString()}
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-6 pt-3 sm:pt-0 border-t sm:border-0 border-slate-800">
                  <div className="text-left sm:text-right">
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
                      Escrow Total
                    </span>
                    <p className="text-base font-bold font-mono text-teal-400">
                      {ag.totalAmount} MUSD
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Link href={`/agreements/${ag.onChainId}`}>
                      <Button size="sm" variant="secondary" className="gap-1 group-hover:bg-slate-800">
                        <span>Workspace</span>
                        <ChevronRight className="h-3.5 w-3.5" />
                      </Button>
                    </Link>
                    <Link href={`/receipts/${ag.onChainId}`}>
                      <Button size="sm" variant="ghost" title="Public Verifier Receipt">
                        <ArrowUpRight className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
