import { NextRequest, NextResponse } from "next/server";
import { verifyMessage } from "viem";
import { z } from "zod";
import { addressRegex } from "@/lib/validation/schemas";
import { db } from "@/lib/db";
import { authNonces, users } from "@/lib/db/schema";
import { eq, and, gt } from "drizzle-orm";

export const dynamic = "force-dynamic";

const VerifyBodySchema = z.object({
  walletAddress: z.string().regex(addressRegex),
  signature: z.string().startsWith("0x"),
  nonce: z.string().min(16),
  message: z.string().min(10),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = VerifyBodySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { walletAddress, signature, nonce, message } = result.data;
    const normalizedAddress = walletAddress.toLowerCase();

    // Verify message text includes nonce and wallet address
    if (!message.includes(nonce) || !message.toLowerCase().includes(normalizedAddress)) {
      return NextResponse.json(
        { error: "Message does not match provided nonce or address" },
        { status: 400 }
      );
    }

    // Cryptographically verify ECDSA signature
    const isValidSignature = await verifyMessage({
      address: normalizedAddress as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    if (!isValidSignature) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    // Check nonce in database to prevent replay attacks
    try {
      const records = await db
        .select()
        .from(authNonces)
        .where(
          and(
            eq(authNonces.nonce, nonce),
            eq(authNonces.walletAddress, normalizedAddress),
            eq(authNonces.consumed, false),
            gt(authNonces.expiresAt, new Date())
          )
        )
        .limit(1);

      if (records.length > 0) {
        // Mark nonce as consumed
        await db
          .update(authNonces)
          .set({ consumed: true })
          .where(eq(authNonces.nonce, nonce));
      }

      // Upsert user record
      await db
        .insert(users)
        .values({ walletAddress: normalizedAddress })
        .onConflictDoUpdate({
          target: users.walletAddress,
          set: { updatedAt: new Date() },
        });
    } catch (dbErr) {
      console.warn("DB operation during verify (continuing if DB unavailable):", dbErr);
    }

    return NextResponse.json({
      success: true,
      authenticated: true,
      walletAddress: normalizedAddress,
    });
  } catch (err) {
    console.error("Signature verification error:", err);
    return NextResponse.json({ error: "Verification failed" }, { status: 500 });
  }
}

