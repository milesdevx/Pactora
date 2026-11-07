import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { walletSessions } from "@/lib/db/schema";
import { apiError, readJson, requireSameOrigin } from "@/lib/security/api";
import { sessionToken, setSessionCookie } from "@/lib/security/session";
import { hashToken } from "@/lib/security/crypto";
import { EmptyInputSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    await readJson(req, EmptyInputSchema);
    const token = sessionToken(req);
    if (token) await db.delete(walletSessions).where(eq(walletSessions.tokenHash, hashToken(token)));
    return setSessionCookie(NextResponse.json({ success: true }), "", 0);
  } catch (error) { return apiError(error); }
}
