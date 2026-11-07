import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { AgreementIdSchema, WalletAddressSchema } from "@/lib/validation/schemas";
import { apiError, ApiError } from "@/lib/security/api";
import { getEscrowAddress } from "@/lib/chain/server";
import { LEGACY_ESCROW_ADDRESS } from "@/lib/chain/abi/LegacyPactoraEscrow";
import { readPublicReceipt } from "@/lib/chain/receipts";

export const dynamic = "force-dynamic";
const Query = z.object({ escrow: WalletAddressSchema.optional() }).strict();

export async function GET(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const id = AgreementIdSchema.parse((await context.params).id);
    const { escrow = getEscrowAddress() } = Query.parse(Object.fromEntries(req.nextUrl.searchParams));
    if (escrow !== getEscrowAddress() && escrow !== LEGACY_ESCROW_ADDRESS) throw new ApiError(400, "Unsupported Pactora escrow address", "UNSUPPORTED_ESCROW");
    return NextResponse.json(await readPublicReceipt(id, escrow), { headers: { "Cache-Control": "public, max-age=15, s-maxage=15" } });
  } catch (error) { return apiError(error); }
}
