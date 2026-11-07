import { timingSafeEqual } from "node:crypto";
import { after, NextRequest, NextResponse } from "next/server";
import { TelegramWebhookUpdateSchema } from "@/lib/validation/schemas";
import { hashToken } from "@/lib/security/crypto";
import { ApiError, apiError, readJson } from "@/lib/security/api";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { db } from "@/lib/db";
import { webhookEvents } from "@/lib/db/schema";
import { processQueuedUpdate } from "@/lib/telegram/webhook";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    const configured = process.env.TELEGRAM_WEBHOOK_SECRET;
    if (!configured || configured.length < 32) throw new ApiError(503, "Webhook is not configured", "CONFIGURATION_REQUIRED");
    const received = Buffer.from(req.headers.get("x-telegram-bot-api-secret-token") || "");
    const expected = Buffer.from(configured);
    if (received.length !== expected.length || !timingSafeEqual(received, expected)) throw new ApiError(401, "Unauthorized webhook", "UNAUTHORIZED_WEBHOOK");
    const update = await readJson(req, TelegramWebhookUpdateSchema);
    const message = update.message;
    const privateMessage = message?.chat.type === "private" && message.from?.id === message.chat.id && !message.from.is_bot;
    const [rawCommand = "", argument] = message?.text?.trim().split(/\s+/) || [];
    const parsedCommand = rawCommand.split("@")[0].toLowerCase();
    const command = ["/start", "/help", "/balance", "/agreements", "/pending", "/getmusd", "/notifications", "/unlink"].includes(parsedCommand) ? parsedCommand : "/help";
    const token = command === "/start" && argument?.startsWith("link_") ? argument.slice(5) : undefined;
    if (privateMessage) await enforceRateLimit(req, "telegram:webhook", 60, 60, String(message.chat.id));
    // Raw Telegram payloads and bearer link tokens are never persisted or logged.
    const payload = privateMessage ? {
      chatId: String(message.chat.id), command, username: message.from?.username,
      ...(token && /^[A-Za-z0-9_-]{43}$/.test(token) ? { tokenHash: hashToken(token) } : {}),
      hasArgument: Boolean(argument),
    } : {};
    const [inserted] = await db.insert(webhookEvents).values({
      updateId: String(update.update_id), eventType: privateMessage ? "command" : "ignored", payload,
      status: privateMessage ? "pending" : "processed",
    }).onConflictDoNothing({ target: webhookEvents.updateId }).returning({ id: webhookEvents.id });
    if (!inserted) return NextResponse.json({ ok: true, deduplicated: true });
    if (privateMessage) after(() => processQueuedUpdate(inserted.id));
    return NextResponse.json({ ok: true });
  } catch (error) { return apiError(error); }
}
