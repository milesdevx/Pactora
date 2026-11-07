// @vitest-environment node
import { NextRequest } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as linkPost, GET as linkGet, DELETE as linkDelete } from "@/app/api/telegram/link/route";
import { POST as webhookPost } from "@/app/api/telegram/webhook/route";
import { linkTelegramToken, processQueuedUpdate } from "@/lib/telegram/webhook";
import { generateLinkToken, hashToken } from "@/lib/security/crypto";
import { SESSION_COOKIE } from "@/lib/security/session";
import { notificationJobs, telegramLinks, telegramLinkTokens, users, webhookEvents } from "@/lib/db/schema";
import { defaultDbReply, illustrateDatabase, installIllustrationEnvironment, mixedCase, NOW, ORIGIN, PROVIDER, renderSql, request, restoreIllustrationEnvironment, USER_ID, WALLET } from "./fixtures";
import { illustrateRpc } from "./rpc-fixtures";

const boundary = vi.hoisted(() => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn(), transaction: vi.fn() },
  after: vi.fn(),
  rpc: { getChainId: vi.fn(), getBlockNumber: vi.fn(), getTransactionReceipt: vi.fn(), readContract: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: boundary.db }));
vi.mock("next/server", async (original) => ({ ...await original<typeof import("next/server")>(), after: boundary.after }));
vi.mock("viem", async (original) => ({ ...await original<typeof import("viem")>(), createPublicClient: () => boundary.rpc }));
vi.mock("@/lib/chain/mezo", async () => (await import("./rpc-fixtures")).chainConfig);

function update(text = "/help", chatType = "private", senderId = 123456, isBot = false) {
  return { update_id: 1001, message: { message_id: 50, date: 1700000000, chat: { id: 123456, type: chatType }, from: { id: senderId, is_bot: isBot, first_name: "Illustration", username: "fixture_user" }, text } };
}

// Illustration fixtures only: Telegram headers, stored hashes, and returned DB rows
// are local inputs, never real Telegram users, delivery, or DB concurrency verification.
describe("Telegram linking and webhook defense (Illustration fixtures)", () => {
  let env: ReturnType<typeof installIllustrationEnvironment>;
  let fixture: ReturnType<typeof illustrateDatabase>;
  beforeEach(() => {
    env = installIllustrationEnvironment();
    boundary.after.mockReset();
    illustrateRpc(boundary.rpc);
    fixture = illustrateDatabase(boundary.db);
    fixture.reply = (query) => {
      if (query.kind === "insert" && query.table === telegramLinkTokens) return undefined;
      if (query.kind === "insert" && query.table === webhookEvents) return [{ id: "illustration-update" }];
      if (query.kind === "update" && query.table === telegramLinkTokens) return [{ userId: USER_ID }];
      if (query.kind === "select" && query.table === users) return [{ id: USER_ID, walletAddress: mixedCase(WALLET) }];
      if (query.kind === "insert" && query.table === telegramLinks) return undefined;
      if (query.kind === "delete") return undefined;
      return defaultDbReply(query);
    };
  });
  afterEach(restoreIllustrationEnvironment);
  const authHeaders = () => ({ cookie: `${SESSION_COOKIE}=${env.sessionToken}` });
  const webhookHeaders = () => ({ "x-telegram-bot-api-secret-token": env.webhookSecret });

  it("allows normalized session ownership and persists only the generated link token's hash", async () => {
    const response = await linkPost(request("/api/telegram/link", { walletAddress: mixedCase(WALLET) }, authHeaders()));
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(/^[A-Za-z0-9_-]{43}$/.test(body.token)).toBe(true);
    expect(body.botUrl === `https://t.me/PactoraIllustrationBot?start=link_${body.token}`).toBe(true);
    const stored = fixture.queries("insert", telegramLinkTokens)[0].values!;
    expect(stored.tokenHash === hashToken(body.token)).toBe(true);
    expect(JSON.stringify(stored).includes(body.token)).toBe(false);
    expect(stored.userId).toBe(USER_ID);
    expect(stored.issuedWithSession).toBe(true);
    expect((stored.expiresAt as Date).getTime()).toBe(NOW.getTime() + 900_000);
  });

  it("rejects another wallet or a missing signed session before creating link tokens", async () => {
    const mismatch = await linkPost(request("/api/telegram/link", { walletAddress: PROVIDER }, authHeaders()));
    expect(mismatch.status).toBe(403);
    expect((await mismatch.json()).code).toBe("WALLET_MISMATCH");
    expect((await linkPost(request("/api/telegram/link", { walletAddress: WALLET }))).status).toBe(401);
    expect(fixture.queries("insert", telegramLinkTokens).length).toBe(0);
  });

  it("does not return a usable token when token persistence fails", async () => {
    const normalReply = fixture.reply;
    fixture.reply = (query) => { if (query.table === telegramLinkTokens) throw new Error(`Illustration failure ${env.botToken}`); return normalReply(query); };
    const response = await linkPost(request("/api/telegram/link", { walletAddress: WALLET }, authHeaders()));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(JSON.stringify(body).includes(env.botToken)).toBe(false);
    expect(body).toEqual({ error: "Service temporarily unavailable", code: "SERVICE_UNAVAILABLE" });
  });

  it("unlinks and revokes outstanding tokens only for the authenticated user in one callback", async () => {
    const req = new NextRequest(`${ORIGIN}/api/telegram/link`, { method: "DELETE", headers: { origin: ORIGIN, "content-type": "application/json", ...authHeaders() }, body: "{}" });
    expect((await linkDelete(req)).status).toBe(200);
    expect(boundary.db.transaction.mock.calls.length).toBe(1);
    for (const table of [telegramLinks, telegramLinkTokens]) {
      const where = renderSql(fixture.queries("delete", table)[0].where);
      expect(where.sql).toContain('"user_id" = $1');
      expect(where.params).toEqual([USER_ID]);
    }
  });

  it("does not present legacy unverified links as signed-wallet link status", async () => {
    const normalReply = fixture.reply;
    fixture.reply = (query) => query.kind === "select" && query.table === telegramLinks ? [] : normalReply(query);
    const response = await linkGet(request("/api/telegram/link", undefined, authHeaders()));
    expect(response.status).toBe(200);
    expect((await response.json()).linked).toBe(false);
    const where = renderSql(fixture.queries("select", telegramLinks)[0].where);
    expect(where.sql).toContain('"telegram_links"."wallet_verified" = $2');
    expect(where.params).toEqual([USER_ID, true]);
  });

  it("rejects absent, unequal-length and equal-length incorrect webhook headers without throwing a buffer-length error", async () => {
    const wrongSameLength = env.webhookSecret.startsWith("a") ? `b${env.webhookSecret.slice(1)}` : `a${env.webhookSecret.slice(1)}`;
    for (const secret of ["", "short", wrongSameLength]) {
      const response = await webhookPost(request("/api/telegram/webhook", update(), { "x-telegram-bot-api-secret-token": secret }));
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({ error: "Unauthorized webhook", code: "UNAUTHORIZED_WEBHOOK" });
    }
    expect(boundary.db.insert.mock.calls.length).toBe(0);
    expect(boundary.after.mock.calls.length).toBe(0);
  });

  it("fails closed if a webhook secret is not configured", async () => {
    vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", undefined);
    expect((await webhookPost(request("/api/telegram/webhook", update(), webhookHeaders()))).status).toBe(503);
    expect(boundary.db.insert.mock.calls.length).toBe(0);
  });

  it("queues only a private sender-matched link command and hashes its bearer argument before insertion", async () => {
    const rawToken = generateLinkToken();
    const response = await webhookPost(request("/api/telegram/webhook", update(`/start@PactoraIllustrationBot link_${rawToken}`), webhookHeaders()));
    expect(response.status).toBe(200);
    const inserted = fixture.queries("insert", webhookEvents)[0];
    expect(inserted.values?.updateId).toBe("1001");
    expect(inserted.values?.eventType).toBe("command");
    expect(inserted.values?.status).toBe("pending");
    const payload = inserted.values?.payload as Record<string, unknown>;
    expect(payload.chatId).toBe("123456");
    expect(payload.command).toBe("/start");
    expect(payload.hasArgument).toBe(true);
    expect(payload.tokenHash === hashToken(rawToken)).toBe(true);
    expect(JSON.stringify(inserted.values).includes(rawToken)).toBe(false);
    expect(inserted.conflictAction).toBe("nothing");
    expect(inserted.conflict?.target === webhookEvents.updateId).toBe(true);
    expect(boundary.after.mock.calls.length).toBe(1);
  });

  it.each([
    { name: "group", type: "group", sender: 123456, bot: false },
    { name: "mismatched private sender", type: "private", sender: 654321, bot: false },
    { name: "bot sender", type: "private", sender: 123456, bot: true },
  ])("never links or schedules a $name update", async ({ type, sender, bot }) => {
    const token = generateLinkToken();
    const response = await webhookPost(request("/api/telegram/webhook", update(`/start link_${token}`, type, sender, bot), webhookHeaders()));
    expect(response.status).toBe(200);
    const inserted = fixture.queries("insert", webhookEvents)[0].values!;
    expect(inserted.payload).toEqual({});
    expect(inserted.eventType).toBe("ignored");
    expect(inserted.status).toBe("processed");
    expect(boundary.after.mock.calls.length).toBe(0);
    expect(boundary.rpc.readContract.mock.calls.length).toBe(0);
    expect(fixture.queries("update", telegramLinkTokens).length).toBe(0);
  });

  it("deduplicates by the unique update insertion result and schedules only the first returned row", async () => {
    const normalReply = fixture.reply;
    let inserts = 0;
    fixture.reply = (query) => query.table === webhookEvents ? (++inserts === 1 ? [{ id: "illustration-update" }] : []) : normalReply(query);
    expect((await webhookPost(request("/api/telegram/webhook", update(), webhookHeaders()))).status).toBe(200);
    const duplicate = await webhookPost(request("/api/telegram/webhook", update(), webhookHeaders()));
    expect(await duplicate.json()).toEqual({ ok: true, deduplicated: true });
    expect(boundary.after.mock.calls.length).toBe(1);
    expect(fixture.queries("select", webhookEvents).length).toBe(0);
  });

  it("does not persist malformed raw link arguments as tokens", async () => {
    const response = await webhookPost(request("/api/telegram/webhook", update("/start link_invalid"), webhookHeaders()));
    expect(response.status).toBe(200);
    const payload = fixture.queries("insert", webhookEvents)[0].values?.payload as Record<string, unknown>;
    expect(payload.hasArgument).toBe(true);
    expect("tokenHash" in payload).toBe(false);
    expect(JSON.stringify(payload).includes("link_invalid")).toBe(false);
  });

  it("maps unsolicited private text to help without persisting possible secrets", async () => {
    const response = await webhookPost(request("/api/telegram/webhook", update(env.botToken), webhookHeaders()));
    expect(response.status).toBe(200);
    const stored = fixture.queries("insert", webhookEvents)[0].values!;
    const payload = stored.payload as Record<string, unknown>;
    expect(payload.command === "/help").toBe(true);
    expect(JSON.stringify(stored).includes(env.botToken)).toBe(false);
  });

  it("does not acknowledge or schedule successful webhook work after insertion errors", async () => {
    const normalReply = fixture.reply;
    fixture.reply = (query) => { if (query.table === webhookEvents) throw new Error(`Illustration failure ${env.webhookSecret}`); return normalReply(query); };
    const response = await webhookPost(request("/api/telegram/webhook", update(), webhookHeaders()));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(JSON.stringify(body).includes(env.webhookSecret)).toBe(false);
    expect(body).toEqual({ error: "Service temporarily unavailable", code: "SERVICE_UNAVAILABLE" });
    expect(boundary.after.mock.calls.length).toBe(0);
    expect(vi.mocked(console.error).mock.calls.some((args) => JSON.stringify(args).includes(env.webhookSecret))).toBe(false);
  });

  it("conditionally consumes an unexpired, unused hash before atomically upserting a user-scoped chat link", async () => {
    const tokenHash = hashToken(generateLinkToken());
    expect(await linkTelegramToken(tokenHash, "123456", "fixture_user")).toBe(WALLET);
    expect(boundary.db.transaction.mock.calls.length).toBe(1);
    const consumed = fixture.queries("update", telegramLinkTokens)[0];
    const where = renderSql(consumed.where);
    expect(where.sql).toContain('"telegram_link_tokens"."token_hash" = $1');
    expect(where.sql).toContain('"telegram_link_tokens"."consumed_at" is null');
    expect(where.sql).toContain('"telegram_link_tokens"."expires_at" > now()');
    expect(where.sql).toContain('"telegram_link_tokens"."issued_with_session" = $2');
    expect(where.params[0] === tokenHash).toBe(true);
    expect(where.params[1]).toBe(true);
    expect((consumed.set?.consumedAt as Date).getTime()).toBe(NOW.getTime());
    const linked = fixture.queries("insert", telegramLinks)[0];
    expect(linked.conflictAction).toBe("update");
    expect(linked.conflict?.target === telegramLinks.userId).toBe(true);
    expect(linked.values).toEqual({ userId: USER_ID, telegramChatId: "123456", telegramUsername: "fixture_user", notificationsEnabled: true, walletVerified: true });
    expect(linked.conflict?.set?.walletVerified).toBe(true);
  });

  it("rejects missing, reused or expired link hashes when conditional consumption returns no user", async () => {
    const normalReply = fixture.reply;
    fixture.reply = (query) => query.kind === "update" && query.table === telegramLinkTokens ? [] : normalReply(query);
    await expect(linkTelegramToken(hashToken(generateLinkToken()), "123456")).rejects.toMatchObject({ status: 400, code: "INVALID_LINK_TOKEN" });
    expect(fixture.queries("insert", telegramLinks).length).toBe(0);
    expect(fixture.queries("select", users).length).toBe(0);
  });

  it("never puts raw command errors or secrets into queued replies or logs", async () => {
    const normalReply = fixture.reply;
    let claims = 0;
    fixture.reply = (query) => {
      if (query.kind === "update" && query.table === webhookEvents) return ++claims === 1 ? [{ payload: { chatId: "123456", command: "/start", tokenHash: hashToken(generateLinkToken()), hasArgument: true } }] : undefined;
      if (query.kind === "update" && query.table === telegramLinkTokens) throw new Error(`Illustration sensitive command failure ${env.botToken}`);
      if (query.kind === "insert" && query.table === notificationJobs) return [{ id: "illustration-job" }];
      if (query.kind === "update" && query.table === notificationJobs) return [];
      return normalReply(query);
    };
    await processQueuedUpdate("illustration-update");
    expect(renderSql(fixture.queries("update", webhookEvents)[0].where).params).toEqual(["illustration-update", "pending"]);
    const queued = fixture.queries("insert", notificationJobs)[0].values!;
    expect(queued.message).toBe("Command could not be completed. Retry from /help; wallet and chain state have not been simulated.");
    expect(JSON.stringify(queued).includes(env.botToken)).toBe(false);
    expect(vi.mocked(console.error).mock.calls.some((args) => JSON.stringify(args).includes(env.botToken))).toBe(false);
    expect(env.fetchBoundary.mock.calls.length).toBe(0);
  });
});
