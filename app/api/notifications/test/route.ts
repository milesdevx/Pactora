import { NextRequest, NextResponse } from "next/server";
import { sendTelegramMessage } from "@/lib/telegram/bot";
import { TestNotificationSchema } from "@/lib/validation/schemas";
import { ApiError, apiError, readJson, requireSameOrigin } from "@/lib/security/api";
import { requireSession } from "@/lib/security/session";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { db } from "@/lib/db";
import { telegramLinks } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { escapeHtml } from "@/lib/telegram/bot";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  // Guard: disable in production unless explicitly authorized
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_TEST_NOTIFICATIONS !== "true") {
    return NextResponse.json(
      { error: "Forbidden: Test notifications are disabled in production" },
      { status: 403 }
    );
  }

  try {
    requireSameOrigin(req);
    const session = await requireSession(req);
    const { message } = await readJson(req, TestNotificationSchema);
    await enforceRateLimit(req, "notifications:test", 3, 60, session.walletAddress);
    const [link] = await db.select().from(telegramLinks).where(and(eq(telegramLinks.userId, session.userId), eq(telegramLinks.walletVerified, true))).limit(1);
    if (!link || !link.notificationsEnabled) throw new ApiError(409, "Link Telegram and enable notifications first", "TELEGRAM_NOT_LINKED");
    const testMessage =
      (message ? `<b>Test notification, not a chain event</b>\n\n${escapeHtml(message)}` :
      `<b>Pactora Test Notification, not a chain event</b>\n\n` +
        `This is a test notification confirming your Telegram Bot connection is configured properly.\n` +
        `Network: <b>Mezo Testnet</b>\n` +
        `Time: ${new Date().toISOString()}`);

    const sent = await sendTelegramMessage(link.telegramChatId, testMessage);

    if (!sent) {
      return NextResponse.json(
        { error: "Failed to send message via Telegram Bot API. Verify bot token and chat ID." },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, message: "Notification delivered" });
  } catch (error) {
    return apiError(error);
  }
}
