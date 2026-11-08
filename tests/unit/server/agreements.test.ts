// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET as listGet, POST as createPost } from "@/app/api/agreements/route";
import { GET as detailGet } from "@/app/api/agreements/[id]/route";
import { agreementMetadata, notificationJobs } from "@/lib/db/schema";
import { hashAgreementTerms } from "@/lib/chain/terms";
import { SESSION_COOKIE } from "@/lib/security/session";
import { defaultDbReply, ESCROW, illustrateDatabase, installIllustrationEnvironment, mixedCase, MUSD, NOW, PROVIDER, renderSql, request, restoreIllustrationEnvironment, TX_HASH, WALLET } from "./fixtures";
import { creationLog, illustrateRpc, receipt } from "./rpc-fixtures";

const boundary = vi.hoisted(() => ({
  db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn(), transaction: vi.fn() },
  rpc: { getChainId: vi.fn(), getBlockNumber: vi.fn(), getTransactionReceipt: vi.fn(), readContract: vi.fn() },
}));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: boundary.db }));
vi.mock("viem", async (original) => ({ ...await original<typeof import("viem")>(), createPublicClient: () => boundary.rpc }));
vi.mock("@/lib/chain/mezo", async () => (await import("./rpc-fixtures")).chainConfig);

function agreementInput() {
  const terms = {
    onChainId: 1, title: "Illustration agreement", description: "Local route fixture only",
    creationTxHash: TX_HASH, clientAddress: WALLET, providerAddress: PROVIDER,
    tokenAddress: MUSD, totalAmount: "1.0",
    milestoneDetails: [{ title: "Delivery", description: "Illustration", amount: "1.0", deliveryDeadline: NOW.getTime() / 1000 + 86400 }],
  };
  return { ...terms, termsHash: hashAgreementTerms(terms) };
}

// Illustration fixtures, not live chain ownership, metadata or receipt verification.
// Shared terms hashing is used to build input; its own tests belong to the coordinator.
describe("Agreement route ownership and immutable metadata (Illustration fixtures)", () => {
  let env: ReturnType<typeof installIllustrationEnvironment>;
  let fixture: ReturnType<typeof illustrateDatabase>;
  let chain: ReturnType<typeof illustrateRpc>;
  let body: ReturnType<typeof agreementInput>;
  beforeEach(() => {
    env = installIllustrationEnvironment();
    body = agreementInput();
    chain = illustrateRpc(boundary.rpc);
    chain.agreement.termsHash = body.termsHash;
    boundary.rpc.getTransactionReceipt.mockResolvedValue(receipt([creationLog(ESCROW, 1n, 0, body.termsHash)]));
    fixture = illustrateDatabase(boundary.db);
    fixture.reply = (query) => {
      if (query.kind === "select" && query.table === agreementMetadata) return [{ ...body, escrowAddress: ESCROW, chainVerified: true }];
      if (query.kind === "insert" && query.table === agreementMetadata) return [{ ...query.values, id: "illustration-metadata" }];
      return defaultDbReply(query);
    };
  });
  afterEach(restoreIllustrationEnvironment);
  const authHeaders = () => ({ cookie: `${SESSION_COOKIE}=${env.sessionToken}` });
  const params = (id = "1") => ({ params: Promise.resolve({ id }) });

  it("uses the normalized signed wallet for list access and rejects a caller-selected other wallet", async () => {
    const mismatch = await listGet(request(`/api/agreements?wallet=${PROVIDER}`, undefined, authHeaders()));
    expect(mismatch.status).toBe(403);
    expect((await mismatch.json()).code).toBe("WALLET_MISMATCH");
    expect(fixture.queries("select", agreementMetadata).length).toBe(0);
    const normalReply = fixture.reply;
    fixture.reply = (query) => query.table === agreementMetadata ? [] : normalReply(query);
    const response = await listGet(request(`/api/agreements?wallet=${mixedCase(WALLET)}`, undefined, authHeaders()));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ agreements: [] });
    const where = renderSql(fixture.queries("select", agreementMetadata)[0].where);
    expect(where.sql).toContain('"agreement_metadata"."chain_verified" = $1');
    expect(where.params).toEqual([true, ESCROW, WALLET, WALLET]);
  });

  it("does not treat a wallet parameter as authentication", async () => {
    expect((await listGet(request(`/api/agreements?wallet=${WALLET}`))).status).toBe(401);
    expect(boundary.rpc.readContract.mock.calls.length).toBe(0);
    expect(fixture.queries("select", agreementMetadata).length).toBe(0);
  });

  it("rejects invalid IDs before session, RPC or metadata lookups", async () => {
    for (const id of ["0", "01", "2147483648"]) expect((await detailGet(request(`/api/agreements/${id}`, undefined, authHeaders()), params(id))).status).toBe(400);
    expect(boundary.db.select.mock.calls.length).toBe(0);
    expect(boundary.rpc.readContract.mock.calls.length).toBe(0);
  });

  it("returns not-found for agreements outside the signed wallet's on-chain parties", async () => {
    chain.agreement.client = MUSD;
    chain.agreement.provider = ESCROW;
    const response = await detailGet(request("/api/agreements/1", undefined, authHeaders()), params());
    expect(response.status).toBe(404);
    expect((await response.json()).code).toBe("AGREEMENT_NOT_FOUND");
    expect(fixture.queries("select", agreementMetadata).length).toBe(0);
  });

  it("selects only verified metadata for the current escrow and preserves committed amount strings", async () => {
    const response = await detailGet(request("/api/agreements/1", undefined, authHeaders()), params());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect((await response.json()).agreement.milestoneDetails[0].amount).toBe("1.0");
    const where = renderSql(fixture.queries("select", agreementMetadata)[0].where);
    expect(where.params).toEqual([1, ESCROW, true]);
  });

  it("does not present missing or poisoned metadata as verified terms", async () => {
    const normalReply = fixture.reply;
    fixture.reply = (query) => query.table === agreementMetadata ? [] : normalReply(query);
    const missing = await detailGet(request("/api/agreements/1", undefined, authHeaders()), params());
    expect(missing.status).toBe(404);
    expect((await missing.json()).code).toBe("METADATA_NOT_FOUND");
    fixture.reply = (query) => query.table === agreementMetadata ? [{ ...body, title: "Poisoned Illustration terms" }] : normalReply(query);
    const poisoned = await detailGet(request("/api/agreements/1", undefined, authHeaders()), params());
    expect(poisoned.status).toBe(404);
    expect((await poisoned.json()).code).toBe("METADATA_NOT_VERIFIED");
  });

  it("validates required receipt/deadline fields and rejects client success flags before RPC", async () => {
    for (const invalid of [{ ...body, creationTxHash: undefined }, { ...body, milestoneDetails: [{ title: "Delivery", amount: "1" }] }, { ...body, success: true }]) {
      expect((await createPost(request("/api/agreements", invalid, authHeaders()))).status).toBe(400);
    }
    expect(boundary.rpc.readContract.mock.calls.length).toBe(0);
    expect(fixture.queries("insert", agreementMetadata).length).toBe(0);
  });

  it("rejects metadata registration for a different client before reading chain state", async () => {
    const response = await createPost(request("/api/agreements", { ...body, clientAddress: PROVIDER }, authHeaders()));
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("NOT_AGREEMENT_CLIENT");
    expect(boundary.rpc.readContract.mock.calls.length).toBe(0);
    expect(fixture.queries("insert", agreementMetadata).length).toBe(0);
  });

  it("requires a creation event for the exact requested agreement ID", async () => {
    boundary.rpc.getTransactionReceipt.mockResolvedValue(receipt([creationLog(ESCROW, 2n)]));
    const response = await createPost(request("/api/agreements", body, authHeaders()));
    expect(response.status).toBe(403);
    expect((await response.json()).code).toBe("INVALID_AGREEMENT_OWNER");
    expect(fixture.queries("insert", agreementMetadata).length).toBe(0);
  });

  it("rejects reverted creation receipts without persisting claimed metadata", async () => {
    boundary.rpc.getTransactionReceipt.mockResolvedValue(receipt([creationLog()], "reverted"));
    const response = await createPost(request("/api/agreements", body, authHeaders()));
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("TRANSACTION_REVERTED");
    expect(fixture.queries("insert", agreementMetadata).length).toBe(0);
  });

  it("requires chain-equal amounts instead of trusting client totals", async () => {
    chain.milestones[0].amount = 2n * 10n ** 18n;
    const response = await createPost(request("/api/agreements", body, authHeaders()));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("AMOUNT_MISMATCH");
    expect(fixture.queries("insert", agreementMetadata).length).toBe(0);
  });

  it("requires chain-equal deadlines independently of a client-chosen matching terms hash", async () => {
    chain.milestones[0].deliveryDeadline += 1n;
    const response = await createPost(request("/api/agreements", body, authHeaders()));
    expect(response.status).toBe(400);
    expect(fixture.queries("insert", agreementMetadata).length).toBe(0);
  });

  it("writes immutable verified metadata with the escrow-scoped partial unique conflict target", async () => {
    const response = await createPost(request("/api/agreements", { ...body, clientAddress: mixedCase(WALLET) }, authHeaders()));
    expect(response.status).toBe(201);
    expect(response.headers.get("cache-control")).toBe("no-store");
    const inserted = fixture.queries("insert", agreementMetadata)[0];
    expect(inserted.values?.chainVerified).toBe(true);
    expect(inserted.values?.escrowAddress).toBe(ESCROW);
    expect(inserted.values?.clientAddress).toBe(WALLET);
    expect((inserted.values?.milestoneDetails as typeof body.milestoneDetails)[0].amount).toBe("1.0");
    expect(inserted.conflictAction).toBe("nothing");
    const target = inserted.conflict?.target as unknown[];
    expect(target[0] === agreementMetadata.escrowAddress && target[1] === agreementMetadata.onChainId).toBe(true);
    expect(renderSql(inserted.conflict?.where).sql).toContain('"agreement_metadata"."chain_verified" = true');
    expect(fixture.queries("insert", notificationJobs).length).toBe(0);
    expect(env.fetchBoundary.mock.calls.length).toBe(0);
  });

  it("does not overwrite existing verified terms when insertion returns no row", async () => {
    const normalReply = fixture.reply;
    fixture.reply = (query) => query.kind === "insert" && query.table === agreementMetadata ? [] : normalReply(query);
    const response = await createPost(request("/api/agreements", body, authHeaders()));
    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("TERMS_ALREADY_REGISTERED");
    expect(boundary.db.update.mock.calls.length).toBe(0);
  });

  it("does not synthesize successful registration after a DB failure", async () => {
    const normalReply = fixture.reply;
    fixture.reply = (query) => { if (query.kind === "insert" && query.table === agreementMetadata) throw new Error(`Illustration DB failure ${env.rateSecret}`); return normalReply(query); };
    const response = await createPost(request("/api/agreements", body, authHeaders()));
    expect(response.status).toBe(503);
    const result = await response.json();
    expect(JSON.stringify(result).includes(env.rateSecret)).toBe(false);
    expect(result).toEqual({ error: "Service temporarily unavailable", code: "SERVICE_UNAVAILABLE" });
    expect(vi.mocked(console.error).mock.calls.some((args) => JSON.stringify(args).includes(env.rateSecret))).toBe(false);
  });
});
