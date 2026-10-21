import { NextRequest, NextResponse } from "next/server";
import { sendTelegramMessage } from "@/lib/telegram/bot";
import { z } from "zod";

export const dynamic = "force-dynamic";

const TestNotificationSchema = z.object({
  chatId: z.string().or(z.number()),
  message: z.string().min(1).max(500).optional(),
});

export async function POST(req: NextRequest) {
  // Guard: disable in production unless explicitly authorized
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_TEST_NOTIFICATIONS) {
    return NextResponse.json(
      { error: "Forbidden: Test notifications are disabled in production" },
      { status: 403 }
    );
  }

  try {
    const body = await req.json();
    const result = TestNotificationSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { chatId, message } = result.data;
    const testMessage =
      message ||
      `🧪 <b>Pactora Notification Test</b>\n\n` +
        `This is a test notification confirming your Telegram Bot connection is configured properly.\n` +
        `Network: <b>Mezo Testnet</b>\n` +
        `Time: ${new Date().toISOString()}`;

    const sent = await sendTelegramMessage(chatId, testMessage);

    if (!sent) {
      return NextResponse.json(
        { error: "Failed to send message via Telegram Bot API. Verify bot token and chat ID." },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, message: "Notification delivered" });
  } catch (err) {
    console.error("Test notification error:", err);
    return NextResponse.json({ error: "Failed to process test notification" }, { status: 500 });
  }
}

