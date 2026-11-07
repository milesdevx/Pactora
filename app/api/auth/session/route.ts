import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/security/session";
import { apiError } from "@/lib/security/api";
import { EmptyInputSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    EmptyInputSchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    const session = await requireSession(req);
    return NextResponse.json({ authenticated: true, walletAddress: session.walletAddress, expiresAt: session.expiresAt.toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
