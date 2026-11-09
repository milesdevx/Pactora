import "server-only";
import { eq, and, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { AGREEMENT_VERIFICATION_STATUS, agreementMetadata } from "@/lib/db/schema";
import { getEscrowAddress, mezoPublicClient, requireTestnet } from "@/lib/chain/server";
import { PACTORA_ESCROW_ABI } from "@/lib/chain/abi/PactoraEscrow";
import { LEGACY_ESCROW_ABI, LEGACY_ESCROW_ADDRESS } from "@/lib/chain/abi/LegacyPactoraEscrow";
import { CONTRACT_ADDRESSES } from "@/lib/chain/mezo";
import { ERC20_ABI } from "@/lib/chain/abi/IERC20";
import { isAgreementMissing } from "@/lib/chain/agreements";
import { type BotAgreement } from "./formatters";

export async function readWalletBalance(wallet: `0x${string}`) {
  await requireTestnet();
  const blockNumber = await mezoPublicClient.getBlockNumber({ cacheTime: 0 });
  const [musd, btc] = await Promise.all([
    mezoPublicClient.readContract({ address: CONTRACT_ADDRESSES.MUSD, abi: ERC20_ABI, functionName: "balanceOf", args: [wallet], blockNumber }),
    mezoPublicClient.getBalance({ address: wallet, blockNumber }),
  ]);
  return { musd, btc, blockNumber };
}

export async function readWalletAgreements(wallet: `0x${string}`) {
  const address = getEscrowAddress();
  await requireTestnet();
  const legacy = address === LEGACY_ESCROW_ADDRESS;
  const abi = legacy ? LEGACY_ESCROW_ABI : PACTORA_ESCROW_ABI;
  const blockNumber = await mezoPublicClient.getBlockNumber({ cacheTime: 0 });
  const [count, block, metadata] = await Promise.all([
    mezoPublicClient.readContract({ address, abi, functionName: "getAgreementCount", blockNumber }),
    mezoPublicClient.getBlock({ blockNumber }),
    db.select({ id: agreementMetadata.onChainId, creationTxHash: agreementMetadata.creationTxHash }).from(agreementMetadata).where(and(eq(agreementMetadata.chainVerified, true), eq(agreementMetadata.verificationStatus, AGREEMENT_VERIFICATION_STATUS.verified), eq(agreementMetadata.chainId, 31611), eq(agreementMetadata.escrowAddress, address), or(eq(agreementMetadata.clientAddress, wallet), eq(agreementMetadata.providerAddress, wallet)))).limit(50),
  ]);
  const candidates = new Set(metadata.map((record) => record.id));
  for (let id = 1; id <= Number(count < 50n ? count : 50n); id++) candidates.add(id);
  const agreements: BotAgreement[] = [];
  for (const id of [...candidates].sort((left, right) => right - left)) {
    if (!Number.isSafeInteger(id) || id < 1 || BigInt(id) > count) continue;
    const agreement = await mezoPublicClient.readContract({ address, abi, functionName: "getAgreement", args: [BigInt(id)], blockNumber });
    if (isAgreementMissing(agreement, BigInt(id))) continue;
    if (![agreement.client.toLowerCase(), agreement.provider.toLowerCase()].includes(wallet)) continue;
    const milestones = await mezoPublicClient.readContract({ address, abi, functionName: "getMilestones", args: [BigInt(id)], blockNumber });
    agreements.push({ id, state: agreement.state, client: agreement.client, provider: agreement.provider, token: agreement.token, total: agreement.totalAmount, remaining: agreement.fundedAt > 0n ? agreement.totalAmount - agreement.releasedAmount - agreement.refundedAmount : 0n, legacy, now: block.timestamp,
      creationTxHash: metadata.find((record) => record.id === id)?.creationTxHash || undefined,
      milestones: milestones.map((milestone, index) => ({ index, state: milestone.state, amount: milestone.amount, ...("deliveryDeadline" in milestone ? { deliveryDeadline: milestone.deliveryDeadline, submittedAt: milestone.submittedAt, rejectedAt: milestone.rejectedAt } : {}) })),
    });
  }
  return { agreements, complete: count <= 50n };
}
