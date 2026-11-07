"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

export type MoneyAction = { title: string; explanation: string; transfers: { label: string; amount: string; recipient: string; token: string }[] };

export function useMoneyConfirmation() {
  const [action, setAction] = useState<MoneyAction | null>(null);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);
  const element = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (action && !element.current?.open) element.current?.showModal(); }, [action]);
  useEffect(() => () => { resolver.current?.(false); }, []);
  function finish(confirmed: boolean) { resolver.current?.(confirmed); resolver.current = null; element.current?.close(); setAction(null); }
  function confirm(next: MoneyAction): Promise<boolean> {
    if (resolver.current) return Promise.resolve(false);
    setAction(next);
    return new Promise((resolve) => { resolver.current = resolve; });
  }
  const dialog = action ? <dialog ref={element} onCancel={(event) => { event.preventDefault(); finish(false); }} aria-labelledby="money-action-title" className="m-auto w-[calc(100%_-_2rem)] max-w-lg rounded-xl bg-[#0f172a] p-6 text-slate-100 backdrop:bg-black/70">
    <h2 id="money-action-title" className="text-xl font-semibold">{action.title}</h2>
    <p className="mt-3 text-sm text-slate-300">{action.explanation}</p>
    <p className="mt-3 text-sm">Mezo Testnet, chain 31611. Wallet gas fees are paid in test BTC.</p>
    <div className="mt-5 space-y-4">{action.transfers.map((transfer, index) => <div key={index} className="rounded-lg bg-slate-900 p-4 space-y-2 text-sm">
      <p className="font-semibold">{transfer.label}: {transfer.amount} MUSD</p>
      <p>Recipient: <code className="block break-all">{transfer.recipient}</code></p>
      <p>Token: <a className="block break-all text-teal-300 underline" href={`https://explorer.test.mezo.org/token/${transfer.token}`} target="_blank" rel="noreferrer">{transfer.token}</a></p>
    </div>)}</div>
    <div className="mt-6 flex justify-end gap-3"><Button variant="outline" onClick={() => finish(false)}>Cancel</Button><Button onClick={() => finish(true)}>Confirm and open wallet</Button></div>
  </dialog> : null;
  return { confirm, dialog };
}
