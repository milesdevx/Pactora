import { NextRequest, NextResponse } from "next/server";
import { AgreementListQuerySchema, CreateAgreementSchema } from "@/lib/validation/schemas";
import { db } from "@/lib/db";
import { agreementMetadata } from "@/lib/db/schema";
import { sql } from "drizzle-orm";
import { parseUnits } from "viem";
import { apiError, ApiError, readJson, requireSameOrigin } from "@/lib/security/api";
import { requireSession } from "@/lib/security/session";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { getEscrowAddress, readChainAgreement, readConfirmedReceipt } from "@/lib/chain/server";
import { hashAgreementTerms } from "@/lib/chain/terms";
import { listVerifiedAgreements } from "@/lib/chain/metadata";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { wallet } = AgreementListQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    const session = await requireSession(req);
    if (wallet && wallet !== session.walletAddress) throw new ApiError(403, "Wallet does not match the signed session", "WALLET_MISMATCH");
    return NextResponse.json({ agreements: await listVerifiedAgreements(session.walletAddress) }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    const session = await requireSession(req);
    const data = await readJson(req, CreateAgreementSchema);
    if (session.walletAddress !== data.clientAddress) throw new ApiError(403, "Only the verified client may register terms", "NOT_AGREEMENT_CLIENT");
    await enforceRateLimit(req, "agreements:create", 10, 60, session.walletAddress);
    const [{ agreement, milestones }, confirmed] = await Promise.all([readChainAgreement(data.onChainId), readConfirmedReceipt(data.creationTxHash)]);
    const creation = confirmed.logs.filter((log) => log.eventName === "AgreementCreated").find((log) => log.args.agreementId === BigInt(data.onChainId));
    if (!creation || agreement.client.toLowerCase() !== session.walletAddress || creation.args.client.toLowerCase() !== session.walletAddress) throw new ApiError(403, "Receipt does not prove this wallet created the agreement", "INVALID_AGREEMENT_OWNER");
    if (agreement.provider.toLowerCase() !== data.providerAddress || agreement.token.toLowerCase() !== data.tokenAddress) throw new ApiError(400, "Agreement parties or token differ from the chain", "TERMS_MISMATCH");
    if (agreement.termsHash.toLowerCase() !== data.termsHash || hashAgreementTerms(data) !== data.termsHash) throw new ApiError(400, "Terms content does not match the on-chain hash", "TERMS_MISMATCH");
    const amounts = data.milestoneDetails.map((milestone) => parseUnits(milestone.amount, 18));
    if (parseUnits(data.totalAmount, 18) !== agreement.totalAmount || amounts.reduce((sum, amount) => sum + amount, 0n) !== agreement.totalAmount || amounts.length !== milestones.length || amounts.some((amount, index) => amount !== milestones[index].amount)) {
      throw new ApiError(400, "Milestone amounts differ from the chain", "AMOUNT_MISMATCH");
    }
    if (data.milestoneDetails.some((milestone, index) => BigInt(milestone.deliveryDeadline) !== milestones[index].deliveryDeadline)) throw new ApiError(400, "Delivery deadlines differ from the chain", "DEADLINE_MISMATCH");
    const [inserted] = await db.insert(agreementMetadata).values({ ...data, escrowAddress: getEscrowAddress(), chainVerified: true })
      .onConflictDoNothing({ target: [agreementMetadata.escrowAddress, agreementMetadata.onChainId], where: sql`${agreementMetadata.chainVerified} = true` }).returning();
    if (!inserted) throw new ApiError(409, "Verified agreement terms are already registered and immutable", "TERMS_ALREADY_REGISTERED");
    return NextResponse.json({ success: true, agreement: inserted }, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
