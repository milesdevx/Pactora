const botToken = process.env.TELEGRAM_BOT_TOKEN;
const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET;
const productionUrl = "https://pactora-tan.vercel.app";
const webhookUrl = `${productionUrl}/api/telegram/webhook`;

if (!botToken) throw new Error("TELEGRAM_BOT_TOKEN is required.");
if (!webhookSecret || webhookSecret.length < 32) throw new Error("TELEGRAM_WEBHOOK_SECRET must contain at least 32 characters.");

async function telegram(method, body) {
  let response;
  try {
    response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new Error(`Telegram API ${method} request failed.`);
  }
  const data = await response.json().catch(() => null);
  if (!response.ok || !data?.ok) throw new Error(`Telegram API ${method} rejected the request: ${data?.description || response.status}.`);
  return data.result;
}

const configured = await telegram("setWebhook", {
  url: webhookUrl,
  secret_token: webhookSecret,
  allowed_updates: ["message"],
  drop_pending_updates: false,
});
const info = await telegram("getWebhookInfo");
const result = {
  setWebhook: configured === true,
  url: info.url,
  pendingUpdateCount: info.pending_update_count,
  lastErrorMessage: info.last_error_message || null,
  lastErrorDate: info.last_error_date || null,
  allowedUpdates: info.allowed_updates || [],
};
console.log(JSON.stringify(result, null, 2));
if (result.url !== webhookUrl) throw new Error("Telegram webhook URL does not match production.");
if (result.lastErrorMessage) throw new Error("Telegram reports a webhook delivery error.");
