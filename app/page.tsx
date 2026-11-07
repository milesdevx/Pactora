"use client";

import React from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import {
  ShieldCheck,
  ArrowRight,
  Lock,
  Send,
  FileCheck,
  Sparkles,
  ExternalLink,
  ChevronRight,
  Shield,
  Layers,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LiveEscrowPreview } from "@/components/landing/LiveEscrowPreview";
import { HowItWorksSteps } from "@/components/landing/HowItWorksSteps";
import { MetricsBar } from "@/components/landing/MetricsBar";
import { SlideInCard } from "@/components/motion/SlideInCard";

export default function LandingPage() {
  const shouldReduceMotion = useReducedMotion();

  // Words for staggered headline animation
  const headlineWords = [
    { text: "Work", gradient: false },
    { text: "agreed.", gradient: false },
    { text: "Funds", gradient: true },
    { text: "protected.", gradient: true },
    { text: "Payments", gradient: false },
    { text: "verified.", gradient: false },
  ];

  return (
    <div className="flex flex-col items-center relative overflow-hidden">
      {/* 3 Layered Slow-Drifting Ambient Orbs */}
      <div className="absolute top-20 left-1/4 -translate-x-1/2 w-[700px] h-[450px] bg-teal-500/10 blur-[140px] rounded-full pointer-events-none -z-10 animate-float-slow" />
      <div
        className="absolute top-40 right-10 w-[550px] h-[350px] bg-teal-600/10 blur-[140px] rounded-full pointer-events-none -z-10 animate-float-slow"
        style={{ animationDelay: "2s" }}
      />
      <div
        className="absolute top-96 left-1/3 w-[450px] h-[300px] bg-emerald-500/10 blur-[130px] rounded-full pointer-events-none -z-10 animate-float-slow"
        style={{ animationDelay: "1s" }}
      />

      {/* Network Alert Banner */}
      <div className="w-full bg-slate-900/90 border-b border-slate-800/80 px-4 py-2 text-center text-xs text-slate-300 backdrop-blur-sm z-20">
        <span className="inline-flex items-center gap-2 flex-wrap justify-center">
          <Badge variant="testnet" className="py-0 px-2 text-[10px]">
            MEZO TESTNET
          </Badge>
          <span>
            Pactora is live on Mezo Testnet (Chain ID 31611) with verified MUSD token escrow.
          </span>
          <a
            href="https://faucet.test.mezo.org/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-400 underline hover:text-teal-300 font-medium inline-flex items-center gap-0.5 ml-1"
          >
            Get Test BTC & MUSD <ExternalLink className="h-3 w-3" />
          </a>
        </span>
      </div>

      {/* Split Asymmetric Hero Section */}
      <section className="relative w-full max-w-7xl px-4 pt-16 pb-12 sm:px-6 sm:pt-24 sm:pb-20 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
          {/* Left Column: 60% (7 cols on lg) */}
          <div className="lg:col-span-7 text-left flex flex-col items-start">
            {/* Pill Badge */}
            <motion.div
              initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-teal-500/30 bg-teal-500/10 text-teal-300 text-xs font-medium mb-6"
            >
              <Sparkles className="h-3.5 w-3.5 text-teal-400" />
              <span>Non-Custodial Milestone Escrow on Mezo</span>
            </motion.div>

            {/* Staggered Word Headline */}
            <h1 className="text-display-xl text-white">
              {headlineWords.map((word, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 35 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.55,
                    delay: shouldReduceMotion ? 0 : i * 0.08,
                    ease: [0.25, 0.1, 0.25, 1] as const,
                  }}
                  className={`inline-block mr-3 ${
                    word.gradient
                      ? "text-transparent bg-clip-text bg-gradient-to-r from-teal-300 via-teal-400 to-emerald-400"
                      : ""
                  }`}
                >
                  {word.text}{" "}
                </motion.span>
              ))}
            </h1>

            {/* Subtitle */}
            <motion.p
              initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.55,
                delay: shouldReduceMotion ? 0 : 0.5,
                ease: [0.25, 0.1, 0.25, 1],
              }}
              className="mt-6 max-w-xl text-base sm:text-lg text-slate-400 leading-relaxed"
            >
              Pactora enables clients and freelancers to agree on deliverables, lock project funds in MUSD, and release payments upon milestone approval—with verifiable on-chain receipts and real-time Telegram notifications.
            </motion.p>

            {/* Hero CTAs */}
            <motion.div
              initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{
                duration: 0.55,
                delay: shouldReduceMotion ? 0 : 0.65,
                ease: [0.25, 0.1, 0.25, 1],
              }}
              className="mt-8 flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto"
            >
              <Link href="/agreements/create">
                <Button
                  size="lg"
                  className="relative overflow-hidden group gap-2 text-base px-7 font-semibold shadow-xl shadow-teal-500/25 w-full sm:w-auto cursor-pointer"
                >
                  {/* Shimmer sweep on hover */}
                  <span className="absolute inset-0 w-1/2 h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-[300%] transition-transform duration-1000 ease-in-out pointer-events-none" />
                  <span>Create an Agreement</span>
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link href="/dashboard">
                <Button
                  variant="outline"
                  size="lg"
                  className="text-base px-7 border-slate-700 bg-slate-900/60 backdrop-blur-md hover:bg-slate-800/80 hover:border-slate-600 w-full sm:w-auto"
                >
                  Open Dashboard
                </Button>
              </Link>
            </motion.div>

            {/* Quick Guarantees */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.6 }}
              className="mt-8 flex flex-wrap items-center gap-4 text-xs text-slate-400"
            >
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-teal-400" />
                <span>Unaudited Testnet Contract</span>
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-teal-400" />
                <span>Zero Server Custody</span>
              </span>
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-teal-400" />
                <span>Instant MUSD Payouts</span>
              </span>
            </motion.div>
          </div>

          {/* Right Column: 40% (5 cols on lg) — Live Interactive Simulation */}
          <div className="lg:col-span-5 w-full">
            <motion.div
              initial={{ opacity: 0, scale: shouldReduceMotion ? 1 : 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.7, delay: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
            >
              <LiveEscrowPreview />
            </motion.div>
          </div>
        </div>
      </section>

      {/* Security Pillars (3 Larger Animated Feature Cards) */}
      <section className="w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <SlideInCard delay={0.1}>
            <div className="group h-full p-6 rounded-2xl border border-slate-800/90 bg-gradient-to-br from-[#0f172a] to-[#131d35] hover:border-teal-500/40 transition-all shadow-xl">
              <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/30 mb-5 shadow-[0_0_24px_rgba(20,184,166,0.25)] group-hover:scale-110 transition-transform">
                <Lock className="h-6 w-6" />
              </div>
              <h3 className="text-heading-md text-white group-hover:text-teal-300 transition-colors">
                On-Chain Escrow Security
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Funds are locked directly into immutable Solidity smart contracts on Mezo. No centralized server, intermediary, or operator holds private keys or withdrawal rights.
              </p>
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center text-xs text-teal-400 font-medium group-hover:translate-x-1 transition-transform">
                <span>View Security Spec</span>
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </div>
            </div>
          </SlideInCard>

          <SlideInCard delay={0.25}>
            <div className="group h-full p-6 rounded-2xl border border-slate-800/90 bg-gradient-to-br from-[#0f172a] to-[#131d35] hover:border-teal-500/40 transition-all shadow-xl">
              <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/30 mb-5 shadow-[0_0_24px_rgba(20,184,166,0.25)] group-hover:scale-110 transition-transform">
                <FileCheck className="h-6 w-6" />
              </div>
              <h3 className="text-heading-md text-white group-hover:text-teal-300 transition-colors">
                Milestone-By-Milestone Payouts
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Break large agreements into verifiable increments. Freelancers gain confidence from locked deposits; clients retain full control until deliverables are verified.
              </p>
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center text-xs text-teal-400 font-medium group-hover:translate-x-1 transition-transform">
                <span>Explore Workflow</span>
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </div>
            </div>
          </SlideInCard>

          <SlideInCard delay={0.4}>
            <div className="group h-full p-6 rounded-2xl border border-slate-800/90 bg-gradient-to-br from-[#0f172a] to-[#131d35] hover:border-teal-500/40 transition-all shadow-xl">
              <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-teal-500/10 text-teal-400 border border-teal-500/30 mb-5 shadow-[0_0_24px_rgba(20,184,166,0.25)] group-hover:scale-110 transition-transform">
                <Send className="h-6 w-6" />
              </div>
              <h3 className="text-heading-md text-white group-hover:text-teal-300 transition-colors">
                Instant Telegram Alerts
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Connect your wallet in one click via a 15-minute single-use secure token. Receive immediate alerts when agreements are funded, submissions arrive, or payments clear.
              </p>
              <div className="mt-4 pt-3 border-t border-slate-800 flex items-center text-xs text-teal-400 font-medium group-hover:translate-x-1 transition-transform">
                <span>Configure Bot</span>
                <ChevronRight className="h-3.5 w-3.5 ml-1" />
              </div>
            </div>
          </SlideInCard>
        </div>
      </section>

      {/* Animated Metrics Bar */}
      <MetricsBar />

      {/* 3-Step Visual Workflow */}
      <section className="w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
        <div className="text-center max-w-2xl mx-auto">
          <Badge variant="secondary" className="mb-3">
            The Protocol Workflow
          </Badge>
          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            How Pactora Coordinates Payments
          </h2>
          <p className="text-slate-400 mt-3 text-sm sm:text-base">
            No trust assumptions. On-chain rules enforce that freelancers only work when funds are locked, and clients only pay when milestones are approved.
          </p>
        </div>

        {/* Animated Connected Steps */}
        <HowItWorksSteps />
      </section>

      {/* Telegram Feature Highlight with Animated Bubble */}
      <section className="w-full border-y border-slate-800 bg-[#0b101f] py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-10">
          <div className="max-w-xl">
            <Badge variant="default" className="mb-3">
              Real-Time Messaging
            </Badge>
            <h2 className="text-3xl font-bold text-white tracking-tight">
              Never Miss a Milestone with Telegram Notifications
            </h2>
            <p className="text-slate-400 mt-4 text-sm leading-relaxed">
              Link your wallet in seconds through a single-use secure token. Receive instant Telegram messages when agreements are accepted, milestones are submitted for review, or payments are released.
            </p>
            <div className="mt-6 flex items-center gap-4">
              <Link href="/settings/telegram">
                <Button className="gap-2 shadow-lg shadow-teal-500/20">
                  <Send className="h-4 w-4" />
                  Configure Telegram Bot
                </Button>
              </Link>
            </div>
          </div>

          <motion.div
            whileHover={{ y: shouldReduceMotion ? 0 : -4 }}
            className="w-full max-w-md rounded-2xl border border-slate-700/80 bg-slate-900/90 backdrop-blur-md p-5 shadow-2xl relative"
          >
            <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
              <div className="h-9 w-9 rounded-full bg-teal-500/20 flex items-center justify-center text-teal-400 font-bold border border-teal-500/30">
                🤖
              </div>
              <div>
                <p className="text-xs font-bold text-white">Pactora Bot</p>
                <p className="text-[11px] text-teal-400">Verified Bot (@PactoraEscrowBot)</p>
              </div>
            </div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4 }}
              className="mt-4 p-3.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs text-slate-200 leading-relaxed font-sans space-y-2 shadow-inner"
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-teal-300 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-teal-400" />
                  Milestone Approved & Paid
                </p>
                <span className="text-[10px] font-mono text-slate-400">Just now</span>
              </div>
              <p>Milestone #1 approved! <b className="text-white">1,500.00 MUSD</b> has been transferred to provider.</p>
              <p className="text-[11px] font-mono text-slate-400">Tx: 0x7c4f...91ae</p>
              <div className="pt-1">
                <span className="text-[10px] text-teal-400 underline font-medium">
                  View Verifiable Receipt in Pactora →
                </span>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="w-full max-w-4xl px-4 py-20 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white tracking-tight">
            Frequently Asked Questions
          </h2>
          <p className="text-slate-400 mt-2 text-sm">
            Everything you need to know about milestone escrow and MUSD on Mezo.
          </p>
        </div>

        <div className="space-y-4">
          <Card className="border-slate-800 bg-[#0f172a] hover:border-slate-700 transition-colors">
            <CardContent className="pt-6">
              <h3 className="text-base font-semibold text-white">
                What is MUSD and why does Pactora use it?
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                MUSD is Mezo&apos;s Bitcoin-backed stablecoin pegged 1:1 to the US Dollar. By denominating agreements in MUSD, both clients and freelancers eliminate cryptocurrency volatility risk during multi-week project timelines while staying native on Mezo.
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-[#0f172a] hover:border-slate-700 transition-colors">
            <CardContent className="pt-6">
              <h3 className="text-base font-semibold text-white">
                Who holds custody of the escrowed funds?
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Neither Pactora nor any central server holds your funds. MUSD is locked strictly inside the audited Solidity escrow contract deployed on Mezo Testnet. Funds can only be released through client approval or mutual-consent dispute resolution.
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-[#0f172a] hover:border-slate-700 transition-colors">
            <CardContent className="pt-6">
              <h3 className="text-base font-semibold text-white">
                How are disagreements or project cancellations handled?
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Pactora uses transparent on-chain mutual consent. If an agreement cannot proceed, either party can propose a split of the remaining escrow balance (e.g., partial refund to client, partial payment to provider). Once the counterparty accepts, the contract automatically executes the split and closes the agreement.
              </p>
            </CardContent>
          </Card>

          <Card className="border-slate-800 bg-[#0f172a] hover:border-slate-700 transition-colors">
            <CardContent className="pt-6">
              <h3 className="text-base font-semibold text-white">
                How do I get testnet tokens to try Pactora?
              </h3>
              <p className="text-xs text-slate-400 mt-2 leading-relaxed">
                Connect your Web3 wallet to Mezo Testnet (Chain ID 31611) and visit the official Mezo Testnet faucet at faucet.test.mezo.org to request test BTC (for gas fees) and test MUSD.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}
