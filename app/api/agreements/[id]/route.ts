import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { agreementMetadata } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const numericId = parseInt(id, 10);

    if (isNaN(numericId)) {
      return NextResponse.json({ error: "Invalid agreement ID" }, { status: 400 });
    }

    const metadata = (
      await db
        .select()
        .from(agreementMetadata)
        .where(eq(agreementMetadata.onChainId, numericId))
        .limit(1)
    )[0];

    if (!metadata) {
      return NextResponse.json({ agreement: null, message: "Metadata not found" }, { status: 404 });
    }

    return NextResponse.json({ agreement: metadata });
  } catch (err: any) {
    console.warn("Database offline. Falling back to on-chain agreement state:", err?.code || err?.message);
    return NextResponse.json(
      { agreement: null, warning: "Database unavailable, using on-chain contract data" },
      { status: 404 }
    );
  }
}

