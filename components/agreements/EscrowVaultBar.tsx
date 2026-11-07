"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { formatUnits } from "viem";
import { percentageOf } from "@/lib/chain/amounts";

export interface EscrowVaultBarProps {
  totalAmount: bigint;
  releasedAmount: bigint;
  refundedAmount: bigint;
  className?: string;
}

export function EscrowVaultBar({
  totalAmount,
  releasedAmount,
  refundedAmount,
  className = "",
}: EscrowVaultBarProps) {
  const reduce = useReducedMotion();

  const total = totalAmount;
  const released = releasedAmount;
  const refunded = refundedAmount;
  const remaining = total - released - refunded;
  const releasedPct = percentageOf(released, total);
  const refundedPct = percentageOf(refunded, total);
  const remainingPct = percentageOf(remaining, total);
  const fmt = { format: (amount: bigint) => formatUnits(amount, 18) };

  return (
    <div className={`space-y-3 ${className}`}>
      {/* Legend & Breakdown Numbers */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span className="text-slate-300 font-medium">Released:</span>
            <span className="font-mono text-emerald-400">{fmt.format(released)} MUSD</span>
            <span className="text-[10px] text-slate-500">({releasedPct.toFixed(1)}%)</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-teal-500" />
            <span className="text-slate-300 font-medium">Remaining:</span>
            <span className="font-mono text-teal-300">{fmt.format(remaining)} MUSD</span>
            <span className="text-[10px] text-slate-500">({remainingPct.toFixed(1)}%)</span>
          </div>

          {refunded > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full bg-amber-500" />
              <span className="text-slate-300 font-medium">Refunded:</span>
              <span className="font-mono text-amber-400">{fmt.format(refunded)} MUSD</span>
              <span className="text-[10px] text-slate-500">({refundedPct.toFixed(1)}%)</span>
            </div>
          )}
        </div>

        <div className="text-slate-400 text-xs">
          Total: <span className="font-mono font-semibold text-slate-200">{fmt.format(total)} MUSD</span>
        </div>
      </div>

      {/* Segmented Progress Track */}
      <div
        role="progressbar"
        aria-label="Escrow vault balance conservation"
        aria-valuenow={Math.round(releasedPct)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-3 w-full rounded-full bg-slate-800/80 p-0.5 flex overflow-hidden border border-slate-700/60"
      >
        {/* Released Segment */}
        {releasedPct > 0 && (
          <motion.div
            style={{ width: `${releasedPct}%` }}
            initial={reduce ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] as const }}
            className="h-full bg-emerald-500 origin-left"
            title={`Released: ${fmt.format(released)} MUSD`}
          />
        )}

        {/* Remaining Segment */}
        {remainingPct > 0 && (
          <motion.div
            style={{ width: `${remainingPct}%` }}
            initial={reduce ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] as const }}
            className="h-full bg-teal-500 origin-left"
            title={`Remaining: ${fmt.format(remaining)} MUSD`}
          />
        )}

        {/* Refunded Segment */}
        {refundedPct > 0 && (
          <motion.div
            style={{ width: `${refundedPct}%` }}
            initial={reduce ? false : { scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] as const }}
            className="h-full bg-amber-500 origin-left"
            title={`Refunded: ${fmt.format(refunded)} MUSD`}
          />
        )}
      </div>
    </div>
  );
}
