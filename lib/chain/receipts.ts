import "server-only";
import { formatUnits, parseEventLogs } from "viem";
import { ApiError } from "@/lib/security/api";
import { PACTORA_ESCROW_ABI } from "./abi/PactoraEscrow";
import { LEGACY_ESCROW_ABI, LEGACY_ESCROW_ADDRESS } from "./abi/LegacyPactoraEscrow";
import { getEscrowAddress, mezoPublicClient, readTokenDetails, requireTestnet } from "./server";

export async function readEscrowAgreement(id: number, address = getEscrowAddress()) {
  await requireTestnet();
  const abi = address === LEGACY_ESCROW_ADDRESS ? LEGACY_ESCROW_ABI : PACTORA_ESCROW_ABI;
  const blockNumber = await mezoPublicClient.getBlockNumber({ cacheTime: 0 });
  const count = await mezoPublicClient.readContract({ address, abi, functionName: "getAgreementCount", blockNumber });
  if (BigInt(id) > count) throw new ApiError(404, "Agreement does not exist on Mezo Testnet", "AGREEMENT_NOT_FOUND");
  const [agreement, milestones] = await Promise.all([
    mezoPublicClient.readContract({ address, abi, functionName: "getAgreement", args: [BigInt(id)], blockNumber }),
    mezoPublicClient.readContract({ address, abi, functionName: "getMilestones", args: [BigInt(id)], blockNumber }),
  ]);
  return { agreement, milestones, blockNumber, count, address, legacy: address === LEGACY_ESCROW_ADDRESS };
}

async function blockAt(timestamp: bigint, head: bigint): Promise<bigint> {
  let low = 0n;
  let high = head;
  while (low < high) {
    const middle = (low + high) / 2n;
    const block = await mezoPublicClient.getBlock({ blockNumber: middle });
    if (block.timestamp < timestamp) low = middle + 1n;
    else high = middle;
  }
  return low;
}

export async function readPublicReceipt(id: number, address = getEscrowAddress()) {
  const snapshot = await readEscrowAgreement(id, address);
  const { agreement, milestones, blockNumber, legacy } = snapshot;
  const token = await readTokenDetails(agreement.token);
  const first = await blockAt(agreement.createdAt, blockNumber);
  const complete = blockNumber - first < 100_000n;
  const ranges: [bigint, bigint][] = [];
  const scanStart = complete ? first : blockNumber - 99_999n;
  for (let start = scanStart; start <= blockNumber; start += 10_000n) ranges.push([start, start + 9999n < blockNumber ? start + 9999n : blockNumber]);
  if (!complete) ranges.push([first, first + 10n]);
  if (!complete && agreement.completedAt > 0n) { const end = await blockAt(agreement.completedAt, blockNumber); ranges.push([end, end + 10n < blockNumber ? end + 10n : blockNumber]); }
  const logs = (await Promise.all(ranges.map(([fromBlock, toBlock]) => mezoPublicClient.getLogs({ address, fromBlock, toBlock })))).flat();
  const parsed = parseEventLogs({ abi: legacy ? LEGACY_ESCROW_ABI : PACTORA_ESCROW_ABI, logs, strict: true });
  const seen = new Set<string>();
  const transactions = parsed.filter((log) => "agreementId" in log.args && log.args.agreementId === BigInt(id) && log.transactionHash && !seen.has(`${log.transactionHash}:${log.logIndex}`) && Boolean(seen.add(`${log.transactionHash}:${log.logIndex}`)))
    .map((log) => ({ hash: log.transactionHash!, event: log.eventName, blockNumber: log.blockNumber!.toString() }));
  const states = ["Created", "Accepted", "Funded", "Completed", "Cancelled"];
  const milestoneStates = ["Pending", "Submitted", "Approved", "Rejected", "Refunded"];
  const funded = agreement.fundedAt > 0n;
  return {
    chainId: 31611, escrow: address, legacy, historyComplete: complete, blockNumber: blockNumber.toString(),
    agreement: { id, client: agreement.client, provider: agreement.provider, token: agreement.token, symbol: token.symbol, decimals: token.decimals,
      state: states[agreement.state], termsHash: agreement.termsHash, totalAmount: formatUnits(agreement.totalAmount, token.decimals),
      fundedAmount: formatUnits(funded ? agreement.totalAmount : 0n, token.decimals), releasedAmount: formatUnits(agreement.releasedAmount, token.decimals), refundedAmount: formatUnits(agreement.refundedAmount, token.decimals),
      remainingAmount: formatUnits(funded ? agreement.totalAmount - agreement.releasedAmount - agreement.refundedAmount : 0n, token.decimals),
      createdAt: agreement.createdAt.toString(), fundedAt: agreement.fundedAt.toString(), completedAt: agreement.completedAt.toString() },
    milestones: milestones.map((milestone, index) => ({ index, amount: formatUnits(milestone.amount, token.decimals), state: milestoneStates[milestone.state], submissionHash: milestone.submissionHash })), transactions,
  };
}
