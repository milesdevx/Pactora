import React from "react";
import { ShieldCheck, Zap, Coins, CheckCircle2 } from "lucide-react";

export function MetricsBar() {
  return (
    <div
      className="w-full max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10"
    >
      <div className="rounded-2xl border border-slate-800/90 bg-gradient-to-r from-[#0f172a] via-[#131d35] to-[#0f172a] p-6 sm:p-8 shadow-2xl">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 divide-y md:divide-y-0 md:divide-x divide-slate-800">
          {/* Stat 1 */}
          <div className="pt-4 md:pt-0 md:px-4 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 text-slate-400 text-xs mb-1">
              <Coins className="h-4 w-4 text-teal-400" />
               <span>Network</span>
             </div>
             <p className="text-2xl sm:text-3xl font-extrabold font-mono text-white tracking-tight">Mezo Testnet</p>
             <p className="text-[11px] text-slate-500 mt-1">Chain ID 31611</p>
          </div>

          {/* Stat 2 */}
          <div className="pt-4 md:pt-0 md:px-4 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 text-slate-400 text-xs mb-1">
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
               <span>Escrow Asset</span>
             </div>
             <p className="text-2xl sm:text-3xl font-extrabold font-mono text-white tracking-tight">MUSD</p>
             <p className="text-[11px] text-slate-500 mt-1">Canonical testnet token</p>
          </div>

          {/* Stat 3 */}
          <div className="pt-4 md:pt-0 md:px-4 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 text-slate-400 text-xs mb-1">
              <ShieldCheck className="h-4 w-4 text-teal-400" />
               <span>Agreement Identity</span>
             </div>
             <p className="text-2xl sm:text-3xl font-extrabold font-mono text-teal-300 tracking-tight">Sequential</p>
             <p className="text-[11px] text-slate-500 mt-1">Emitted by AgreementCreated</p>
          </div>

          {/* Stat 4 */}
          <div className="pt-4 md:pt-0 md:px-4 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2 text-slate-400 text-xs mb-1">
              <Zap className="h-4 w-4 text-amber-400" />
               <span>Displayed State</span>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold font-mono text-white tracking-tight">
               RPC reads
             </p>
             <p className="text-[11px] text-slate-500 mt-1">No placeholder balances</p>
          </div>
        </div>
      </div>
    </div>
  );
}
