import { NextRequest, NextResponse } from "next/server";
import { NonceRequestSchema } from "@/lib/validation/schemas";
import { generateRandomToken, createAuthMessage } from "@/lib/security/crypto";
import { db } from "@/lib/db";
import { authNonces } from "@/lib/db/schema";
import { apiError, readJson, requireSameOrigin } from "@/lib/security/api";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const origin = requireSameOrigin(req);
    const { walletAddress } = await readJson(req, NonceRequestSchema);
    await enforceRateLimit(req, "auth:nonce", 10);
    const nonce = generateRandomToken(32);
    const issuedAt = new Date();
    const expiresAt = new Date(issuedAt.getTime() + 5 * 60 * 1000);
    const message = createAuthMessage(walletAddress, nonce, issuedAt.toISOString(), origin, expiresAt.toISOString());
    await db.insert(authNonces).values({ nonce, walletAddress, message, expiresAt, consumed: false, createdAt: issuedAt });

    return NextResponse.json({
      nonce,
      message,
      expiresAt: expiresAt.toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}
