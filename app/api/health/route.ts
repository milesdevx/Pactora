import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    app: "Pactora",
    descriptor: "MUSD escrow for milestone payments",
    network: "Mezo Testnet",
    chainId: 31611,
    timestamp: new Date().toISOString(),
  });
}

