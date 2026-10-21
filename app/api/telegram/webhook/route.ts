import { NextRequest, NextResponse } from "next/server";
import { TelegramWebhookUpdateSchema } from "@/lib/validation/schemas";
import { hashToken } from "@/lib/security/crypto";
import { sendTelegramMessage } from "@/lib/telegram/bot";
import { db } from "@/lib/db";
import {
  webhookEvents,
  telegramLinkTokens,
  telegramLinks,
  users,
  agreementMetadata,
} from "@/lib/db/schema";
import { eq, and, gt, or } from "drizzle-orm";

export const dynamic = "force-dynamic";

const WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  // 1. Verify Telegram secret token header if configured
  if (WEBHOOK_SECRET) {
    const secretHeader = req.headers.get("x-telegram-bot-api-secret-token");
    if (secretHeader !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: "Unauthorized: Invalid webhook secret" }, { status: 401 });
    }
  }

  try {
    const rawBody = await req.json();
    const parseResult = TelegramWebhookUpdateSchema.safeParse(rawBody);

    if (!parseResult.success) {
      // Return 200 to acknowledge malformed telegram payload and avoid retry loops
      return NextResponse.json({ ok: true, ignored: "Invalid payload format" });
    }

    const { update_id, message } = parseResult.data;

    // 2. Idempotent deduplication check
    const existing = await db
      .select({ id: webhookEvents.id })
      .from(webhookEvents)
      .where(eq(webhookEvents.updateId, update_id.toString()))
      .limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ ok: true, deduplicated: true });
    }

    // Record webhook event
    await db.insert(webhookEvents).values({
      updateId: update_id.toString(),
      eventType: message?.text ? "message" : "other",
      payload: rawBody,
    });

    if (!message || !message.text) {
      return NextResponse.json({ ok: true });
    }

    const chatId = message.chat.id;
    const username = message.from?.username || message.chat.username;
    const text = message.text.trim();

    // 3. Process commands
    if (text.startsWith("/start")) {
      const parts = text.split(/\s+/);
      const linkToken = parts[1];

      if (linkToken) {
        // Handle account linking with token
        const tokenHash = hashToken(linkToken);

        const tokenRecord = (
          await db
            .select()
            .from(telegramLinkTokens)
            .where(
              and(
                eq(telegramLinkTokens.tokenHash, tokenHash),
                gt(telegramLinkTokens.expiresAt, new Date())
              )
            )
            .limit(1)
        )[0];

        if (!tokenRecord || tokenRecord.consumedAt) {
          await sendTelegramMessage(
            chatId,
            `⚠️ <b>Invalid or Expired Link Token</b>\n\n` +
              `This link token is either expired, already used, or invalid.\n` +
              `Please generate a fresh link token in the Pactora application settings.`
          );
        } else {
          // Mark token as consumed
          await db
            .update(telegramLinkTokens)
            .set({ consumedAt: new Date() })
            .where(eq(telegramLinkTokens.id, tokenRecord.id));

          // Find wallet user
          const userRecord = (
            await db.select().from(users).where(eq(users.id, tokenRecord.userId)).limit(1)
          )[0];

          // Upsert telegram link
          const existingLink = (
            await db
              .select()
              .from(telegramLinks)
              .where(eq(telegramLinks.telegramChatId, chatId.toString()))
              .limit(1)
          )[0];

          if (existingLink) {
            await db
              .update(telegramLinks)
              .set({
                userId: tokenRecord.userId,
                telegramUsername: username,
                notificationsEnabled: true,
                updatedAt: new Date(),
              })
              .where(eq(telegramLinks.id, existingLink.id));
          } else {
            await db.insert(telegramLinks).values({
              userId: tokenRecord.userId,
              telegramChatId: chatId.toString(),
              telegramUsername: username,
              notificationsEnabled: true,
            });
          }

          const maskedWallet = userRecord
            ? `${userRecord.walletAddress.slice(0, 6)}...${userRecord.walletAddress.slice(-4)}`
            : "your connected wallet";

          await sendTelegramMessage(
            chatId,
            `🎉 <b>Account Linked Successfully!</b>\n\n` +
              `Your Telegram account has been linked to wallet <code>${maskedWallet}</code>.\n\n` +
              `You will now receive instant notifications when:\n` +
              `• Milestone deliverables are submitted\n` +
              `• Milestone payments are approved & released\n` +
              `• Agreements are funded with MUSD\n` +
              `• Resolutions are proposed or accepted\n\n` +
              `Type /help to see all available commands.`
          );
        }
      } else {
        await sendTelegramMessage(
          chatId,
          `👋 <b>Welcome to Pactora!</b>\n\n` +
            `Pactora coordinates milestone-based payments and MUSD escrow for the Mezo ecosystem.\n\n` +
            `To connect your account:\n` +
            `1. Open Pactora in your browser\n` +
            `2. Connect your Web3 wallet\n` +
            `3. Go to <b>Settings → Telegram</b> and click <b>Link Telegram</b>\n\n` +
            `Commands:\n` +
            `/help - Show help and safety instructions\n` +
            `/agreements - View your linked agreements\n` +
            `/notifications - Toggle notification preferences\n` +
            `/unlink - Disconnect your Telegram account`
        );
      }
    } else if (text === "/help") {
      await sendTelegramMessage(
        chatId,
        `📖 <b>Pactora Telegram Bot Help</b>\n\n` +
          `<b>Available Commands:</b>\n` +
          `• /start - Overview and welcome information\n` +
          `• /agreements - List your linked milestone agreements\n` +
          `• /notifications - Toggle milestone notifications on or off\n` +
          `• /unlink - Remove link between Telegram and your wallet\n` +
          `• /help - Display this help guide\n\n` +
          `🛡️ <b>Security Notice:</b>\n` +
          `Pactora will <b>never</b> ask for your seed phrase, private keys, or wallet passwords. Transactions only take place on-chain through the official Pactora web app on Mezo.`
      );
    } else if (text === "/unlink") {
      const deleted = await db
        .delete(telegramLinks)
        .where(eq(telegramLinks.telegramChatId, chatId.toString()))
        .returning();

      if (deleted.length > 0) {
        await sendTelegramMessage(
          chatId,
          `🔌 <b>Account Unlinked</b>\n\n` +
            `Your Telegram account has been disconnected from Pactora. You will no longer receive notifications.`
        );
      } else {
        await sendTelegramMessage(
          chatId,
          `ℹ️ No active wallet link was found for this Telegram account.`
        );
      }
    } else if (text === "/notifications") {
      const link = (
        await db
          .select()
          .from(telegramLinks)
          .where(eq(telegramLinks.telegramChatId, chatId.toString()))
          .limit(1)
      )[0];

      if (!link) {
        await sendTelegramMessage(
          chatId,
          `⚠️ You haven't linked a wallet account yet. Link your account from the Pactora web app first.`
        );
      } else {
        const nextState = !link.notificationsEnabled;
        await db
          .update(telegramLinks)
          .set({ notificationsEnabled: nextState, updatedAt: new Date() })
          .where(eq(telegramLinks.id, link.id));

        await sendTelegramMessage(
          chatId,
          `🔔 <b>Notifications ${nextState ? "Enabled ✅" : "Muted 🔕"}</b>\n\n` +
            `You will ${nextState ? "now" : "no longer"} receive event notifications for your agreements.`
        );
      }
    } else if (text === "/agreements") {
      const link = (
        await db
          .select()
          .from(telegramLinks)
          .where(eq(telegramLinks.telegramChatId, chatId.toString()))
          .limit(1)
      )[0];

      if (!link) {
        await sendTelegramMessage(
          chatId,
          `⚠️ Please link your wallet first to view your agreements.`
        );
      } else {
        const user = (
          await db.select().from(users).where(eq(users.id, link.userId)).limit(1)
        )[0];

        if (!user) {
          await sendTelegramMessage(chatId, `⚠️ Linked user account not found.`);
        } else {
          const userAgreements = await db
            .select()
            .from(agreementMetadata)
            .where(
              or(
                eq(agreementMetadata.clientAddress, user.walletAddress),
                eq(agreementMetadata.providerAddress, user.walletAddress)
              )
            )
            .limit(10);

          if (userAgreements.length === 0) {
            await sendTelegramMessage(
              chatId,
              `📋 <b>Your Agreements</b>\n\nNo active agreements found for wallet <code>${user.walletAddress.slice(0, 6)}...${user.walletAddress.slice(-4)}</code>.`
            );
          } else {
            const listText = userAgreements
              .map(
                (a) =>
                  `• <b>#${a.onChainId}</b>: ${a.title} (${a.totalAmount} MUSD)\n  Role: ${
                    a.clientAddress.toLowerCase() === user.walletAddress.toLowerCase()
                      ? "Client"
                      : "Provider"
                  }`
              )
              .join("\n\n");

            await sendTelegramMessage(
              chatId,
              `📋 <b>Your Linked Agreements:</b>\n\n${listText}`
            );
          }
        }
      }
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("Telegram webhook handler error:", err);
    // Return 200 so Telegram does not aggressively retry fatal parsing errors
    return NextResponse.json({ ok: true, error: "Internal processing error" });
  }
}

