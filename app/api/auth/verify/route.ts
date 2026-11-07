import { NextRequest, NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { VerifySignatureSchema } from "@/lib/validation/schemas";
import { db } from "@/lib/db";
import { authNonces, users, walletSessions } from "@/lib/db/schema";
import { eq, and, gt, sql } from "drizzle-orm";
import { ApiError, apiError, readJson, requireSameOrigin } from "@/lib/security/api";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { generateRandomToken, hashToken } from "@/lib/security/crypto";
import { SESSION_SECONDS, setSessionCookie } from "@/lib/security/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const origin = requireSameOrigin(req);
    const { walletAddress, signature, nonce, message } = await readJson(req, VerifySignatureSchema);
    await enforceRateLimit(req, "auth:verify", 20);
    if (!message.split("\n").includes(`Origin: ${origin}`) || !message.split("\n").includes("Chain ID: 31611")) {
      throw new ApiError(401, "Authentication message does not match this application", "INVALID_SIGNATURE");
    }
    let valid = false;
    try { valid = await verifyMessage({ address: walletAddress, message, signature: signature as `0x${string}` }); } catch { /* Invalid signatures are rejected. */ }
    if (!valid) throw new ApiError(401, "Invalid wallet signature", "INVALID_SIGNATURE");
    const token = generateRandomToken(32);
    await db.transaction(async (tx) => {
      const consumed = await tx.update(authNonces).set({ consumed: true }).where(and(
        eq(authNonces.nonce, nonce), eq(authNonces.walletAddress, walletAddress), eq(authNonces.message, message),
        eq(authNonces.consumed, false), gt(authNonces.expiresAt, sql`now()`),
      )).returning({ id: authNonces.id });
      if (consumed.length !== 1) throw new ApiError(401, "Nonce expired, reused, or unknown", "INVALID_NONCE");
      const [user] = await tx.insert(users).values({ walletAddress }).onConflictDoUpdate({
        target: users.walletAddress, set: { updatedAt: new Date() },
      }).returning();
      if (!user) throw new ApiError(503, "Wallet session could not be created", "SERVICE_UNAVAILABLE");
      await tx.insert(walletSessions).values({ tokenHash: hashToken(token), userId: user.id, expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000) });
    });
    return setSessionCookie(NextResponse.json({ success: true, authenticated: true, walletAddress }), token);
  } catch (error) {
    return apiError(error);
  }
}
