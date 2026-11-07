import "server-only";
import { after } from "next/server";
import { and, eq, inArray, or, sql } from "drizzle-orm";
import { formatUnits } from "viem";
import { db } from "@/lib/db";
import { notificationJobs, telegramLinks, users } from "@/lib/db/schema";
import { ApiError, getAppUrl } from "@/lib/security/api";
import { getEscrowAddress, readChainAgreement, readConfirmedReceipt } from "@/lib/chain/server";
import { CONTRACT_ADDRESSES } from "@/lib/chain/mezo";
import { escapeHtml, sendTelegramMessage } from "./bot";

export function formatChainNotification(label: string, id: number, details: string[], txHash: string): string {
  return `<b>Pactora: ${escapeHtml(label)}</b>\n\nAgreement #${id}\n${details.map(escapeHtml).join("\n")}\n\n` +
    `<a href="${getAppUrl()}/agreements/${id}">Open agreement</a> | <a href="${getAppUrl()}/receipts/${id}">Public receipt</a>\n` +
    `<a href="https://explorer.test.mezo.org/tx/${txHash}">Confirmed Mezo Testnet transaction</a>`;
}

export async function queueMessage(eventKey: string, chatId: string, message: string): Promise<string | undefined> {
  const [inserted] = await db.insert(notificationJobs).values({ eventKey, recipientChatId: chatId, message })
    .onConflictDoNothing({ target: notificationJobs.eventKey }).returning({ id: notificationJobs.id });
  if (inserted) return inserted.id;
  const [existing] = await db.select({ id: notificationJobs.id }).from(notificationJobs)
    .where(and(eq(notificationJobs.eventKey, eventKey), or(eq(notificationJobs.status, "failed"), eq(notificationJobs.status, "pending")))).limit(1);
  return existing?.id;
}

export async function sendNotificationJobs(ids: string[]) {
  for (const id of ids) {
    try {
      const [job] = await db.update(notificationJobs).set({ status: "sending", attempts: sql`${notificationJobs.attempts} + 1` })
        .where(and(eq(notificationJobs.id, id), or(eq(notificationJobs.status, "pending"), eq(notificationJobs.status, "failed"))))
        .returning();
      if (!job) continue;
      const sent = await sendTelegramMessage(job.recipientChatId, job.message);
      await db.update(notificationJobs).set({ status: sent ? "sent" : "failed", sentAt: sent ? new Date() : null, lastError: sent ? null : "TELEGRAM_DELIVERY_FAILED" }).where(eq(notificationJobs.id, id));
    } catch { console.error("Notification job failed", { code: "NOTIFICATION_UNAVAILABLE" }); }
  }
}

export async function queueConfirmedNotifications(txHash: `0x${string}`, wallet: string) {
  const { logs } = await readConfirmedReceipt(txHash);
  const ids: string[] = [];
  let related = false;
  for (const log of logs) {
    if (!("agreementId" in log.args)) continue;
    const id = Number(log.args.agreementId);
    if (!Number.isSafeInteger(id) || id < 1 || id > 2_147_483_647) continue;
    const { agreement } = await readChainAgreement(id);
    if (![agreement.client.toLowerCase(), agreement.provider.toLowerCase()].includes(wallet.toLowerCase())) continue;
    related = true;
    if (agreement.token.toLowerCase() !== CONTRACT_ADDRESSES.MUSD.toLowerCase()) throw new ApiError(400, "Notifications currently support canonical MUSD only", "UNSUPPORTED_TOKEN");
    const details: string[] = [];
    const labels: Record<string, string> = {
      AgreementCreated: "Agreement created", AgreementAccepted: "Agreement accepted", AgreementFunded: "Escrow funded",
      MilestoneSubmitted: "Milestone submitted for review", MilestoneApproved: "Milestone payment released", MilestoneRejected: "Milestone rejected",
      AgreementCancelled: "Agreement closed or cancelled", AgreementCompleted: "Agreement completed", ResolutionProposed: "Mutual split proposed", ResolutionAccepted: "Mutual split executed", ResolutionCancelled: "Mutual split invalidated",
      MilestoneRefunded: "No-show refund", MilestoneTimeoutClaimed: "Review-timeout payment released",
    };
    if (!labels[log.eventName]) continue;
    if ("milestoneIndex" in log.args) details.push(`Milestone ${Number(log.args.milestoneIndex) + 1}`);
    if ("amount" in log.args) details.push(`Amount: ${formatUnits(log.args.amount, 18)} MUSD`);
    if ("totalAmount" in log.args) details.push(`Total: ${formatUnits(log.args.totalAmount, 18)} MUSD`);
    if ("clientRefund" in log.args) details.push(`Client refund: ${formatUnits(log.args.clientRefund, 18)} MUSD`);
    if ("providerRelease" in log.args) details.push(`Provider release: ${formatUnits(log.args.providerRelease, 18)} MUSD`);
    details.push(`Client: ${agreement.client}`, `Provider: ${agreement.provider}`);
    const recipients = await db.select({ chatId: telegramLinks.telegramChatId, userId: users.id }).from(telegramLinks)
      .innerJoin(users, eq(telegramLinks.userId, users.id)).where(and(eq(telegramLinks.notificationsEnabled, true), eq(telegramLinks.walletVerified, true), inArray(users.walletAddress, [agreement.client.toLowerCase(), agreement.provider.toLowerCase()])));
    for (const recipient of recipients) {
      const queued = await queueMessage(`31611:${getEscrowAddress()}:${txHash}:${log.logIndex}:${recipient.userId}`, recipient.chatId, formatChainNotification(labels[log.eventName], id, details, txHash));
      if (queued) ids.push(queued);
    }
  }
  if (!related) throw new ApiError(403, "Transaction is not related to this wallet", "NOT_AGREEMENT_PARTY");
  if (ids.length) after(() => sendNotificationJobs(ids));
  return ids.length;
}
