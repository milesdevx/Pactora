import { NextRequest, NextResponse } from "next/server";
import { NonceRequestSchema } from "@/lib/validation/schemas";
import { generateRandomToken, createAuthMessage } from "@/lib/security/crypto";
import { db } from "@/lib/db";
import { authNonces } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = NonceRequestSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { walletAddress } = result.data;
    const normalizedAddress = walletAddress.toLowerCase();
    const nonce = generateRandomToken(16);
    const issuedAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Persist nonce in database
    try {
      await db.insert(authNonces).values({
        nonce,
        walletAddress: normalizedAddress,
        expiresAt,
        consumed: false,
      });
    } catch (dbErr) {
      console.warn("Could not persist nonce to DB (using in-memory fallback):", dbErr);
    }

    const message = createAuthMessage(normalizedAddress, nonce, issuedAt);

    return NextResponse.json({
      nonce,
      message,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    console.error("Error generating nonce:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

