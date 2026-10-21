"use client";

import React, { useRef } from "react";
import { motion, useInView, useReducedMotion } from "framer-motion";
import { CountUp } from "@/components/motion/CountUp";
import { ShieldCheck, Zap, Coins, CheckCircle2 } from "lucide-react";

export function MetricsBar() {
  const containerRef = useRef<HTMLDivElement>(null);
  const isInView = useInView(containerRef, { once: true, margin: "-60px" });
  const shouldReduceMotion = useReducedMotion();

  return (
    <div
      ref={containerRef}
      className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10"
    >
      <div className="rounded-2xl border border-slate-800/90 bg-gradient-to-r from-[#0f172a] via-[#131d35] to-[#0f172a] p-6 sm:p-8 shadow-2xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-800">
          {/* Stat 1 */}
          <div className="pt-4 md:pt-0 md:px-4 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 text-slate-400 text-xs mb-1">
              <Coins className="h-4 w-4 text-teal-400" />
              <span>MUSD Escrow Volume</span>
            </div>
            <p className="text-amount font-mono text-white tracking-tight">
              <CountUp value={250000} prefix="$" decimals={0} />
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Mezo Testnet Escrow Protocol</p>
          </div>

          {/* Stat 2 */}
          <div className="pt-4 md:pt-0 md:px-4 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 text-slate-400 text-xs mb-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
              <span>Milestone Releases</span>
            </div>
            <p className="text-amount font-mono text-white tracking-tight">
              <CountUp value={142} />
              <span className="text-emerald-400 text-lg ml-0.5">+</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Zero Disputed Liquidations</p>
          </div>

          {/* Stat 3 */}
          <div className="pt-4 md:pt-0 md:px-4 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 text-slate-400 text-xs mb-1">
              <ShieldCheck className="h-4 w-4 text-teal-400" />
              <span>On-Chain Invariant</span>
            </div>
            <div className="flex items-baseline justify-center md:justify-start gap-2">
              <p className="text-2xl sm:text-3xl font-extrabold font-mono text-teal-300 tracking-tight">
                100%
              </p>
              <span className="text-[10px] text-slate-400 uppercase font-mono">Conserved</span>
            </div>
            <div className="mt-2 h-1.5 w-full max-w-[140px] mx-auto md:mx-0 bg-slate-800 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-teal-400"
                initial={{ width: "0%" }}
                animate={isInView ? { width: "100%" } : { width: "0%" }}
                transition={{ duration: shouldReduceMotion ? 0 : 1.2, ease: "easeOut" }}
              />
            </div>
          </div>

          {/* Stat 4 */}
          <div className="pt-4 md:pt-0 md:px-4 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 text-slate-400 text-xs mb-1">
              <Zap className="h-4 w-4 text-amber-400" />
              <span>Payout Settlement</span>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold font-mono text-white tracking-tight">
              Instant
            </p>
            <p className="text-[11px] text-slate-500 mt-1">Atomic ERC-20 Transfer</p>
          </div>
        </div>
      </div>
    </div>
  );
}

