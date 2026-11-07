import { formatUnits } from "viem";

export type BotAgreement = {
  id: number; title?: string; state: number; client: string; provider: string; token: string;
  total: bigint; remaining: bigint; legacy: boolean; now: bigint; creationTxHash?: string;
  milestones: { index: number; state: number; amount: bigint; deliveryDeadline?: bigint; submittedAt?: bigint; rejectedAt?: bigint }[];
};
const musd = "0x118917a40faf1cd7a13db0ef56c86de7973ac503";
const states = ["Created", "Accepted", "Funded", "Completed", "Cancelled"];
const reviewWindow = 604800n;
export function html(value: string) { return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }

export function formatBalance(wallet: string, musdBalance: bigint, btcBalance: bigint, block: bigint, appUrl: string) {
  return `<b>Mezo Testnet balance</b>\n\nWallet: <code>${wallet}</code>\nMUSD: <b>${formatUnits(musdBalance, 18)}</b>\nBTC for gas: <b>${formatUnits(btcBalance, 18)}</b>\nSnapshot: block ${block}\n\n` +
    `<a href="${appUrl}/dashboard">Open Pactora</a> | <a href="https://explorer.test.mezo.org/address/${wallet}">Wallet explorer</a>\n` +
    `<a href="https://explorer.test.mezo.org/token/${musd}">Canonical MUSD</a>\nRead-only command; no transaction was sent. Use /getmusd for test funds.`;
}

export function nextAction(agreement: BotAgreement, wallet: string): string {
  const client = agreement.client.toLowerCase() === wallet.toLowerCase();
  if (agreement.state === 3 || agreement.state === 4) return "View the public receipt; agreement is closed.";
  if (agreement.state === 0) return client ? "Waiting for provider acceptance." : "Review and accept the agreement terms.";
  if (agreement.state === 1) return client ? "Approve the token allowance and fund escrow in the app." : "Waiting for client funding; do not deliver before funding.";
  const overdue = agreement.milestones.find((item) => (item.state === 0 || item.state === 3) && item.deliveryDeadline !== undefined && agreement.now >= (item.state === 3 && item.rejectedAt !== undefined && item.rejectedAt + reviewWindow > item.deliveryDeadline ? item.rejectedAt + reviewWindow : item.deliveryDeadline));
  if (overdue && !agreement.legacy) return client ? `Refund no-show milestone ${overdue.index + 1} after its agreed cutoff.` : `Milestone ${overdue.index + 1} delivery cutoff elapsed; coordinate refund or mutual settlement.`;
  const milestone = agreement.milestones.find((item) => client ? item.state === 1 : item.state === 0 || item.state === 3);
  if (milestone) return client ? `Review submitted milestone ${milestone.index + 1}.` : `Deliver or resubmit milestone ${milestone.index + 1}.`;
  if (!client && !agreement.legacy) {
    const claim = agreement.milestones.find((item) => item.state === 1 && item.submittedAt !== undefined && agreement.now >= item.submittedAt + reviewWindow);
    if (claim) return `Claim milestone ${claim.index + 1} after its review timeout.`;
  }
  return client ? "Waiting for provider delivery; check agreed deadlines for refunds." : "Waiting for client review.";
}

function links(agreement: BotAgreement, appUrl: string) {
  return `<a href="${appUrl}/agreements/${agreement.id}">Open agreement</a> | <a href="${appUrl}/receipts/${agreement.id}">Receipt</a>` +
    (agreement.creationTxHash ? `\n<a href="https://explorer.test.mezo.org/tx/${agreement.creationTxHash}">Confirmed creation transaction</a>` : "");
}

export function formatAgreements(agreements: BotAgreement[], wallet: string, appUrl: string, complete: boolean) {
  const scope = complete ? "" : "\nDiscovery is limited to registered metadata plus the first 50 on-chain IDs; this is not a full indexer.";
  if (!agreements.length) return `<b>Your agreements</b>\nNo matching agreements found in the checked discovery scope.${scope}\n<a href="${appUrl}/agreements/create">Create an agreement</a>`;
  return `<b>Your agreements</b>${scope}\n\n` + agreements.slice(0, 8).map((agreement) => {
    const amount = agreement.token.toLowerCase() === musd ? `${formatUnits(agreement.total, 18)} MUSD agreement total` : `${agreement.total} base units, token ${agreement.token}`;
    return `#${agreement.id} ${html(agreement.title || "")}\n${states[agreement.state]}${agreement.legacy ? " (legacy, read-only in app)" : ""}\n${amount}\nNext: ${nextAction(agreement, wallet)}\n${links(agreement, appUrl)}`;
  }).join("\n\n") + (agreements.length > 8 ? `\n\n${agreements.length - 8} more in the app.` : "");
}

export function formatPending(agreements: BotAgreement[], wallet: string, appUrl: string, complete: boolean) {
  const items = agreements.flatMap((agreement) => agreement.state !== 2 ? [] : agreement.milestones.filter((milestone) => agreement.client.toLowerCase() === wallet.toLowerCase() ? milestone.state === 1 : milestone.state === 0 || milestone.state === 3).map((milestone) => ({ agreement, milestone })));
  const scope = complete ? "" : "\nDiscovery is limited; unindexed agreements may be missing.";
  if (!items.length) return `<b>Actions pending</b>\nNo review/delivery items found in the checked scope.${scope}\n<a href="${appUrl}/dashboard">Check Pactora</a>`;
  return `<b>Actions pending</b>${scope}\n\n` + items.slice(0, 10).map(({ agreement, milestone }) => `Agreement #${agreement.id}, milestone ${milestone.index + 1}: ${agreement.client.toLowerCase() === wallet.toLowerCase() ? "Review submitted work" : milestone.state === 3 ? "Revise and resubmit" : "Deliver work"}${agreement.legacy ? " (legacy, read-only in app)" : ""}\n${links(agreement, appUrl)}`).join("\n\n") + (items.length > 10 ? `\n\n${items.length - 10} more in the app.` : "");
}

export function formatGetMusd(appUrl: string) {
  return `<b>Get test BTC and MUSD</b>\n\n1. Select Mezo Testnet, chain 31611, in your wallet.\n2. Get test BTC from <a href="https://faucet.test.mezo.org/">the Mezo faucet</a> (wallet address and CAPTCHA). The faucet offers BTC/MEZO, not direct MUSD.\n3. Open <a href="https://testnet.mezo.org">the Mezo testnet app</a> and swap test BTC for MUSD, or open a BTC-backed MUSD loan. Borrowing has a minimum debt requirement; review the app terms.\n4. Keep test BTC for transaction gas, then approve and fund an escrow with MUSD.\n\n<a href="${appUrl}/help">Pactora help</a>\nTest tokens only. No real funds, yield or transaction success is promised.`;
}
