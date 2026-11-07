"use client";

import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, AlertCircle, Loader2, ExternalLink } from "lucide-react";
import { mezoTestnet } from "@/lib/chain/config";

const EXPLORER_URL =
  process.env.NEXT_PUBLIC_EXPLORER_URL ||
  mezoTestnet.blockExplorers.default.url ||
  "https://explorer.test.mezo.org";

export interface TxStatusProps {
  isPending?: boolean;
  hash?: `0x${string}` | string | null;
  isWaitingForReceipt?: boolean;
  isSuccess?: boolean;
  error?: Error | null;
  reverted?: boolean;
  className?: string;
}

export function TxStatus({
  isPending,
  hash,
  isWaitingForReceipt,
  isSuccess,
  error,
  reverted,
  className = "",
}: TxStatusProps) {
  const reduce = useReducedMotion();

  // Nothing in flight and no status
  if (!isPending && !hash && !isWaitingForReceipt && !isSuccess && !error && !reverted) {
    return null;
  }

  const isFailed = Boolean(reverted || (error && !isWaitingForReceipt && !isPending));
  const confirmed = Boolean(isSuccess && !isFailed && !isWaitingForReceipt && !isPending);

  return (
    <div
      aria-live="polite"
      className={`rounded-xl border p-4 text-xs transition-colors ${
        confirmed
          ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-200"
          : isFailed
          ? "border-rose-500/30 bg-rose-950/20 text-rose-200"
          : "border-teal-500/30 bg-teal-950/20 text-teal-200"
      } ${className}`}
    >
      <div className="flex items-center gap-3">
        {/* State Icon */}
        {confirmed ? (
          <motion.div
            initial={reduce ? false : { scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-400"
          >
            <CheckCircle2 className="h-4 w-4" />
          </motion.div>
        ) : isFailed ? (
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-rose-400">
            <AlertCircle className="h-4 w-4" />
          </div>
        ) : (
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-500/20 text-teal-400">
            <Loader2 className="h-4 w-4 animate-spin" />
          </div>
        )}

        {/* Message and Explorer Link */}
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">
            {confirmed
              ? "Transaction Confirmed"
              : isFailed
              ? "Transaction Failed"
              : isPending
              ? "Confirm in your wallet"
              : "Confirming on Mezo"}
          </p>

          <p className="text-slate-300 mt-0.5 truncate">
            {confirmed ? (
              "State updated on Mezo Testnet."
            ) : isFailed ? (
              error?.message || "Transaction was reverted on-chain."
            ) : isPending ? (
              "Please check your connected wallet to sign the transaction."
            ) : (
              error?.message || "Block confirmation in progress..."
            )}
          </p>

          {hash && (
            <div className="mt-2 flex items-center gap-2">
              <a
                href={`${EXPLORER_URL}/tx/${hash}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-mono text-[11px] text-teal-300 hover:text-teal-200 underline underline-offset-2"
              >
                <span>View on Mezo Explorer</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
