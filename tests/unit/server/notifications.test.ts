// @vitest-environment node
import { TransactionReceiptNotFoundError } from "viem";
import type { SQL } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as testPost } from "@/app/api/notifications/test/route";
import { POST as confirmedPost } from "@/app/api/notifications/confirmed/route";
import { queueMessage, sendNotificationJobs } from "@/lib/telegram/notifications";
import { SESSION_COOKIE } from "@/lib/security/session";
import { notificationJobs, telegramLinks } from "@/lib/db/schema";
import { defaultDbReply, ESCROW, illustrateDatabase, installIllustrationEnvironment, mixedCase, MUSD, PROVIDER, renderSql, request, restoreIllustrationEnvironment, TX_HASH, USER_ID, WALLET } from "./fixtures";
import { creationLog, illustrateRpc, receipt } from "./rpc-fixtures";

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

// Illustration fixtures only. Real receipt parsing/security functions run against
// mocked RPC, DB and fetch boundaries, never real receipts, recipients or delivery.
describe("Notification defenses (Illustration fixtures)", () => {
  let env: ReturnType<typeof installIllustrationEnvironment>;
  let fixture: ReturnType<typeof illustrateDatabase>;
  let chain: ReturnType<typeof illustrateRpc>;
  beforeEach(() => {
    env = installIllustrationEnvironment();
    boundary.after.mockReset();
    chain = illustrateRpc(boundary.rpc);
    fixture = illustrateDatabase(boundary.db);
    fixture.reply = (query) => {
      if (query.kind === "select" && query.table === telegramLinks) return [{ chatId: "123456", telegramChatId: "123456", userId: USER_ID, notificationsEnabled: true, walletVerified: true }];
      if (query.kind === "insert" && query.table === notificationJobs) return [{ id: "illustration-job" }];
      return defaultDbReply(query);
    };
  });
  afterEach(restoreIllustrationEnvironment);
  const authHeaders = () => ({ cookie: `${SESSION_COOKIE}=${env.sessionToken}` });
  const deliveryOk = () => env.fetchBoundary.mockResolvedValue(new Response(JSON.stringify({ ok: true, result: { message_id: 123 } }), { status: 200 }));

  it("requires exactly ALLOW_TEST_NOTIFICATIONS='true' in production, not truthy-looking strings", async () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const value of [undefined, "false", "TRUE", "1"]) {
      vi.stubEnv("ALLOW_TEST_NOTIFICATIONS", value);
      expect((await testPost(request("/api/notifications/test", {}, authHeaders()))).status).toBe(403);
    }
    expect(boundary.db.select.mock.calls.length + boundary.db.insert.mock.calls.length).toBe(0);
    expect(env.fetchBoundary.mock.calls.length).toBe(0);
  });

  it("delivers an explicitly enabled test only to the verified session's linked recipient, escaping client text", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_TEST_NOTIFICATIONS", "true");
    deliveryOk();
    const response = await testPost(request("/api/notifications/test", { message: '<script>illustration</script> & "quoted"' }, authHeaders()));
    expect(response.status).toBe(200);
    expect((await response.json()).success).toBe(true);
    const where = renderSql(fixture.queries("select", telegramLinks)[0].where);
    expect(where.sql).toContain('"telegram_links"."user_id" = $1');
    expect(where.sql).toContain('"telegram_links"."wallet_verified" = $2');
    expect(where.params).toEqual([USER_ID, true]);
    expect(env.fetchBoundary.mock.calls.length).toBe(1);
    const sent = JSON.parse(env.fetchBoundary.mock.calls[0][1]?.body as string);
    expect(sent.chat_id).toBe("123456");
    expect(sent.text).toContain("Test notification, not a chain event");
    expect(sent.text).toContain("&lt;script&gt;illustration&lt;/script&gt; &amp; &quot;quoted&quot;");
    expect(sent.text.includes("<script>")).toBe(false);
  });

  it("does not accept a caller-selected chat or fabricated success flags for test notifications", async () => {
    const response = await testPost(request("/api/notifications/test", { chatId: "654321", message: "Illustration", success: true }, authHeaders()));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("VALIDATION_FAILED");
    expect(fixture.queries("select", telegramLinks).length).toBe(0);
    expect(env.fetchBoundary.mock.calls.length).toBe(0);
  });

  it("refuses unlinked or muted sessions without invoking Telegram", async () => {
    const normalReply = fixture.reply;
    for (const links of [[], [{ telegramChatId: "123456", notificationsEnabled: false, walletVerified: true }]]) {
      fixture.reply = (query) => query.kind === "select" && query.table === telegramLinks ? links : normalReply(query);
      const response = await testPost(request("/api/notifications/test", {}, authHeaders()));
      expect(response.status).toBe(409);
      expect((await response.json()).code).toBe("TELEGRAM_NOT_LINKED");
    }
    expect(env.fetchBoundary.mock.calls.length).toBe(0);
  });

  it("does not report test delivery success when Telegram rejects a mocked send", async () => {
    env.fetchBoundary.mockResolvedValue(new Response(JSON.stringify({ ok: false, description: env.botToken }), { status: 200 }));
    const response = await testPost(request("/api/notifications/test", {}, authHeaders()));
    expect(response.status).toBe(502);
    const body = await response.json();
    expect("success" in body).toBe(false);
    expect(JSON.stringify(body).includes(env.botToken)).toBe(false);
    expect(vi.mocked(console.error).mock.calls.some((args) => JSON.stringify(args).includes(env.botToken))).toBe(false);
  });

  it("rejects caller success/receipt flags rather than trusting them as chain confirmation", async () => {
    for (const flag of [{ success: true }, { receiptStatus: "success" }, { verified: true }]) {
      const response = await confirmedPost(request("/api/notifications/confirmed", { txHash: TX_HASH, ...flag }, authHeaders()));
      expect(response.status).toBe(400);
      expect((await response.json()).code).toBe("VALIDATION_FAILED");
    }
    expect(boundary.rpc.getTransactionReceipt.mock.calls.length).toBe(0);
    expect(fixture.queries("insert", notificationJobs).length).toBe(0);
  });

  it("queues only successful escrow-address events for verified, opted-in agreement parties", async () => {
    chain.agreement.client = mixedCase(WALLET);
    chain.agreement.provider = mixedCase(PROVIDER);
    boundary.rpc.getTransactionReceipt.mockResolvedValue(receipt([creationLog(MUSD, 99n, 0), creationLog(mixedCase(ESCROW), 1n, 1)]));
    const response = await confirmedPost(request("/api/notifications/confirmed", { txHash: TX_HASH }, authHeaders()));
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ verified: true, queued: 1, txHash: TX_HASH });
    expect(response.headers.get("cache-control")).toBe("no-store");
    const where = renderSql(fixture.queries("select", telegramLinks)[0].where);
    expect(where.sql).toContain('"telegram_links"."notifications_enabled" = $1');
    expect(where.sql).toContain('"telegram_links"."wallet_verified" = $2');
    expect(where.sql).toContain('"users"."wallet_address" in ($3, $4)');
    expect(where.params).toEqual([true, true, WALLET, PROVIDER]);
    const jobs = fixture.queries("insert", notificationJobs);
    expect(jobs.length).toBe(1);
    expect(jobs[0].values?.recipientChatId).toBe("123456");
    expect(jobs[0].values?.eventKey).toBe(`31611:${ESCROW}:${TX_HASH}:1:${USER_ID}`);
    expect(jobs[0].values?.message).toContain("Pactora: Agreement created");
    expect(boundary.rpc.readContract.mock.calls.some(([call]) => call.args?.[0] === 99n)).toBe(false);
    expect(boundary.after.mock.calls.length).toBe(1);
    expect(env.fetchBoundary.mock.calls.length).toBe(0);
  });

  it("does not fabricate recipients when the linked-party selection is empty", async () => {
    const normalReply = fixture.reply;
    fixture.reply = (query) => query.kind === "select" && query.table === telegramLinks ? [] : normalReply(query);
    const response = await confirmedPost(request("/api/notifications/confirmed", { txHash: TX_HASH }, authHeaders()));
    expect(response.status).toBe(202);
    expect((await response.json()).queued).toBe(0);
    expect(fixture.queries("insert", notificationJobs).length).toBe(0);
    expect(boundary.after.mock.calls.length).toBe(0);
  });

  it("requires a successful receipt even when reverted logs contain a valid escrow event", async () => {
    boundary.rpc.getTransactionReceipt.mockResolvedValue(receipt([creationLog()], "reverted"));
    const response = await confirmedPost(request("/api/notifications/confirmed", { txHash: TX_HASH }, authHeaders()));
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("TRANSACTION_REVERTED");
    expect(fixture.queries("insert", notificationJobs).length).toBe(0);
    expect(boundary.rpc.readContract.mock.calls.length).toBe(0);
    expect(boundary.after.mock.calls.length).toBe(0);
  });

  it("excludes events emitted by unrelated addresses even if their topics and data decode", async () => {
    boundary.rpc.getTransactionReceipt.mockResolvedValue(receipt([creationLog(MUSD)]));
    const response = await confirmedPost(request("/api/notifications/confirmed", { txHash: TX_HASH }, authHeaders()));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("INVALID_TRANSACTION");
    expect(fixture.queries("insert", notificationJobs).length).toBe(0);
    expect(boundary.rpc.readContract.mock.calls.length).toBe(0);
  });

  it("does not authorize a transaction for a wallet outside the on-chain agreement parties", async () => {
    chain.agreement.client = MUSD;
    chain.agreement.provider = ESCROW;
    const response = await confirmedPost(request("/api/notifications/confirmed", { txHash: TX_HASH }, authHeaders()));
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("NOT_AGREEMENT_PARTY");
    expect(fixture.queries("select", telegramLinks).length).toBe(0);
    expect(fixture.queries("insert", notificationJobs).length).toBe(0);
  });

  it("rejects a pending receipt and a wrong RPC chain without queuing", async () => {
    boundary.rpc.getTransactionReceipt.mockRejectedValue(new TransactionReceiptNotFoundError({ hash: TX_HASH }));
    const pending = await confirmedPost(request("/api/notifications/confirmed", { txHash: TX_HASH }, authHeaders()));
    expect(pending.status).toBe(409);
    expect((await pending.json()).code).toBe("TRANSACTION_PENDING");
    boundary.rpc.getChainId.mockResolvedValue(1);
    const wrongChain = await confirmedPost(request("/api/notifications/confirmed", { txHash: TX_HASH }, authHeaders()));
    expect(wrongChain.status).toBe(503);
    expect((await wrongChain.json()).code).toBe("NETWORK_MISMATCH");
    expect(fixture.queries("insert", notificationJobs).length).toBe(0);
  });

  it("returns safe errors rather than chain confirmation after RPC failures", async () => {
    boundary.rpc.getTransactionReceipt.mockRejectedValue(new Error(`Illustration sensitive RPC failure ${env.rateSecret}`));
    const response = await confirmedPost(request("/api/notifications/confirmed", { txHash: TX_HASH }, authHeaders()));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(JSON.stringify(body).includes(env.rateSecret)).toBe(false);
    expect(body).toEqual({ error: "Service temporarily unavailable", code: "SERVICE_UNAVAILABLE" });
    expect(vi.mocked(console.error).mock.calls.some((args) => JSON.stringify(args).includes(env.rateSecret))).toBe(false);
    expect(fixture.queries("insert", notificationJobs).length).toBe(0);
  });

  it("uses a unique event insertion and reuses only retryable pending/failed jobs", async () => {
    const normalReply = fixture.reply;
    fixture.reply = (query) => {
      if (query.kind === "insert" && query.table === notificationJobs) return [];
      if (query.kind === "select" && query.table === notificationJobs) return [{ id: "retryable-job" }];
      return normalReply(query);
    };
    expect(await queueMessage("illustration:event", "123456", "Illustration message")).toBe("retryable-job");
    const inserted = fixture.queries("insert", notificationJobs)[0];
    expect(inserted.conflictAction).toBe("nothing");
    expect(inserted.conflict?.target === notificationJobs.eventKey).toBe(true);
    const where = renderSql(fixture.queries("select", notificationJobs)[0].where);
    expect(where.params).toEqual(["illustration:event", "failed", "pending"]);
    expect(where.sql).toContain('"notification_jobs"."status" = $2 or "notification_jobs"."status" = $3');
  });

  it("claims only retryable jobs and stores generic delivery failure without leaking network bodies", async () => {
    let claims = 0;
    const normalReply = fixture.reply;
    fixture.reply = (query) => {
      if (query.kind === "update" && query.table === notificationJobs) return ++claims === 1 ? [{ id: "illustration-job", recipientChatId: "123456", message: "Illustration message" }] : undefined;
      return normalReply(query);
    };
    env.fetchBoundary.mockRejectedValue(new Error(`Illustration Telegram error ${env.botToken}`));
    await sendNotificationJobs(["illustration-job"]);
    const updates = fixture.queries("update", notificationJobs);
    expect(updates.length).toBe(2);
    expect(renderSql(updates[0].where).params).toEqual(["illustration-job", "pending", "failed"]);
    expect(renderSql(updates[0].set?.attempts as SQL).sql).toContain('"notification_jobs"."attempts" + 1');
    expect(updates[1].set).toEqual({ status: "failed", sentAt: null, lastError: "TELEGRAM_DELIVERY_FAILED" });
    expect(vi.mocked(console.error).mock.calls.some((args) => JSON.stringify(args).includes(env.botToken))).toBe(false);
  });

  it("does not send a job when the conditional claim returns no row", async () => {
    const normalReply = fixture.reply;
    fixture.reply = (query) => query.kind === "update" && query.table === notificationJobs ? [] : normalReply(query);
    await sendNotificationJobs(["already-sent-job"]);
    expect(env.fetchBoundary.mock.calls.length).toBe(0);
    expect(fixture.queries("update", notificationJobs).length).toBe(1);
  });
});
