import { NextResponse } from "next/server";
import { checkEscrowDeployment } from "@/lib/chain/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const escrowCheck = await checkEscrowDeployment();
  const status = escrowCheck.ok ? "ok" : "degraded";
  return NextResponse.json({
    status,
    app: "Pactora",
    descriptor: "MUSD escrow for milestone payments",
    network: "Mezo Testnet",
    chainId: 31611,
    escrow: escrowCheck,
    timestamp: new Date().toISOString(),
  }, { status: escrowCheck.ok ? 200 : 503 });
}

