"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import {
  CheckCircle2,
  Clock,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  ExternalLink,
} from "lucide-react";

export function LiveEscrowPreview() {
  const [phase, setPhase] = useState<0 | 1 | 2>(0);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    if (shouldReduceMotion) return;

    const interval = setInterval(() => {
      setPhase((prev) => ((prev + 1) % 3) as 0 | 1 | 2);
    }, 3200);

    return () => clearInterval(interval);
  }, [shouldReduceMotion]);

  return (
    <div className="relative w-full max-w-lg mx-auto">
      {/* Dynamic ambient backdrop behind the card */}
      <motion.div
        animate={{
          scale: [0.98, 1.03, 0.98],
          opacity: [0.35, 0.6, 0.35],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -inset-1 rounded-3xl bg-gradient-to-r from-teal-500/20 via-emerald-500/10 to-teal-500/20 blur-xl pointer-events-none -z-10"
      />

      <div className="rounded-2xl border border-slate-700/80 bg-[#0f172a]/95 backdrop-blur-xl p-6 shadow-2xl transition-all">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-mono text-slate-400">Agreement #042</span>
            <Badge variant="success" className="text-[10px] py-0 px-2">
              Funded in MUSD
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-teal-400">
            <span className="h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
            <span>Live Simulation</span>
          </div>
        </div>

        {/* Title and Value */}
        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-white leading-snug">
              Full-Stack Protocol & Smart Contract Audit
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">Mezo Testnet • Non-Custodial</p>
          </div>
          <div className="text-right shrink-0">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider block">
              Remaining Escrow
            </span>
            <motion.p
              key={phase === 2 ? "phase2" : "phase01"}
              initial={{ scale: 1.1, color: "#2dd4bf" }}
              animate={{ scale: 1, color: "#14b8a6" }}
              className="text-lg font-bold font-mono text-teal-400"
            >
              {phase === 2 ? "3,000.00 MUSD" : "4,500.00 MUSD"}
            </motion.p>
          </div>
        </div>

        {/* Animated Progress Track */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1.5">
            <span>Milestone Completion</span>
            <span className="font-mono text-teal-300">
              {phase === 2 ? "1 of 3 (33%)" : "0 of 3 (0%)"}
            </span>
          </div>
          <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-gradient-to-r from-teal-400 to-emerald-400"
              initial={{ width: "0%" }}
              animate={{ width: phase === 2 ? "33%" : "4%" }}
              transition={{ duration: 0.7, ease: "easeOut" }}
            />
          </div>
        </div>

        {/* Milestone 1 Container with State Transitions */}
        <div className="mt-5 relative overflow-hidden rounded-xl border border-slate-700/60 bg-slate-900/80 p-4">
          {/* Release celebration flash effect */}
          <AnimatePresence>
            {phase === 2 && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.45, 0] }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.8, ease: "easeInOut" }}
                className="absolute inset-0 bg-emerald-500/20 pointer-events-none z-10"
              />
            )}
          </AnimatePresence>

          <div className="flex items-start gap-3">
            {/* Status Icon */}
            <div className="mt-0.5">
              <AnimatePresence mode="wait">
                {phase === 2 ? (
                  <motion.div
                    key="approved"
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400"
                  >
                    <CheckCircle2 className="h-4 w-4" />
                  </motion.div>
                ) : phase === 1 ? (
                  <motion.div
                    key="submitted"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/20 text-amber-400"
                  >
                    <Clock className="h-4 w-4 animate-spin" style={{ animationDuration: "3s" }} />
                  </motion.div>
                ) : (
                  <motion.div
                    key="pending"
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 text-slate-400"
                  >
                    <span className="text-xs font-mono font-bold">1</span>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Milestone Text & Price */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold text-white truncate">
                  Milestone 1: Architecture & UI Specs
                </p>
                <span className="text-xs font-mono font-bold text-teal-300 shrink-0">
                  1,500 MUSD
                </span>
              </div>

              {/* Status Indicator */}
              <div className="mt-2 flex items-center justify-between">
                <AnimatePresence mode="wait">
                  {phase === 2 ? (
                    <motion.div
                      key="st-app"
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 text-[10px] font-medium"
                    >
                      <Sparkles className="h-3 w-3 text-emerald-400" />
                      <span>Approved • 1,500 MUSD Released</span>
                    </motion.div>
                  ) : phase === 1 ? (
                    <motion.div
                      key="st-sub"
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/30 text-[10px] font-medium"
                    >
                      <Clock className="h-3 w-3 text-amber-400" />
                      <span>Submitted • In Client Review</span>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="st-pen"
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 border border-slate-700 text-[10px] font-medium"
                    >
                      <span>Locked in Escrow</span>
                    </motion.div>
                  )}
                </AnimatePresence>

                <span className="text-[10px] font-mono text-slate-500">
                  {phase === 2 ? "Tx: 0x82f...a1b4" : "ID: ms-01"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Milestone 2 (Pending Preview) */}
        <div className="mt-2.5 flex items-center justify-between p-3 rounded-lg border border-slate-800/80 bg-slate-900/40 text-xs opacity-75">
          <div className="flex items-center gap-2.5">
            <div className="h-5 w-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-mono text-slate-400">
              2
            </div>
            <span className="text-slate-300 text-[11px]">Milestone 2: Frontend Implementation</span>
          </div>
          <span className="font-mono text-slate-400 text-[11px]">2,000 MUSD</span>
        </div>

        {/* Timeline Flow Steps Navigation Bar */}
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-teal-400" />
            <span>Autonomous State Machine</span>
          </div>
          <div className="flex items-center gap-1">
            <span
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                phase === 0 ? "bg-teal-400 w-3" : "bg-slate-700"
              }`}
            />
            <span
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                phase === 1 ? "bg-teal-400 w-3" : "bg-slate-700"
              }`}
            />
            <span
              className={`h-1.5 w-1.5 rounded-full transition-colors ${
                phase === 2 ? "bg-teal-400 w-3" : "bg-slate-700"
              }`}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

