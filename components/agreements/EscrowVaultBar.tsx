"use client";

import React, { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { formatUnits } from "viem";

export interface EscrowVaultBarProps {
  totalAmount: bigint | number;
  releasedAmount: bigint | number;
  refundedAmount: bigint | number;
  className?: string;
}

export function EscrowVaultBar({
  totalAmount,
  releasedAmount,
  refundedAmount,
  className = "",
}: EscrowVaultBarProps) {
  const reduce = useReducedMotion();

  const { total, released, refunded, remaining, releasedPct, refundedPct, remainingPct } =
    useMemo(() => {
      const toNum = (val: bigint | number): number => {
        if (typeof val === "bigint") {
          return parseFloat(formatUnits(val, 18)) || 0;
        }
        return val || 0;
      };

      const tot = toNum(totalAmount);
      const rel = toNum(releasedAmount);
      const ref = toNum(refundedAmount);
      const rem = Math.max(0, tot - rel - ref);

      const relP = tot > 0 ? Math.min(100, (rel / tot) * 100) : 0;
      const refP = tot > 0 ? Math.min(100 - relP, (ref / tot) * 100) : 0;
      const remP = tot > 0 ? Math.max(0, 100 - relP - refP) : 0;

      return {
        total: tot,
        released: rel,
        refunded: ref,
        remaining: rem,
        releasedPct: relP,
        refundedPct: refP,
        remainingPct: remP,
      };
    }, [totalAmount, releasedAmount, refundedAmount]);

  const fmt = useMemo(
    () =>
      new Intl.NumberFormat("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }),
    []
  );

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

