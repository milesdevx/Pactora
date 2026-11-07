import { NextRequest, NextResponse } from "next/server";
import { TelegramLinkRequestSchema } from "@/lib/validation/schemas";
import { generateLinkToken, hashToken } from "@/lib/security/crypto";
import { getTelegramBotLinkUrl } from "@/lib/telegram/bot";
import { db } from "@/lib/db";
import { telegramLinkTokens, telegramLinks } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { ApiError, apiError, readJson, requireSameOrigin } from "@/lib/security/api";
import { requireSession } from "@/lib/security/session";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { EmptyInputSchema } from "@/lib/validation/schemas";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    const session = await requireSession(req);
    const { walletAddress } = await readJson(req, TelegramLinkRequestSchema);
    if (walletAddress !== session.walletAddress) throw new ApiError(403, "Wallet does not match the signed session", "WALLET_MISMATCH");
    await enforceRateLimit(req, "telegram:link", 5, 60, session.walletAddress);
    const rawToken = generateLinkToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

    const botUrl = getTelegramBotLinkUrl(rawToken);
    await db.insert(telegramLinkTokens).values({ tokenHash, userId: session.userId, expiresAt, issuedWithSession: true });

    return NextResponse.json({
      success: true,
      token: rawToken,
      botUrl,
      expiresAt: expiresAt.toISOString(),
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return apiError(error);
  }
}

export async function GET(req: NextRequest) {
  try {
    EmptyInputSchema.parse(Object.fromEntries(req.nextUrl.searchParams));
    const session = await requireSession(req);
    const [link] = await db.select({ telegramUsername: telegramLinks.telegramUsername, notificationsEnabled: telegramLinks.notificationsEnabled, linkedAt: telegramLinks.linkedAt })
      .from(telegramLinks).where(and(eq(telegramLinks.userId, session.userId), eq(telegramLinks.walletVerified, true))).limit(1);
    return NextResponse.json({ linked: Boolean(link), link: link || null, testNotificationsEnabled: process.env.NODE_ENV !== "production" || process.env.ALLOW_TEST_NOTIFICATIONS === "true" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}

export async function DELETE(req: NextRequest) {
  try {
    requireSameOrigin(req);
    await readJson(req, EmptyInputSchema);
    const session = await requireSession(req);
    await enforceRateLimit(req, "telegram:unlink", 5, 60, session.walletAddress);
    await db.transaction(async (tx) => {
      await tx.delete(telegramLinks).where(eq(telegramLinks.userId, session.userId));
      await tx.delete(telegramLinkTokens).where(eq(telegramLinkTokens.userId, session.userId));
    });
    return NextResponse.json({ success: true });
  } catch (error) { return apiError(error); }
}
