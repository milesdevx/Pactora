import { NextResponse } from "next/server";
import { checkEscrowConfiguration } from "@/lib/chain/server";
import { apiError } from "@/lib/security/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const escrow = await checkEscrowConfiguration();
    return NextResponse.json({
      status: "ok",
      app: "Pactora",
      network: "Mezo Testnet",
      chainId: 31611,
      escrow: { address: escrow.address, version: Number(escrow.version), agreementCount: escrow.agreementCount.toString(), defaultToken: escrow.defaultToken, allowlistEnforced: escrow.enforceTokenAllowlist },
      timestamp: new Date().toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
