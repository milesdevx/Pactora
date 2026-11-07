import React from "react";
import Link from "next/link";
import {
  ShieldAlert,
  ShieldCheck,
  ExternalLink,
  BookOpen,
  ArrowRight,
  Lock,
  FileCheck,
  Scale,
  Send,
  HelpCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default function HelpPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">Documentation</Badge>
          <Badge variant="default">Verification Guide</Badge>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-2">
          Help, Verification & Security
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Learn how Pactora works, verify official contract addresses, and safely coordinate milestone payments on Mezo.
        </p>
      </div>

      {/* Verified Chain Info Card */}
      <Card className="border-teal-500/30 bg-teal-950/10">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2 text-teal-300">
            <ShieldCheck className="h-5 w-5 text-teal-400" />
            Official Verified Mezo Testnet Parameters
          </CardTitle>
          <CardDescription>
            Always verify that your wallet is connected to the authentic Mezo network and canonical MUSD contract.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-slate-400 block mb-0.5">Network Name</span>
              <span className="font-semibold text-white">Mezo Testnet</span>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-slate-400 block mb-0.5">Chain ID</span>
              <span className="font-mono font-semibold text-white">31611 (Hex: 0x7b7b)</span>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-slate-400 block mb-0.5">HTTPS RPC Endpoint</span>
              <span className="font-mono text-slate-300">https://rpc.test.mezo.org</span>
            </div>

            <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
              <span className="text-slate-400 block mb-0.5">Block Explorer</span>
              <a
                href="https://explorer.test.mezo.org"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-teal-300 hover:underline inline-flex items-center gap-1"
              >
                https://explorer.test.mezo.org <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800">
            <span className="text-slate-400 block mb-0.5">Canonical MUSD Token Address</span>
            <a
              href="https://explorer.test.mezo.org/token/0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503"
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-teal-300 hover:underline break-all inline-flex items-center gap-1"
            >
              0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503
              <ExternalLink className="h-3 w-3 shrink-0" />
            </a>
            <span className="text-[11px] text-slate-500 block mt-1">
              Verified 18 decimals • Mezo USD Bitcoin-backed stablecoin
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Step by Step Guide */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="border-slate-800 bg-[#0f172a]">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Lock className="h-4 w-4 text-teal-400" />
              For Clients (Project Owners)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-slate-300 leading-relaxed">
            <p>
              <b>1. Create Agreement:</b> Enter project title, provider address, and milestone amounts.
            </p>
            <p>
              <b>2. Wait for Acceptance:</b> The provider inspects the milestone terms and signs an acceptance transaction.
            </p>
            <p>
              <b>3. Deposit MUSD:</b> Approve and deposit the total milestone funds into the escrow contract.
            </p>
            <p>
              <b>4. Review & Release:</b> When the provider submits a deliverable, inspect the work. Click <b>Approve & Release</b> to transfer funds to the provider, or <b>Reject</b> with feedback.
            </p>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-[#0f172a]">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileCheck className="h-4 w-4 text-teal-400" />
              For Providers (Freelancers)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs text-slate-300 leading-relaxed">
            <p>
              <b>1. Inspect Terms:</b> Review milestone breakdown, due dates, and payout amounts before beginning work.
            </p>
            <p>
              <b>2. Accept Agreement:</b> Call <code>acceptAgreement</code> to commit to the scope.
            </p>
            <p>
              <b>3. Verify Funding:</b> Ensure the client has deposited MUSD into escrow before starting deliverable work.
            </p>
            <p>
              <b>4. Submit Work:</b> Submit deliverable proofs (PR links, IPFS hashes, Figma links) to prompt client review.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Safety & Mutual Consent */}
      <Card className="border-slate-800 bg-[#0f172a]">
        <CardHeader>
          <CardTitle className="text-base">Telegram Commands</CardTitle>
          <CardDescription>Link your wallet from Settings, then use these commands in a private bot chat.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-slate-300">
          <p><code>/start</code>: Welcome and wallet-linking instructions.</p>
          <p><code>/start link_&lt;token&gt;</code>: Consume the one-time link from Settings.</p>
          <p><code>/agreements</code>: List linked agreement metadata.</p>
          <p><code>/notifications</code>: Toggle notifications.</p>
          <p><code>/unlink</code>: Disconnect your Telegram account.</p>
          <p><code>/help</code>: Command guide and wallet safety.</p>
        </CardContent>
      </Card>

      <Card className="border-slate-800 bg-[#0f172a]">
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Scale className="h-4 w-4 text-amber-400" />
            Dispute Handling & Mutual Consent
          </CardTitle>
          <CardDescription>
            Pactora avoids centralized admin backdoors and subjective arbitration in favor of deterministic on-chain rules.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-slate-300 leading-relaxed">
          <p>
            • If project requirements change or a contract cannot proceed, either party can use the <b>Propose Resolution</b> feature in the agreement workspace.
          </p>
          <p>
            • The proposer specifies how much of the remaining escrow balance is returned to the client and how much is paid to the provider (e.g. 50/50 split or 100% refund).
          </p>
          <p>
            • Once the counterparty clicks <b>Accept Resolution Split</b>, the smart contract automatically executes the transfers and closes the agreement.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
