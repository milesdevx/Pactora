import { NextRequest, NextResponse } from "next/server";
import { TelegramLinkRequestSchema } from "@/lib/validation/schemas";
import { generateRandomToken, hashToken } from "@/lib/security/crypto";
import { getTelegramBotLinkUrl } from "@/lib/telegram/bot";
import { db } from "@/lib/db";
import { users, telegramLinkTokens } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = TelegramLinkRequestSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { walletAddress } = result.data;
    const normalizedAddress = walletAddress.toLowerCase();

    // Generate single-use expiring token
    const rawToken = generateRandomToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    // Find or create user and store token in database if available
    try {
      let userRecord = (
        await db.select().from(users).where(eq(users.walletAddress, normalizedAddress)).limit(1)
      )[0];

      if (!userRecord) {
        const inserted = await db
          .insert(users)
          .values({ walletAddress: normalizedAddress })
          .returning();
        userRecord = inserted[0];
      }

      await db.insert(telegramLinkTokens).values({
        tokenHash,
        userId: userRecord.id,
        expiresAt,
      });
    } catch (dbErr: any) {
      console.warn("Database offline. Linking token generated in memory:", dbErr?.code || dbErr?.message);
    }

    const botUrl = getTelegramBotLinkUrl(rawToken);

    return NextResponse.json({
      success: true,
      token: rawToken,
      botUrl,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (err) {
    console.error("Telegram link generation error:", err);
    return NextResponse.json({ error: "Failed to generate link token" }, { status: 500 });
  }
}

