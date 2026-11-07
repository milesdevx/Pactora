import { createPublicClient, http, isAddress } from "viem";
import { PACTORA_ESCROW_ABI } from "../lib/chain/abi/PactoraEscrow.ts";
import { ERC20_ABI } from "../lib/chain/abi/IERC20.ts";
import { LEGACY_ESCROW_ABI, LEGACY_ESCROW_ADDRESS } from "../lib/chain/abi/LegacyPactoraEscrow.ts";
import { formatAgreements, formatBalance, formatGetMusd, formatPending } from "../lib/telegram/formatters.ts";

const [wallet, appUrl] = process.argv.slice(2);
const escrow = process.env.NEXT_PUBLIC_PACTORA_ESCROW_ADDRESS?.toLowerCase();
if (!isAddress(wallet || "") || !isAddress(escrow || "") || !appUrl) throw new Error("Provide a public wallet and app URL; configure the actual escrow address.");
const client = createPublicClient({ transport: http("https://rpc.test.mezo.org", { timeout: 12_000, retryCount: 0 }) });
if (await client.getChainId() !== 31611) throw new Error("Refusing a non-Mezo-Testnet RPC.");
const blockNumber = await client.getBlockNumber();
const [musd, btc, block] = await Promise.all([
  client.readContract({ address: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503", abi: ERC20_ABI, functionName: "balanceOf", args: [wallet], blockNumber }),
  client.getBalance({ address: wallet, blockNumber }), client.getBlock({ blockNumber }),
]);
const legacy = escrow === LEGACY_ESCROW_ADDRESS;
const abi = legacy ? LEGACY_ESCROW_ABI : PACTORA_ESCROW_ABI;
const count = await client.readContract({ address: escrow, abi, functionName: "getAgreementCount", blockNumber });
const agreements = [];
for (let id = 1; id <= Number(count < 50n ? count : 50n); id++) {
  const agreement = await client.readContract({ address: escrow, abi, functionName: "getAgreement", args: [BigInt(id)], blockNumber });
  if (![agreement.client.toLowerCase(), agreement.provider.toLowerCase()].includes(wallet.toLowerCase())) continue;
  const milestones = await client.readContract({ address: escrow, abi, functionName: "getMilestones", args: [BigInt(id)], blockNumber });
  agreements.push({ id, state: agreement.state, client: agreement.client, provider: agreement.provider, token: agreement.token, total: agreement.totalAmount, remaining: agreement.fundedAt > 0n ? agreement.totalAmount - agreement.releasedAmount - agreement.refundedAmount : 0n, legacy, now: block.timestamp, milestones: milestones.map((milestone, index) => ({ index, state: milestone.state, amount: milestone.amount, ...("deliveryDeadline" in milestone ? { deliveryDeadline: milestone.deliveryDeadline, submittedAt: milestone.submittedAt, rejectedAt: milestone.rejectedAt } : {}) })) });
}
console.log("Real Mezo Testnet RPC + formatter check. Not Telegram delivery, linking, or a live-money demo.");
for (const [command, text] of [["/balance", formatBalance(wallet.toLowerCase(), musd, btc, blockNumber, appUrl)], ["/agreements", formatAgreements(agreements, wallet, appUrl, count <= 50n)], ["/pending", formatPending(agreements, wallet, appUrl, count <= 50n)], ["/getmusd", formatGetMusd(appUrl)]]) console.log(`${command}\n${text}\n`);
