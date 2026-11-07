import "server-only";
import { z } from "zod";
import { and, eq, gt, isNull, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { telegramLinkTokens, telegramLinks, users, webhookEvents } from "@/lib/db/schema";
import { ApiError, getAppUrl } from "@/lib/security/api";
import { queueMessage, sendNotificationJobs } from "./notifications";
import { formatAgreements, formatBalance, formatGetMusd, formatPending } from "./formatters";
import { readWalletAgreements, readWalletBalance } from "./chain-reads";

const CommandSchema = z.object({ chatId: z.string().regex(/^[1-9]\d*$/), command: z.string().max(64), username: z.string().max(64).optional(), tokenHash: z.string().regex(/^[0-9a-f]{64}$/).optional(), hasArgument: z.boolean() });
type Command = z.infer<typeof CommandSchema>;

export const BOT_HELP = `<b>Pactora on Mezo Testnet</b>\n\n/start - Welcome and wallet linking\n/balance - Linked wallet's MUSD and BTC gas\n/agreements - On-chain states and next actions\n/pending - Work needing your review or delivery\n/getmusd - Test BTC/MUSD guide\n/notifications - Toggle confirmed-event alerts\n/unlink - Disconnect your wallet\n/help - Commands and safety\n\nTransactions are signed only in Pactora, never in Telegram. Never share a seed phrase or private key.`;

export async function linkTelegramToken(tokenHash: string, chatId: string, username?: string) {
  return db.transaction(async (tx) => {
    const [token] = await tx.update(telegramLinkTokens).set({ consumedAt: new Date() }).where(and(
      eq(telegramLinkTokens.tokenHash, tokenHash), isNull(telegramLinkTokens.consumedAt), gt(telegramLinkTokens.expiresAt, sql`now()`),
      eq(telegramLinkTokens.issuedWithSession, true),
    )).returning({ userId: telegramLinkTokens.userId });
    if (!token) throw new ApiError(400, "Link token expired, invalid, or already used", "INVALID_LINK_TOKEN");
    const [user] = await tx.select().from(users).where(eq(users.id, token.userId)).limit(1);
    if (!user) throw new ApiError(400, "Wallet account no longer exists", "INVALID_LINK_TOKEN");
    await tx.insert(telegramLinks).values({ userId: token.userId, telegramChatId: chatId, telegramUsername: username, notificationsEnabled: true, walletVerified: true })
      .onConflictDoUpdate({ target: telegramLinks.userId, set: { telegramChatId: chatId, telegramUsername: username, notificationsEnabled: true, walletVerified: true, updatedAt: new Date() } });
    return user.walletAddress.toLowerCase();
  });
}

export async function executeCommand(command: Command): Promise<string> {
  const { chatId, username } = command;
  if (command.command === "/start") {
    if (command.tokenHash) {
      const wallet = await linkTelegramToken(command.tokenHash, chatId, username);
      return `<b>Wallet linked</b>\n\n<code>${wallet}</code>\nUse /agreements to check your agreements and /help for commands.`;
    }
    if (command.hasArgument) return `Link token invalid or expired. Generate a fresh link at <a href="${getAppUrl()}/settings/telegram">Telegram settings</a>.`;
    return `${BOT_HELP}\n\n<a href="${getAppUrl()}/settings/telegram">Connect and sign in with your wallet, then link Telegram</a>.`;
  }
  if (command.command === "/help") return `${BOT_HELP}\n\n${formatGetMusd(getAppUrl())}`;
  if (command.command === "/getmusd") return formatGetMusd(getAppUrl());
  if (command.command === "/unlink") {
    const removed = await db.transaction(async (tx) => {
      const links = await tx.delete(telegramLinks).where(eq(telegramLinks.telegramChatId, chatId)).returning({ userId: telegramLinks.userId });
      for (const link of links) await tx.delete(telegramLinkTokens).where(eq(telegramLinkTokens.userId, link.userId));
      return links.length;
    });
    return removed ? "<b>Wallet unlinked</b>\nNotifications are disabled and unused link tokens revoked." : "No wallet is linked to this private chat.";
  }
  if (command.command === "/notifications") {
    const [link] = await db.update(telegramLinks).set({ notificationsEnabled: sql`not ${telegramLinks.notificationsEnabled}`, updatedAt: new Date() })
      .where(and(eq(telegramLinks.telegramChatId, chatId), eq(telegramLinks.walletVerified, true))).returning({ enabled: telegramLinks.notificationsEnabled });
    return link ? `<b>Notifications ${link.enabled ? "enabled" : "muted"}</b>` : "Link your wallet from Telegram settings first.";
  }
  if (["/balance", "/agreements", "/pending"].includes(command.command)) {
    const [user] = await db.select({ wallet: users.walletAddress }).from(telegramLinks).innerJoin(users, eq(telegramLinks.userId, users.id)).where(and(eq(telegramLinks.telegramChatId, chatId), eq(telegramLinks.walletVerified, true))).limit(1);
    if (!user) return "Link your wallet from Telegram settings first.";
    const wallet = user.wallet.toLowerCase() as `0x${string}`;
    if (command.command === "/balance") { const balance = await readWalletBalance(wallet); return formatBalance(wallet, balance.musd, balance.btc, balance.blockNumber, getAppUrl()); }
    const data = await readWalletAgreements(wallet);
    return command.command === "/pending" ? formatPending(data.agreements, wallet, getAppUrl(), data.complete) : formatAgreements(data.agreements, wallet, getAppUrl(), data.complete);
  }
  return BOT_HELP;
}

export async function processQueuedUpdate(id: string) {
  try {
    const [event] = await db.update(webhookEvents).set({ status: "processing" }).where(and(eq(webhookEvents.id, id), eq(webhookEvents.status, "pending"))).returning({ payload: webhookEvents.payload });
    if (!event) return;
    const command = CommandSchema.parse(event.payload);
    let reply: string;
    try { reply = await executeCommand(command); }
    catch (error) {
      reply = error instanceof ApiError && error.code === "INVALID_LINK_TOKEN" ? "Link token expired or already used. Generate a fresh link in Telegram settings." : "Command could not be completed. Retry from /help; wallet and chain state have not been simulated.";
      console.error("Telegram command failed", { code: "COMMAND_UNAVAILABLE" });
    }
    const job = await queueMessage(`telegram:${id}:reply`, command.chatId, reply);
    await db.update(webhookEvents).set({ status: "processed", processedAt: new Date() }).where(eq(webhookEvents.id, id));
    if (job) await sendNotificationJobs([job]);
  } catch { console.error("Telegram update processing failed", { code: "WEBHOOK_WORK_UNAVAILABLE" }); }
}
