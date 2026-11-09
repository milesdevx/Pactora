import React from "react";
import Link from "next/link";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { PactoraMark } from "@/components/brand/PactoraMark";

export function Footer() {
  return (
    <footer className="w-full border-t border-slate-800/80 bg-[#060a14] py-12 text-slate-400">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          {/* Brand Info */}
          <div className="md:col-span-1 space-y-3">
            <div className="flex items-center gap-2">
              <PactoraMark className="h-7 w-7 text-teal-400" />
              <span className="text-base font-bold text-white tracking-tight">
                Pactora
              </span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Milestone-based MUSD escrow coordination for the Mezo ecosystem.
            </p>
            <p className="text-xs font-medium text-teal-400">
              Work agreed. Funds protected. Payments verified.
            </p>
          </div>

          {/* Product Links */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Application
            </p>
            <ul className="space-y-1.5 text-xs">
              <li>
                <Link href="/dashboard" className="hover:text-white transition-colors">
                  Dashboard
                </Link>
              </li>
              <li>
                <Link href="/agreements/create" className="hover:text-white transition-colors">
                  Create Agreement
                </Link>
              </li>
              <li>
                <Link href="/settings/telegram" className="hover:text-white transition-colors">
                  Telegram Bot Settings
                </Link>
              </li>
              <li>
                <Link href="/help" className="hover:text-white transition-colors">
                  Help & Verification
                </Link>
              </li>
            </ul>
          </div>

          {/* Mezo Ecosystem */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Mezo Ecosystem
            </p>
            <ul className="space-y-1.5 text-xs">
              <li>
                <a
                  href="https://explorer.test.mezo.org/address/0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  <span>MUSD Token Contract</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <a
                  href="https://faucet.test.mezo.org/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  <span>Mezo Testnet Faucet</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <a
                  href="https://mezo.org/docs/developers/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  <span>Mezo Developer Docs</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
              <li>
                <a
                  href="https://explorer.test.mezo.org"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 hover:text-white transition-colors"
                >
                  <span>Mezo Block Explorer</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </li>
            </ul>
          </div>

          {/* Security & Network Notice */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-teal-400" />
              Security Disclosure
            </p>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Pactora is a non-custodial coordination protocol. Escrow funds are governed on-chain by audited smart contract state rules, never held by off-chain servers or private keys. Currently configured for Mezo Testnet (31611).
            </p>
          </div>
        </div>

        <div className="mt-8 border-t border-slate-800/80 pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500">
          <p>© {new Date().getFullYear()} Pactora Protocol. Open-source under MIT License.</p>
          <div className="flex items-center gap-4 mt-2 sm:mt-0">
            <span>Built for Mezo Buildathon</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
