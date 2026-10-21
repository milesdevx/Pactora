/**
 * Telegram Bot API client and notification dispatchers
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const APP_URL = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "https://pactora.vercel.app";

export interface SendMessageOptions {
  parse_mode?: "HTML" | "Markdown" | "MarkdownV2";
  disable_web_page_preview?: boolean;
}

/**
 * Send message through Telegram Bot API
 */
export async function sendTelegramMessage(
  chatId: string | number,
  text: string,
  options: SendMessageOptions = { parse_mode: "HTML" }
): Promise<boolean> {
  if (!BOT_TOKEN) {
    console.warn("TELEGRAM_BOT_TOKEN is not set; skipping Telegram message delivery.");
    return false;
  }

  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: options.parse_mode,
        disable_web_page_preview: options.disable_web_page_preview ?? false,
      }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      console.error("Telegram API error response:", errData);
      return false;
    }

    return true;
  } catch (err) {
    console.error("Failed to send Telegram message:", err);
    return false;
  }
}

/**
 * Build deep link URL to link account with Telegram bot
 */
export function getTelegramBotLinkUrl(token: string): string {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME || "PactoraEscrowBot";
  return `https://t.me/${botUsername}?start=${token}`;
}

/**
 * Pre-formatted notification templates for blockchain and agreement events
 */
export const TelegramNotifications = {
  agreementCreated: (agreementId: number, title: string, amount: string, counterparty: string) =>
    `🤝 <b>Pactora: New Agreement Created</b>\n\n` +
    `<b>Agreement:</b> #${agreementId} - ${title}\n` +
    `<b>Total:</b> ${amount} MUSD\n` +
    `<b>Created by:</b> <code>${counterparty}</code>\n\n` +
    `👉 <a href="${APP_URL}/agreements/${agreementId}">Review Agreement in Pactora</a>`,

  agreementAccepted: (agreementId: number, title: string, provider: string) =>
    `✅ <b>Pactora: Agreement Accepted</b>\n\n` +
    `Provider <code>${provider}</code> accepted terms for <b>Agreement #${agreementId}</b> (${title}).\n\n` +
    `Funds can now be deposited into escrow.\n` +
    `👉 <a href="${APP_URL}/agreements/${agreementId}">Fund Escrow in Pactora</a>`,

  agreementFunded: (agreementId: number, title: string, amount: string, txHash?: string) =>
    `🔒 <b>Pactora: Escrow Funded in MUSD</b>\n\n` +
    `Agreement #${agreementId} (${title}) has been funded with <b>${amount} MUSD</b>.\n` +
    `Funds are locked on Mezo Testnet smart contract.\n` +
    (txHash ? `Tx: <code>${txHash.slice(0, 10)}...${txHash.slice(-8)}</code>\n\n` : "\n") +
    `👉 <a href="${APP_URL}/agreements/${agreementId}">Open Workspace</a>`,

  milestoneSubmitted: (agreementId: number, milestoneIndex: number, title: string) =>
    `📤 <b>Pactora: Milestone Submitted for Review</b>\n\n` +
    `Milestone #${milestoneIndex + 1} has been submitted for review on <b>Agreement #${agreementId}</b> (${title}).\n\n` +
    `👉 <a href="${APP_URL}/agreements/${agreementId}">Inspect Deliverable & Approve</a>`,

  milestoneApproved: (
    agreementId: number,
    milestoneIndex: number,
    amount: string,
    txHash?: string
  ) =>
    `🎉 <b>Pactora: Milestone Approved & Payment Released</b>\n\n` +
    `Milestone #${milestoneIndex + 1} approved! <b>${amount} MUSD</b> has been transferred to provider.\n` +
    (txHash ? `Tx: <code>${txHash.slice(0, 10)}...${txHash.slice(-8)}</code>\n\n` : "\n") +
    `👉 <a href="${APP_URL}/receipts/${agreementId}">View Verifiable Receipt</a>`,

  milestoneRejected: (agreementId: number, milestoneIndex: number, reason: string) =>
    `⚠️ <b>Pactora: Milestone Rejected</b>\n\n` +
    `Milestone #${milestoneIndex + 1} was rejected by client for <b>Agreement #${agreementId}</b>.\n` +
    `<b>Reason:</b> ${reason}\n\n` +
    `👉 <a href="${APP_URL}/agreements/${agreementId}">Open Agreement to Revise</a>`,

  resolutionProposed: (
    agreementId: number,
    clientRefund: string,
    providerRelease: string
  ) =>
    `⚖️ <b>Pactora: Mutual Resolution Proposed</b>\n\n` +
    `A resolution was proposed for Agreement #${agreementId}.\n` +
    `• Refund to Client: <b>${clientRefund} MUSD</b>\n` +
    `• Release to Provider: <b>${providerRelease} MUSD</b>\n\n` +
    `👉 <a href="${APP_URL}/agreements/${agreementId}">Review Proposal in Pactora</a>`,
};

