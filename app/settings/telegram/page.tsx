"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useAccount } from "wagmi";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Send,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Copy,
  Check,
  Bell,
  Clock,
  Sparkles,
  RefreshCw,
} from "lucide-react";

export default function TelegramSettingsPage() {
  const { address, isConnected } = useAccount();
  const shouldReduceMotion = useReducedMotion();

  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [botUrl, setBotUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);

  // Remaining seconds for circular countdown
  const [remainingSeconds, setRemainingSeconds] = useState(900); // 15 mins default

  // Test notification state
  const [testChatId, setTestChatId] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testStatus, setTestStatus] = useState<string | null>(null);

  useEffect(() => {
    if (!expiresAt) return;

    const interval = setInterval(() => {
      const diff = Math.max(
        0,
        Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)
      );
      setRemainingSeconds(diff);
      if (diff === 0) clearInterval(interval);
    }, 1000);

    return () => clearInterval(interval);
  }, [expiresAt]);

  const handleGenerateLink = async () => {
    if (!address) return;
    setIsGenerating(true);
    setLinkToken(null);
    try {
      const res = await fetch("/api/telegram/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address }),
      });

      if (res.ok) {
        const data = await res.json();
        setLinkToken(data.token);
        setBotUrl(data.botUrl);
        setExpiresAt(data.expiresAt);
        setRemainingSeconds(900);
      } else {
        alert("Failed to generate linking token.");
      }
    } catch (err) {
      console.error("Linking error:", err);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = () => {
    if (botUrl) {
      navigator.clipboard.writeText(botUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSendTestNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!testChatId) return;

    setIsTesting(true);
    setTestStatus(null);
    try {
      const res = await fetch("/api/notifications/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chatId: testChatId }),
      });

      const data = await res.json();
      if (res.ok) {
        setTestStatus("✅ Test notification sent successfully to Telegram!");
      } else {
        setTestStatus(`⚠️ Delivery failed: ${data.error || "Check Chat ID or bot token"}`);
      }
    } catch (err) {
      setTestStatus("❌ Request failed. Check server connection.");
    } finally {
      setIsTesting(false);
    }
  };

  // Circular progress calculations (radius 22, circum 138)
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const progressRatio = remainingSeconds / 900;
  const strokeDashoffset = circumference * (1 - progressRatio);

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s < 10 ? "0" : ""}${s}`;
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
      <div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">Account Settings</Badge>
          <Badge variant="default">Telegram Bot</Badge>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight mt-2">
          Telegram Notification Settings
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-1">
          Link your Telegram account to receive real-time alerts for milestone submissions, approvals, and MUSD releases.
        </p>
      </div>

      {!isConnected && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 flex items-center gap-3 shadow-lg">
          <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />
          <p className="text-xs text-amber-300">
            Please connect your Web3 wallet first to generate an account-linking token.
          </p>
        </div>
      )}

      {/* Linking Card */}
      <Card className="border-slate-800 bg-[#0f172a] shadow-xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Send className="h-5 w-5 text-teal-400" />
            Link Your Telegram Account
          </CardTitle>
          <CardDescription>
            Pactora uses secure, single-use, 15-minute expiring tokens to pair your Telegram chat without exposing private keys.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {!linkToken ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-900/60 p-4 border border-slate-800 text-xs text-slate-300 leading-relaxed space-y-1.5">
                <p className="font-semibold text-white">How Linking Works:</p>
                <p>1. Click &quot;Generate Telegram Link&quot; below while your wallet is connected.</p>
                <p>2. Open the deep link to start a conversation with the official Pactora Bot.</p>
                <p>3. The bot verifies your single-use token and pairs your chat ID with your wallet.</p>
              </div>

              <Button
                onClick={handleGenerateLink}
                disabled={!isConnected || isGenerating}
                isLoading={isGenerating}
                className="gap-2 shadow-lg shadow-teal-500/20"
              >
                <Sparkles className="h-4 w-4" />
                Generate Secure Telegram Link
              </Button>
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-2xl border border-teal-500/30 bg-teal-950/15 p-6 space-y-5 shadow-2xl relative overflow-hidden"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  {/* Bouncing spring Telegram logo */}
                  <motion.div
                    initial={{ scale: shouldReduceMotion ? 1 : 0 }}
                    animate={{ scale: 1 }}
                    transition={{
                      type: "spring",
                      stiffness: 350,
                      damping: 15,
                    }}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl bg-teal-500/20 text-teal-400 border border-teal-500/30 shrink-0"
                  >
                    <Send className="h-6 w-6" />
                  </motion.div>
                  <div>
                    <h4 className="text-base font-bold text-white flex items-center gap-2">
                      <span>One-Time Linking Token Ready</span>
                      <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    </h4>
                    <p className="text-xs text-slate-300 mt-0.5">
                      Open Telegram and click start to bind your account.
                    </p>
                  </div>
                </div>

                {/* Circular SVG countdown timer */}
                <div className="flex flex-col items-center shrink-0">
                  <div className="relative flex items-center justify-center w-14 h-14">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 54 54">
                      <circle
                        cx="27"
                        cy="27"
                        r={radius}
                        stroke="#1e293b"
                        strokeWidth="3.5"
                        fill="none"
                      />
                      <circle
                        cx="27"
                        cy="27"
                        r={radius}
                        stroke="#14b8a6"
                        strokeWidth="3.5"
                        fill="none"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        className="transition-all duration-1000 ease-linear"
                      />
                    </svg>
                    <span className="absolute text-[10px] font-mono font-bold text-teal-300">
                      {formatTimer(remainingSeconds)}
                    </span>
                  </div>
                  <span className="text-[9px] text-slate-400 mt-1 uppercase font-mono">
                    Expires In
                  </span>
                </div>
              </div>

              {/* Reveal token display */}
              <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 text-xs font-mono text-teal-300 flex items-center justify-between">
                <span className="truncate pr-2">Token: {linkToken}</span>
                <span className="text-[10px] text-slate-500 font-sans uppercase shrink-0">
                  Single-Use
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <a
                  href={botUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex"
                >
                  <Button size="lg" className="gap-2 font-semibold shadow-xl shadow-teal-500/25">
                    <Send className="h-4 w-4" />
                    Open Telegram & Connect
                    <ExternalLink className="h-4 w-4 ml-1" />
                  </Button>
                </a>

                <Button
                  variant="outline"
                  size="lg"
                  onClick={handleCopyLink}
                  className="gap-2 border-slate-700 bg-slate-900/70"
                >
                  {copied ? <Check className="h-4 w-4 text-teal-400" /> : <Copy className="h-4 w-4" />}
                  {copied ? "Link Copied!" : "Copy Link"}
                </Button>
              </div>

              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
                <span>Need a fresh link?</span>
                <button
                  onClick={handleGenerateLink}
                  className="text-teal-400 hover:text-teal-300 underline font-medium cursor-pointer"
                >
                  Regenerate another token
                </button>
              </div>
            </motion.div>
          )}
        </CardContent>
      </Card>

      {/* Test Notification Tool */}
      <Card className="border-slate-800 bg-[#0f172a] shadow-xl">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Bell className="h-5 w-5 text-teal-400" />
            Send Test Notification
          </CardTitle>
          <CardDescription>
            Verify your bot connection by sending a diagnostic test message to your Telegram Chat ID.
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSendTestNotification} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">
                Your Telegram Chat ID
              </label>
              <div className="flex gap-3 max-w-md">
                <Input
                  placeholder="e.g. 123456789"
                  value={testChatId}
                  onChange={(e) => setTestChatId(e.target.value)}
                  className="font-mono text-xs"
                  required
                />
                <Button type="submit" isLoading={isTesting} disabled={!testChatId} size="sm">
                  Send Test
                </Button>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Tip: Send <code>/start</code> to your bot or <code>@userinfobot</code> in Telegram to find your chat ID.
              </p>
            </div>

            <AnimatePresence>
              {testStatus && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="p-3.5 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-200"
                >
                  {testStatus}
                </motion.div>
              )}
            </AnimatePresence>
          </form>
        </CardContent>
      </Card>

      {/* Security Principles */}
      <Card className="border-slate-800 bg-slate-900/40">
        <CardContent className="pt-6 space-y-2">
          <div className="flex items-center gap-2 text-xs font-semibold text-slate-200">
            <ShieldCheck className="h-4 w-4 text-teal-400" />
            Telegram Safety Guarantees
          </div>
          <ul className="text-xs text-slate-400 space-y-1 list-disc list-inside">
            <li>The Telegram bot never holds custody of private keys, seed phrases, or funds.</li>
            <li>All releases and approvals are executed strictly via your browser wallet on Mezo.</li>
            <li>You can unlink your Telegram account anytime using the <code>/unlink</code> bot command.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
