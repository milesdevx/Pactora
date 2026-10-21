"use client";

import React, { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import { mezoTestnet } from "@/lib/chain/config";

const EXPLORER_URL =
  process.env.NEXT_PUBLIC_EXPLORER_URL ||
  mezoTestnet.blockExplorers.default.url ||
  "https://explorer.test.mezo.org";

export interface AddressChipProps {
  value: string;
  type?: "address" | "tx";
  label?: string;
  className?: string;
  showExplorerLink?: boolean;
}

function truncate(str: string, lead = 6, tail = 4): string {
  if (!str) return "";
  if (str.length <= lead + tail + 2) return str;
  return `${str.slice(0, lead)}…${str.slice(-tail)}`;
}

export function AddressChip({
  value,
  type = "address",
  label,
  className = "",
  showExplorerLink = true,
}: AddressChipProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (err) {
      console.warn("Failed to copy address:", err);
    }
  };

  const path = type === "tx" ? "tx" : "address";
  const explorerHref = `${EXPLORER_URL}/${path}/${value}`;

  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2 py-1 text-slate-200 ${className}`}
    >
      {label && <span className="text-[10px] font-medium text-slate-400 mr-0.5">{label}:</span>}
      <span className="font-mono text-mono-sm tracking-[-0.01em]" title={value}>
        {truncate(value)}
      </span>

      <button
        type="button"
        onClick={handleCopy}
        aria-label={copied ? "Copied" : "Copy to clipboard"}
        className="rounded p-0.5 text-slate-400 hover:text-white transition-colors"
      >
        {copied ? (
          <Check className="h-3 w-3 text-emerald-400" />
        ) : (
          <Copy className="h-3 w-3" />
        )}
      </button>

      {/* Screen reader notification for copy */}
      <span aria-live="polite" className="sr-only">
        {copied ? "Copied to clipboard" : ""}
      </span>

      {showExplorerLink && (
        <a
          href={explorerHref}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`View on Mezo Explorer (${type})`}
          className="rounded p-0.5 text-slate-400 hover:text-teal-400 transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

