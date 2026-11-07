import "server-only";
import { ApiError, getAppUrl } from "@/lib/security/api";

export function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

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
  const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  if (!BOT_TOKEN) {
    console.warn("TELEGRAM_BOT_TOKEN is not set; skipping Telegram message delivery.");
    return false;
  }

  try {
    const footer = `\n\n<a href="${getAppUrl()}/dashboard">Open Pactora</a> | <a href="https://explorer.test.mezo.org">Mezo Testnet explorer</a>`;
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: text + footer,
        parse_mode: options.parse_mode,
        disable_web_page_preview: options.disable_web_page_preview ?? true,
      }),
      signal: AbortSignal.timeout(8000),
    });

    const result = await res.json().catch(() => null);
    if (!res.ok || result?.ok !== true || !Number.isSafeInteger(result?.result?.message_id)) {
      console.error("Telegram delivery rejected", { status: res.status });
      return false;
    }

    return true;
  } catch {
    console.error("Telegram delivery unavailable", { code: "TELEGRAM_UNAVAILABLE" });
    return false;
  }
}

/**
 * Build deep link URL to link account with Telegram bot
 */
export function getTelegramBotLinkUrl(token: string): string {
  const botUsername = process.env.TELEGRAM_BOT_USERNAME;
  if (!botUsername || !/^[a-zA-Z][a-zA-Z0-9_]{4,31}$/.test(botUsername)) throw new ApiError(503, "Telegram bot username is not configured", "CONFIGURATION_REQUIRED");
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ApiError(400, "Invalid link token", "INVALID_LINK_TOKEN");
  return `https://t.me/${botUsername}?start=link_${token}`;
}
