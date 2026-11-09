import "server-only";
import { formatUnits, parseUnits } from "viem";
import { and, desc, eq, or } from "drizzle-orm";
import { db } from "@/lib/db";
import { AGREEMENT_VERIFICATION_STATUS, agreementMetadata } from "@/lib/db/schema";
import { getEscrowAddress, readPartyAgreement } from "./server";
import { hashAgreementTerms } from "./terms";
import { CreateAgreementSchema } from "@/lib/validation/schemas";

export async function listVerifiedAgreements(wallet: string) {
  const rows = await db.select().from(agreementMetadata).where(and(
    eq(agreementMetadata.chainVerified, true), eq(agreementMetadata.verificationStatus, AGREEMENT_VERIFICATION_STATUS.verified),
    eq(agreementMetadata.chainId, 31611), eq(agreementMetadata.escrowAddress, getEscrowAddress()),
    or(eq(agreementMetadata.clientAddress, wallet.toLowerCase()), eq(agreementMetadata.providerAddress, wallet.toLowerCase())),
  )).orderBy(desc(agreementMetadata.onChainId)).limit(50);
  const results = await Promise.all(rows.map(async (row) => {
    const chain = await readPartyAgreement(row.onChainId, wallet);
    if (!chain) return null;
    const metadata = CreateAgreementSchema.safeParse({
      onChainId: row.onChainId, title: row.title, description: row.description || "", termsHash: row.termsHash,
      creationTxHash: row.creationTxHash, clientAddress: row.clientAddress, providerAddress: row.providerAddress,
      tokenAddress: row.tokenAddress, totalAmount: row.totalAmount, milestoneDetails: row.milestoneDetails,
    });
    const metadataMatches = metadata.success
      && hashAgreementTerms(metadata.data).toLowerCase() === chain.agreement.termsHash.toLowerCase()
      && metadata.data.clientAddress === chain.agreement.client.toLowerCase()
      && metadata.data.providerAddress === chain.agreement.provider.toLowerCase()
      && metadata.data.tokenAddress === chain.agreement.token.toLowerCase()
      && parseUnits(metadata.data.totalAmount, 18) === chain.agreement.totalAmount
      && metadata.data.milestoneDetails.length === chain.milestones.length
      && !metadata.data.milestoneDetails.some((milestone, index) => parseUnits(milestone.amount, 18) !== chain.milestones[index].amount)
      && !metadata.data.milestoneDetails.some((milestone, index) => BigInt(milestone.deliveryDeadline) !== chain.milestones[index].deliveryDeadline);
    return {
      ...row,
      title: metadataMatches ? row.title : `Escrow Agreement #${row.onChainId}`,
      clientAddress: chain.agreement.client.toLowerCase(),
      providerAddress: chain.agreement.provider.toLowerCase(),
      tokenAddress: chain.agreement.token.toLowerCase(),
      state: chain.agreement.state,
      totalAmount: formatUnits(chain.agreement.totalAmount, 18),
      remainingAmount: formatUnits(chain.agreement.state === 2 ? chain.agreement.totalAmount - chain.agreement.releasedAmount - chain.agreement.refundedAmount : 0n, 18),
      milestoneStates: chain.milestones.map((milestone) => milestone.state),
      metadataMismatch: !metadataMatches,
    };
  }));
  return results.filter((row) => row !== null);
}
