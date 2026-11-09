import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { AGREEMENT_VERIFICATION_STATUS, agreementMetadata } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { AgreementIdSchema, CreateAgreementSchema } from "@/lib/validation/schemas";
import { requireSession } from "@/lib/security/session";
import { apiError, ApiError } from "@/lib/security/api";
import { getEscrowAddress, readPartyAgreement } from "@/lib/chain/server";
import { hashAgreementTerms } from "@/lib/chain/terms";
import { parseUnits } from "viem";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const numericId = AgreementIdSchema.parse(id);
    const session = await requireSession(req);
    const chain = await readPartyAgreement(numericId, session.walletAddress);
    if (!chain) throw new ApiError(404, "Agreement not found for this wallet", "AGREEMENT_NOT_FOUND");

    const metadata = (
      await db
        .select()
        .from(agreementMetadata)
        .where(and(eq(agreementMetadata.onChainId, numericId), eq(agreementMetadata.chainId, 31611), eq(agreementMetadata.escrowAddress, getEscrowAddress()), eq(agreementMetadata.chainVerified, true), eq(agreementMetadata.verificationStatus, AGREEMENT_VERIFICATION_STATUS.verified)))
        .limit(1)
    )[0];

    if (!metadata) {
      throw new ApiError(404, "Verified off-chain terms are not available", "METADATA_NOT_FOUND");
    }
    const terms = CreateAgreementSchema.safeParse({ onChainId: metadata.onChainId, title: metadata.title, description: metadata.description || "", termsHash: metadata.termsHash, creationTxHash: metadata.creationTxHash, clientAddress: metadata.clientAddress, providerAddress: metadata.providerAddress, tokenAddress: metadata.tokenAddress, totalAmount: metadata.totalAmount, milestoneDetails: metadata.milestoneDetails });
    if (!terms.success || hashAgreementTerms(terms.data) !== chain.agreement.termsHash.toLowerCase()) throw new ApiError(404, "Off-chain terms failed their chain commitment", "METADATA_NOT_VERIFIED");
    if (terms.data.clientAddress !== chain.agreement.client.toLowerCase() || terms.data.providerAddress !== chain.agreement.provider.toLowerCase()
      || terms.data.tokenAddress !== chain.agreement.token.toLowerCase() || parseUnits(terms.data.totalAmount, 18) !== chain.agreement.totalAmount) {
      throw new ApiError(404, "Off-chain parties, token, or total differ from the contract", "METADATA_NOT_VERIFIED");
    }
    if (terms.data.milestoneDetails.length !== chain.milestones.length
      || terms.data.milestoneDetails.some((milestone, index) => parseUnits(milestone.amount, 18) !== chain.milestones[index].amount)
      || terms.data.milestoneDetails.some((milestone, index) => BigInt(milestone.deliveryDeadline) !== chain.milestones[index].deliveryDeadline)) {
      throw new ApiError(404, "Off-chain milestones differ from the contract", "METADATA_NOT_VERIFIED");
    }
    return NextResponse.json({ agreement: metadata }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
