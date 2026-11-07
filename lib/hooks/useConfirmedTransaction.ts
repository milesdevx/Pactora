"use client";

import { useRef, useState } from "react";
import { usePublicClient } from "wagmi";
import { BaseError, UserRejectedRequestError, type Hash, type TransactionReceipt } from "viem";
import { useWalletSession, jsonRequest } from "@/components/wallet/WalletSessionProvider";

export function useConfirmedTransaction() {
  const publicClient = usePublicClient({ chainId: 31611 });
  const session = useWalletSession();
  const lock = useRef(false);
  const [status, setStatus] = useState<"idle" | "signing" | "pending" | "confirmed" | "reverted" | "rejected" | "failed">("idle");
  const [hash, setHash] = useState<Hash>();
  const [error, setError] = useState<Error | null>(null);
  const [receipt, setReceipt] = useState<TransactionReceipt>();
  const [notificationWarning, setNotificationWarning] = useState<string | null>(null);

  async function notifyConfirmed(txHash: Hash) {
    try { await jsonRequest("/api/notifications/confirmed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ txHash }) }); }
    catch { setNotificationWarning("Transaction confirmed on-chain, but Telegram notifications could not be queued. No delivery is being claimed."); }
  }

  async function execute(send: () => Promise<Hash>, notify = true): Promise<TransactionReceipt | null> {
    if (lock.current) return null;
    lock.current = true;
    setHash(undefined); setError(null); setReceipt(undefined); setNotificationWarning(null); setStatus("signing");
    let broadcastHash: Hash | undefined;
    let ended = false;
    try {
      if (!publicClient || await publicClient.getChainId() !== 31611) throw new Error("Mezo Testnet RPC is unavailable.");
      await session.ensureSession();
      broadcastHash = await send();
      setHash(broadcastHash); setStatus("pending");
      let replacedIntent = false;
      const confirmed = await publicClient.waitForTransactionReceipt({ hash: broadcastHash, timeout: 180_000, confirmations: 1, onReplaced: (replacement) => { setHash(replacement.transactionReceipt.transactionHash); replacedIntent = replacement.reason !== "repriced"; } });
      setReceipt(confirmed); setHash(confirmed.transactionHash); ended = true;
      if (replacedIntent) throw new Error("The transaction was cancelled or replaced with a different action. No escrow action is being claimed.");
      if (confirmed.status !== "success") { setStatus("reverted"); setError(new Error("Transaction reverted on Mezo Testnet. No payment was completed.")); return null; }
      setStatus("confirmed");
      if (notify) await notifyConfirmed(confirmed.transactionHash);
      return confirmed;
    } catch (cause) {
      const rejected = cause instanceof BaseError && cause.walk((nested) => nested instanceof UserRejectedRequestError) instanceof UserRejectedRequestError;
      const message = cause instanceof BaseError ? cause.shortMessage : cause instanceof Error ? cause.message : "Transaction could not be completed.";
      if (broadcastHash && !ended) {
        setStatus("pending");
        setError(new Error("Confirmation is unavailable. Check the explorer before retrying; duplicate actions remain disabled."));
      } else { ended = true; setStatus(rejected ? "rejected" : "failed"); setError(new Error(message)); }
      return null;
    } finally { if (ended) lock.current = false; }
  }

  return { execute, notifyConfirmed, hash, error, receipt, status, busy: status === "signing" || status === "pending", isPending: status === "signing", isWaitingForReceipt: status === "pending", isSuccess: status === "confirmed", notificationWarning, setError };
}
