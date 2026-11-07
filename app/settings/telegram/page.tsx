"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { WalletSessionControls, useWalletSession, jsonRequest } from "@/components/wallet/WalletSessionProvider";
import { TestnetGuard } from "@/components/wallet/TestnetGuard";

export default function TelegramSettingsPage() {
  const { address, isConnected } = useAccount();
  const session = useWalletSession();
  const [busy, setBusy] = useState(false);
  const [botUrl, setBotUrl] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [testMessage, setTestMessage] = useState("");
  const status = useQuery({ queryKey: ["telegram-link", address], enabled: session.authenticated, retry: false, refetchInterval: botUrl ? 5000 : false, queryFn: () => jsonRequest<{ linked: boolean; link: { telegramUsername?: string; notificationsEnabled: boolean } | null; testNotificationsEnabled: boolean }>("/api/telegram/link") });

  async function act(action: "link" | "unlink" | "test") {
    if (busy || !address) return;
    setBusy(true); setError(null); setNotice(null);
    try {
      await session.ensureSession();
      if (action === "link") {
        const result = await jsonRequest<{ botUrl: string; expiresAt: string }>("/api/telegram/link", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ walletAddress: address.toLowerCase() }) });
        setBotUrl(result.botUrl); setExpiresAt(result.expiresAt);
      } else if (action === "unlink") {
        await jsonRequest("/api/telegram/link", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: "{}" });
        setBotUrl(null); setExpiresAt(null); setNotice("Telegram disconnected and unused tokens revoked.");
      } else {
        await jsonRequest("/api/notifications/test", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(testMessage ? { message: testMessage } : {}) });
        setNotice("Telegram accepted a test notification. This is not a chain payment or proof that you read it.");
      }
      await status.refetch();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Telegram action failed."); }
    finally { setBusy(false); }
  }
  return <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 space-y-6">
    <h1 className="text-2xl sm:text-3xl font-semibold">Telegram Settings</h1>
    <p className="text-sm text-slate-300">Connect your wallet, sign a five-minute nonce, and consume a one-time link in a private bot chat. Old unauthenticated links must be reverified.</p>
    <TestnetGuard /><WalletSessionControls />
    {!isConnected && <p className="text-sm text-amber-200">Connect a wallet to manage your own Telegram account.</p>}
    {error && <p role="alert" className="text-sm text-rose-300">{error}</p>}
    {notice && <p role="status" className="text-sm text-teal-300">{notice}</p>}
    {status.error && <p role="alert" className="text-sm text-amber-200">Link status unavailable: {status.error.message}</p>}
    <Card className="border-slate-800 bg-[#0f172a]"><CardHeader><CardTitle>Wallet Link</CardTitle><CardDescription>Only a successfully stored and consumed signed-session token is shown as linked.</CardDescription></CardHeader><CardContent className="space-y-4">
      {status.data?.linked ? <><p className="text-sm">Linked{status.data.link?.telegramUsername ? ` to @${status.data.link.telegramUsername}` : " in your private chat"}. Notifications {status.data.link?.notificationsEnabled ? "enabled" : "muted"}.</p><Button variant="outline" isLoading={busy} onClick={() => { void act("unlink"); }}>Unlink Telegram</Button></> : <Button disabled={!isConnected} isLoading={busy || session.signing} onClick={() => { void act("link"); }}>Generate One-Time Link</Button>}
      {botUrl && !status.data?.linked && <div className="space-y-2"><a className="inline-block text-teal-300 underline" href={botUrl} target="_blank" rel="noreferrer">Open private Telegram link</a><p className="text-sm text-slate-300">Expires: {expiresAt}. Click Start in Telegram, then refresh link status.</p><Button variant="outline" size="sm" onClick={() => { void status.refetch(); }}>Refresh status</Button></div>}
    </CardContent></Card>
    <Card className="border-slate-800 bg-[#0f172a]"><CardHeader><CardTitle>Notification Safety</CardTitle><CardDescription>Chain alerts are queued only after successful Mezo Testnet receipt verification. Telegram delivery is best-effort; chain state remains authoritative.</CardDescription></CardHeader><CardContent className="space-y-3 text-sm text-slate-300">
      <p>Never provide a seed phrase or private key to the bot. Sign transactions only in your wallet through Pactora.</p>
      <p>Use /help, /agreements, /notifications, and /unlink in your private bot chat.</p>
      {status.data?.testNotificationsEnabled && status.data.linked ? <><label htmlFor="test-message">Optional test message, not a payment</label><Input id="test-message" maxLength={500} value={testMessage} onChange={(event) => setTestMessage(event.target.value)} /><Button variant="outline" isLoading={busy} onClick={() => { void act("test"); }}>Send Test Alert</Button></> : <p>Test notifications are hidden unless explicitly enabled on this deployment. Arbitrary chat-ID targets are not accepted.</p>}
    </CardContent></Card>
  </div>;
}
