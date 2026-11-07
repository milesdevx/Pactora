"use client";

import { createContext, useContext, useRef, useState } from "react";
import { useAccount, useSignMessage, useSwitchChain } from "wagmi";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";

type SessionContext = { authenticated: boolean; signing: boolean; error: string | null; ensureSession: () => Promise<void> };
const Context = createContext<SessionContext | null>(null);

export async function jsonRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { credentials: "same-origin", cache: "no-store", ...init });
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error || `Request failed (${response.status}).`);
  return data as T;
}

export function WalletSessionProvider({ children }: { children: React.ReactNode }) {
  const { address, chainId, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const { switchChainAsync } = useSwitchChain();
  const client = useQueryClient();
  const lock = useRef(false);
  const [signing, setSigning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const session = useQuery({
    queryKey: ["wallet-session", address?.toLowerCase()], enabled: isConnected,
    retry: false, staleTime: 0,
    queryFn: async () => {
      const response = await fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin" });
      if (response.status === 401) return null;
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Wallet session is unavailable.");
      return data as { walletAddress: string };
    },
  });
  const authenticated = Boolean(address && session.data?.walletAddress === address.toLowerCase());

  async function ensureSession() {
    if (!address) throw new Error("Connect your wallet first.");
    if (lock.current) throw new Error("A wallet sign-in is already in progress.");
    lock.current = true;
    setSigning(true);
    setError(null);
    try {
      if (chainId !== 31611) await switchChainAsync({ chainId: 31611 });
      const current = await fetch("/api/auth/session", { cache: "no-store", credentials: "same-origin" });
      if (current.ok) { const verified = await current.json(); if (verified.walletAddress === address.toLowerCase()) return; }
      else if (current.status !== 401) throw new Error("Wallet session service is unavailable. No transaction has been sent.");
      const nonce = await jsonRequest<{ nonce: string; message: string }>("/api/auth/nonce", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ walletAddress: address.toLowerCase() }) });
      const signature = await signMessageAsync({ message: nonce.message, account: address });
      await jsonRequest("/api/auth/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ walletAddress: address.toLowerCase(), nonce: nonce.nonce, message: nonce.message, signature }) });
      await client.invalidateQueries({ queryKey: ["wallet-session"] });
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Wallet sign-in failed.";
      setError(message);
      throw new Error(message);
    } finally { lock.current = false; setSigning(false); }
  }
  return <Context.Provider value={{ authenticated, signing, error: error || session.error?.message || null, ensureSession }}>{children}</Context.Provider>;
}

export function useWalletSession() {
  const context = useContext(Context);
  if (!context) throw new Error("WalletSessionProvider is required.");
  return context;
}

export function WalletSessionControls() {
  const { isConnected } = useAccount();
  const session = useWalletSession();
  if (!isConnected) return null;
  return <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
    {session.authenticated ? <span>Signed wallet session active.</span> : <Button variant="outline" size="sm" isLoading={session.signing} onClick={() => { void session.ensureSession().catch(() => undefined); }}>Sign in with wallet</Button>}
    {session.error && <p role="alert" className="text-rose-300 break-words">{session.error}</p>}
  </div>;
}
