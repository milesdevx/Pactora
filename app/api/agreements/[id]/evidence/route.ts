import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { keccak256, stringToBytes } from "viem";
import { db } from "@/lib/db";
import { milestoneEvidence } from "@/lib/db/schema";
import { ApiError, apiError, readJson, requireSameOrigin } from "@/lib/security/api";
import { requireSession } from "@/lib/security/session";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { AgreementIdSchema, EmptyInputSchema, MilestoneEvidenceSchema } from "@/lib/validation/schemas";
import { getEscrowAddress, mezoPublicClient, readConfirmedReceipt, readPartyAgreement } from "@/lib/chain/server";

export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };

export async function GET(req: NextRequest, context: Context) {
  try {
    EmptyInputSchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    const id = AgreementIdSchema.parse((await context.params).id);
    const session = await requireSession(req);
    if (!await readPartyAgreement(id, session.walletAddress)) throw new ApiError(404, "Agreement not found for this wallet", "AGREEMENT_NOT_FOUND");
    const evidence = await db.select().from(milestoneEvidence).where(and(eq(milestoneEvidence.escrowAddress, getEscrowAddress()), eq(milestoneEvidence.agreementId, id))).orderBy(desc(milestoneEvidence.confirmedAt)).limit(100);
    return NextResponse.json({ evidence }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

export async function POST(req: NextRequest, context: Context) {
  try {
    requireSameOrigin(req);
    const id = AgreementIdSchema.parse((await context.params).id);
    const session = await requireSession(req);
    const data = await readJson(req, MilestoneEvidenceSchema);
    await enforceRateLimit(req, "agreements:evidence", 20, 60, session.walletAddress);
    const chain = await readPartyAgreement(id, session.walletAddress);
    if (!chain) throw new ApiError(404, "Agreement not found for this wallet", "AGREEMENT_NOT_FOUND");
    const expectedAuthor = data.kind === "submission" ? chain.agreement.provider : chain.agreement.client;
    if (expectedAuthor.toLowerCase() !== session.walletAddress) throw new ApiError(403, "This wallet did not author the evidence event", "INVALID_EVIDENCE_AUTHOR");
    const confirmed = await readConfirmedReceipt(data.txHash);
    const contentHash = keccak256(stringToBytes(data.text));
    const event = confirmed.logs.find((log) => (log.eventName === "MilestoneSubmitted" || log.eventName === "MilestoneRejected") && log.args.agreementId === BigInt(id) && log.args.milestoneIndex === BigInt(data.milestoneIndex));
    const matches = data.kind === "submission" ? event?.eventName === "MilestoneSubmitted" && event.args.submissionHash === contentHash : event?.eventName === "MilestoneRejected" && event.args.reasonHash === contentHash;
    if (!matches || !event) throw new ApiError(400, "Evidence text does not match the confirmed on-chain event", "EVIDENCE_HASH_MISMATCH");
    const block = await mezoPublicClient.getBlock({ blockNumber: confirmed.receipt.blockNumber });
    const [stored] = await db.insert(milestoneEvidence).values({ escrowAddress: getEscrowAddress(), agreementId: id, milestoneIndex: data.milestoneIndex, kind: data.kind, text: data.text, contentHash, txHash: data.txHash, logIndex: event.logIndex, blockNumber: confirmed.receipt.blockNumber.toString(), confirmedAt: new Date(Number(block.timestamp) * 1000) })
      .onConflictDoNothing({ target: [milestoneEvidence.escrowAddress, milestoneEvidence.txHash, milestoneEvidence.logIndex] }).returning();
    return NextResponse.json({ verified: true, stored: Boolean(stored) }, { status: stored ? 201 : 200 });
  } catch (error) { return apiError(error); }
}
