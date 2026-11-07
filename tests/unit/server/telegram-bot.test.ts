// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { escapeHtml, getTelegramBotLinkUrl, sendTelegramMessage } from "@/lib/telegram/bot";
import { generateLinkToken } from "@/lib/security/crypto";
import { installIllustrationEnvironment, ORIGIN, restoreIllustrationEnvironment } from "./fixtures";

vi.mock("server-only", () => ({}));

// Illustration fixtures, never real Telegram sends or bot configuration verification.
describe("Telegram delivery boundary (Illustration fixtures)", () => {
  let env: ReturnType<typeof installIllustrationEnvironment>;
  beforeEach(() => { env = installIllustrationEnvironment(); });
  afterEach(restoreIllustrationEnvironment);

  it("requires a successful HTTP/API acknowledgement with a safe integer message ID", async () => {
    env.fetchBoundary.mockResolvedValue(new Response(JSON.stringify({ ok: true, result: { message_id: 42 } }), { status: 200 }));
    expect(await sendTelegramMessage("123456", "Illustration message")).toBe(true);
    expect(env.fetchBoundary.mock.calls.length).toBe(1);
    const [url, init] = env.fetchBoundary.mock.calls[0];
    // Compare as a boolean so even a failed assertion cannot print the temporary bot token.
    expect(url === `https://api.telegram.org/bot${env.botToken}/sendMessage`).toBe(true);
    const body = JSON.parse(init?.body as string);
    expect(init?.method).toBe("POST");
    expect(body.chat_id).toBe("123456");
    expect(body.parse_mode).toBe("HTML");
    expect(body.disable_web_page_preview).toBe(true);
    expect(body.text).toContain(`${ORIGIN}/dashboard`);
    expect(init?.signal).toBeInstanceOf(AbortSignal);
  });

  it.each([
    { name: "HTTP failure", status: 500, body: { ok: true, result: { message_id: 42 } } },
    { name: "API rejection", status: 200, body: { ok: false } },
    { name: "missing message ID", status: 200, body: { ok: true, result: {} } },
  ])("does not fabricate delivery success for $name", async ({ status, body }) => {
    env.fetchBoundary.mockResolvedValue(new Response(JSON.stringify({ ...body, description: env.botToken }), { status }));
    expect(await sendTelegramMessage("123456", "Illustration message")).toBe(false);
    expect(vi.mocked(console.error).mock.calls.some((args) => JSON.stringify(args).includes(env.botToken))).toBe(false);
  });

  it("returns false and logs only a generic code on network errors", async () => {
    env.fetchBoundary.mockRejectedValue(new Error(`Illustration network failure ${env.botToken}`));
    expect(await sendTelegramMessage("123456", "Illustration message")).toBe(false);
    expect(vi.mocked(console.error).mock.calls.some((args) => JSON.stringify(args).includes(env.botToken))).toBe(false);
    expect(vi.mocked(console.error).mock.calls[0]).toEqual(["Telegram delivery unavailable", { code: "TELEGRAM_UNAVAILABLE" }]);
  });

  it("does not invoke fetch without a stub bot token", async () => {
    vi.stubEnv("TELEGRAM_BOT_TOKEN", undefined);
    expect(await sendTelegramMessage("123456", "Illustration message")).toBe(false);
    expect(env.fetchBoundary.mock.calls.length).toBe(0);
  });

  it("validates deep-link token length and bot username instead of emitting arbitrary URLs", () => {
    const token = generateLinkToken();
    expect(getTelegramBotLinkUrl(token) === `https://t.me/PactoraIllustrationBot?start=link_${token}`).toBe(true);
    expect(() => getTelegramBotLinkUrl("short")).toThrow(expect.objectContaining({ code: "INVALID_LINK_TOKEN" }));
    vi.stubEnv("TELEGRAM_BOT_USERNAME", "invalid/username");
    expect(() => getTelegramBotLinkUrl(token)).toThrow(expect.objectContaining({ code: "CONFIGURATION_REQUIRED" }));
  });

  it("escapes all HTML-significant characters in user-supplied notification text", () => {
    expect(escapeHtml('<a title="x">&\'value\'</a>')).toBe("&lt;a title=&quot;x&quot;&gt;&amp;&#39;value&#39;&lt;/a&gt;");
  });
});
