"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";
import { mezoTestnet } from "@/lib/chain/config";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AddressChip } from "@/components/ui/AddressChip";
import { PactoraMark } from "@/components/brand/PactoraMark";
import {
  Wallet,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ChevronDown,
  LogOut,
  Copy,
  Check,
  Send,
  PlusCircle,
  LayoutDashboard,
  ShieldAlert,
  Menu,
  X,
} from "lucide-react";

export function Navbar() {
  const pathname = usePathname();
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const [copied, setCopied] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isWrongNetwork = isConnected && chain?.id !== mezoTestnet.id;

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const navLinks = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/agreements/create", label: "New Agreement", icon: PlusCircle },
    { href: "/settings/telegram", label: "Telegram", icon: Send },
    { href: "/help", label: "Help & Safety", icon: ShieldAlert },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-800/80 bg-[#080d1a]/90 backdrop-blur-md">
      {/* Wrong Network Animated Banner */}
      <AnimatePresence>
        {isWrongNetwork && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden bg-rose-950/90 border-b border-rose-500/40 text-center text-xs text-rose-200 py-2 px-4"
          >
            <div className="flex items-center justify-center gap-2 flex-wrap">
              <AlertCircle className="h-4 w-4 text-rose-400 animate-pulse" />
              <span className="font-medium">
                Your wallet is connected to an unsupported network.
              </span>
              <button
                onClick={() => switchChain?.({ chainId: mezoTestnet.id })}
                className="font-bold underline text-white hover:text-rose-200 ml-1 cursor-pointer"
              >
                Switch to Mezo Testnet (31611) →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-3 group">
            <PactoraMark className="h-9 w-9 text-teal-400 transition-transform duration-200 group-hover:scale-105" />
            <div className="flex flex-col">
              <span className="text-base font-bold tracking-tight text-white flex items-center gap-1.5">
                Pactora
                <span className="text-[10px] font-normal px-1.5 py-0.2 rounded bg-teal-500/10 text-teal-300 border border-teal-500/20">
                  Mezo
                </span>
              </span>
              <span className="text-[11px] text-slate-400 -mt-0.5 font-sans">
                MUSD Escrow
              </span>
            </div>
          </Link>

          {/* Desktop Navigation with Shared Layout Indicator */}
          <nav className="hidden md:flex items-center gap-1 relative">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative flex items-center gap-2 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    isActive ? "text-teal-300" : "text-slate-300 hover:text-white"
                  }`}
                >
                  <Icon className="h-4 w-4 relative z-10" />
                  <span className="relative z-10">{link.label}</span>

                  {/* Active sliding pill indicator */}
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute inset-0 rounded-lg bg-slate-800/90 border border-slate-700/60 shadow-sm"
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 30,
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Right Controls: Network status & Wallet */}
        <div className="flex items-center gap-3">
          {/* Network Indicator */}
          <div className="hidden sm:flex items-center">
            {isWrongNetwork ? (
              <button
                onClick={() => switchChain?.({ chainId: mezoTestnet.id })}
                className="flex items-center gap-1.5 rounded-lg border border-rose-500/40 bg-rose-950/40 px-2.5 py-1 text-xs font-medium text-rose-300 hover:bg-rose-900/40 transition-colors"
                title="Switch to Mezo Testnet"
              >
                <AlertCircle className="h-3.5 w-3.5 text-rose-400 animate-pulse" />
                <span>Wrong Network</span>
                <span className="underline ml-1">Switch</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 rounded-lg border border-slate-800 bg-slate-900/80 px-2.5 py-1 text-xs text-slate-300">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-teal-500"></span>
                </span>
                <span className="font-medium text-slate-200">Mezo Testnet</span>
                <span className="text-[10px] text-slate-500 font-mono">(31611)</span>
              </div>
            )}
          </div>

          {/* Wallet Connection */}
          {isConnected && address ? (
            <div className="relative">
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="relative flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/90 px-3 py-1.5 text-sm font-medium text-slate-200 hover:bg-slate-800 hover:border-teal-500/40 transition-colors cursor-pointer"
              >
                <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></div>
                <span className="font-mono text-xs">
                  {address.slice(0, 6)}...{address.slice(-4)}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
              </button>

              <AnimatePresence>
                {dropdownOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-64 rounded-xl border border-slate-800 bg-[#0f172a] p-2 shadow-2xl backdrop-blur-md z-50"
                    onMouseLeave={() => setDropdownOpen(false)}
                  >
                    <div className="px-3 py-2 border-b border-slate-800">
                      <p className="text-[11px] text-slate-400 uppercase tracking-wider font-semibold mb-1">
                        Connected Wallet
                      </p>
                      <AddressChip value={address} className="w-full justify-between" />
                    </div>

                    <div className="py-1">
                      <button
                        onClick={handleCopy}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      >
                        {copied ? (
                          <Check className="h-3.5 w-3.5 text-teal-400" />
                        ) : (
                          <Copy className="h-3.5 w-3.5 text-slate-400" />
                        )}
                        <span>{copied ? "Address Copied!" : "Copy Address"}</span>
                      </button>

                      <a
                        href={`https://explorer.test.mezo.org/address/${address}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                        <span>View on Mezo Explorer</span>
                      </a>

                      <Link
                        href="/settings/telegram"
                        onClick={() => setDropdownOpen(false)}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800 rounded-lg transition-colors"
                      >
                        <Send className="h-3.5 w-3.5 text-slate-400" />
                        <span>Telegram Settings</span>
                      </Link>
                    </div>

                    <div className="border-t border-slate-800 pt-1">
                      <button
                        onClick={() => {
                          disconnect();
                          setDropdownOpen(false);
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-xs text-rose-400 hover:bg-rose-950/30 rounded-lg transition-colors cursor-pointer"
                      >
                        <LogOut className="h-3.5 w-3.5" />
                        <span>Disconnect Wallet</span>
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            <Button
              onClick={() => {
                const connector = connectors[0];
                if (connector) connect({ connector });
              }}
              isLoading={isPending}
              size="sm"
              className="gap-2 font-medium shadow-md shadow-teal-500/20"
            >
              <Wallet className="h-4 w-4" />
              <span>Connect Wallet</span>
            </Button>
          )}

          {/* Mobile menu toggle */}
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-300 hover:text-white"
            aria-label="Toggle Navigation Menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Dropdown with AnimatePresence */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="md:hidden border-t border-slate-800 bg-[#080d1a] px-4 py-4 space-y-2 overflow-hidden"
          >
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium ${
                    isActive
                      ? "bg-slate-800 text-teal-300 border border-slate-700/60"
                      : "text-slate-300 hover:bg-slate-800/50"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {link.label}
                </Link>
              );
            })}

            <div className="pt-2 border-t border-slate-800">
              <div className="flex items-center justify-between text-xs text-slate-400 py-1">
                <span>Network:</span>
                <span className="font-medium text-slate-200">Mezo Testnet (31611)</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
