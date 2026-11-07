// @vitest-environment node
import { randomBytes } from "node:crypto";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as noncePost } from "@/app/api/auth/nonce/route";
import { POST as verifyPost } from "@/app/api/auth/verify/route";
import { GET as sessionGet } from "@/app/api/auth/session/route";
import { POST as logoutPost } from "@/app/api/auth/logout/route";
import { authNonces, users, walletSessions } from "@/lib/db/schema";
import { createAuthMessage, hashToken } from "@/lib/security/crypto";
import { SESSION_COOKIE } from "@/lib/security/session";
import { defaultDbReply, illustrateDatabase, installIllustrationEnvironment, mixedCase, NOW, ORIGIN, renderSql, request, restoreIllustrationEnvironment, USER_ID, WALLET } from "./fixtures";

const boundary = vi.hoisted(() => ({ db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn(), transaction: vi.fn() } }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: boundary.db }));

async function locallySignedBody(origin = ORIGIN) {
  // The private key exists only in memory and is never stored, hard-coded or logged.
  const account = privateKeyToAccount(generatePrivateKey());
  const nonce = randomBytes(32).toString("hex");
  const message = createAuthMessage(account.address, nonce, NOW.toISOString(), origin, new Date(NOW.getTime() + 300_000).toISOString());
  return { walletAddress: mixedCase(account.address), nonce, message, signature: await account.signMessage({ message }) };
}

// Illustration fixtures, not live authentication. Zero/one returned rows and SQL
// predicates are tested independently; no transaction rollback/concurrency is simulated.
describe("Wallet auth routes (Illustration fixtures)", () => {
  let env: ReturnType<typeof installIllustrationEnvironment>;
  let fixture: ReturnType<typeof illustrateDatabase>;
  beforeEach(() => {
    env = installIllustrationEnvironment();
    fixture = illustrateDatabase(boundary.db);
    fixture.reply = (query) => {
      if (query.kind === "insert" && query.table === authNonces) return undefined;
      if (query.kind === "update" && query.table === authNonces) return [{ id: "illustration-nonce" }];
      if (query.kind === "insert" && query.table === users) return [{ id: USER_ID }];
      if (query.kind === "insert" && query.table === walletSessions) return undefined;
      if (query.kind === "delete" && query.table === walletSessions) return undefined;
      return defaultDbReply(query);
    };
  });
  afterEach(restoreIllustrationEnvironment);

  it("persists a normalized five-minute nonce and an exact origin/chain/expiry signing message", async () => {
    const response = await noncePost(request("/api/auth/nonce", { walletAddress: mixedCase(WALLET) }));
    const body = await response.json();
    const stored = fixture.queries("insert", authNonces)[0].values!;
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(/^[0-9a-f]{64}$/.test(body.nonce)).toBe(true);
    expect(stored.walletAddress).toBe(WALLET);
    expect(stored.nonce === body.nonce).toBe(true);
    expect(stored.message === createAuthMessage(WALLET, body.nonce, NOW.toISOString(), ORIGIN, body.expiresAt)).toBe(true);
    expect(stored.consumed).toBe(false);
    expect((stored.expiresAt as Date).getTime()).toBe(NOW.getTime() + 300_000);
    expect(body.message.includes(`Origin: ${ORIGIN}\nChain ID: 31611\nExpires At: ${body.expiresAt}`)).toBe(true);
  });

  it("returns a safe 503 instead of an unpersisted nonce when insertion fails", async () => {
    const normalReply = fixture.reply;
    fixture.reply = (query) => {
      if (query.table === authNonces) throw new Error(`Illustration DB sensitive failure ${env.rateSecret}`);
      return normalReply(query);
    };
    const response = await noncePost(request("/api/auth/nonce", { walletAddress: WALLET }));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(JSON.stringify(body).includes(env.rateSecret)).toBe(false);
    expect(body).toEqual({ error: "Service temporarily unavailable", code: "SERVICE_UNAVAILABLE" });
    expect(response.headers.has("set-cookie")).toBe(false);
    expect(vi.mocked(console.error).mock.calls.some((args) => JSON.stringify(args).includes(env.rateSecret))).toBe(false);
  });

  it("rejects invalid nonce requests before any database access", async () => {
    for (const body of [{ walletAddress: "0x0000000000000000000000000000000000000000" }, { walletAddress: WALLET, success: true }]) {
      const response = await noncePost(request("/api/auth/nonce", body));
      expect(response.status).toBe(400);
    }
    expect(boundary.db.insert.mock.calls.length).toBe(0);
  });

  it("authenticates a real local signature only after exactly one conditional nonce consumption", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const body = await locallySignedBody();
    const response = await verifyPost(request("/api/auth/verify", body));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ success: true, authenticated: true, walletAddress: body.walletAddress.toLowerCase() });
    expect(boundary.db.transaction.mock.calls.length).toBe(1);
    const consumed = fixture.queries("update", authNonces)[0];
    expect(consumed.set).toEqual({ consumed: true });
    const where = renderSql(consumed.where);
    expect(where.sql).toContain('"auth_nonces"."nonce" = $1');
    expect(where.sql).toContain('"auth_nonces"."wallet_address" = $2');
    expect(where.sql).toContain('"auth_nonces"."message" = $3');
    expect(where.sql).toContain('"auth_nonces"."consumed" = $4');
    expect(where.sql).toContain('"auth_nonces"."expires_at" > now()');
    expect(where.params[0] === body.nonce && where.params[1] === body.walletAddress.toLowerCase() && where.params[2] === body.message && where.params[3] === false).toBe(true);
    expect(fixture.queries("select", authNonces).length).toBe(0);
    expect(fixture.queries("insert", users)[0].values?.walletAddress).toBe(body.walletAddress.toLowerCase());
    const token = response.cookies.get(SESSION_COOKIE)?.value || "";
    const stored = fixture.queries("insert", walletSessions)[0].values!;
    expect(/^[0-9a-f]{64}$/.test(token)).toBe(true);
    expect(stored.tokenHash === hashToken(token) && stored.tokenHash !== token).toBe(true);
    expect(stored.userId).toBe(USER_ID);
    expect((stored.expiresAt as Date).getTime()).toBe(NOW.getTime() + 86400_000);
    expect((response.headers.get("set-cookie") || "").includes("Secure")).toBe(true);
  });

  it("rejects unknown, expired or mismatched stored nonces when the conditional UPDATE returns zero rows", async () => {
    const normalReply = fixture.reply;
    fixture.reply = (query) => query.kind === "update" && query.table === authNonces ? [] : normalReply(query);
    const response = await verifyPost(request("/api/auth/verify", await locallySignedBody()));
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("INVALID_NONCE");
    expect(response.headers.has("set-cookie")).toBe(false);
    expect(fixture.queries("insert", users).length + fixture.queries("insert", walletSessions).length).toBe(0);
    const where = renderSql(fixture.queries("update", authNonces)[0].where);
    // The expiry and consumed conditions exclude expired/reused records in the real DB;
    // the supplied zero-row result illustrates rejection, not a SQL engine simulation.
    expect(where.sql).toContain('"auth_nonces"."expires_at" > now()');
    expect(where.sql).toContain('"auth_nonces"."consumed" = $4');
    expect(where.params[3]).toBe(false);
  });

  it("rejects replay after the first successful single-use result without creating another session", async () => {
    const normalReply = fixture.reply;
    let consumes = 0;
    fixture.reply = (query) => query.kind === "update" && query.table === authNonces ? (++consumes === 1 ? [{ id: "illustration-nonce" }] : []) : normalReply(query);
    const body = await locallySignedBody();
    expect((await verifyPost(request("/api/auth/verify", body))).status).toBe(200);
    const replay = await verifyPost(request("/api/auth/verify", body));
    expect(replay.status).toBe(401);
    expect((await replay.json()).code).toBe("INVALID_NONCE");
    expect(replay.headers.has("set-cookie")).toBe(false);
    expect(fixture.queries("insert", walletSessions).length).toBe(1);
  });

  it("does not authenticate an unexpected multiple-row consumption result", async () => {
    const normalReply = fixture.reply;
    fixture.reply = (query) => query.kind === "update" && query.table === authNonces ? [{ id: "one" }, { id: "two" }] : normalReply(query);
    const response = await verifyPost(request("/api/auth/verify", await locallySignedBody()));
    expect(response.status).toBe(401);
    expect(fixture.queries("insert", users).length).toBe(0);
    expect(response.headers.has("set-cookie")).toBe(false);
  });

  it("rejects a locally valid signature for a different wallet before consuming any nonce", async () => {
    const body = await locallySignedBody();
    const otherAccount = privateKeyToAccount(generatePrivateKey());
    body.signature = await otherAccount.signMessage({ message: body.message });
    const response = await verifyPost(request("/api/auth/verify", body));
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("INVALID_SIGNATURE");
    expect(boundary.db.transaction.mock.calls.length).toBe(0);
  });

  it("rejects a locally signed message for a different application origin", async () => {
    const response = await verifyPost(request("/api/auth/verify", await locallySignedBody("https://other.test")));
    expect(response.status).toBe(401);
    expect((await response.json()).code).toBe("INVALID_SIGNATURE");
    expect(boundary.db.transaction.mock.calls.length).toBe(0);
  });

  it("rejects truncated signature bodies and cross-origin requests before nonce access", async () => {
    const body = await locallySignedBody();
    const invalid = await verifyPost(request("/api/auth/verify", { ...body, signature: body.signature.slice(0, -2) }));
    expect(invalid.status).toBe(400);
    const foreign = await verifyPost(request("/api/auth/verify", body, { origin: "https://other.test" }));
    expect(foreign.status).toBe(403);
    expect(boundary.db.transaction.mock.calls.length).toBe(0);
  });

  it.each(["transaction", "nonce update", "session insert"])("never falls back to auth success after an Illustration %s failure", async (stage) => {
    const failure = new Error(`Illustration sensitive DB failure ${env.botToken}`);
    if (stage === "transaction") boundary.db.transaction.mockRejectedValue(failure);
    else {
      const normalReply = fixture.reply;
      fixture.reply = (query) => {
        if ((stage === "nonce update" && query.kind === "update" && query.table === authNonces) || (stage === "session insert" && query.kind === "insert" && query.table === walletSessions)) throw failure;
        return normalReply(query);
      };
    }
    const response = await verifyPost(request("/api/auth/verify", await locallySignedBody()));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(JSON.stringify(body).includes(env.botToken)).toBe(false);
    expect(body).toEqual({ error: "Service temporarily unavailable", code: "SERVICE_UNAVAILABLE" });
    expect(response.headers.has("set-cookie")).toBe(false);
    expect(vi.mocked(console.error).mock.calls.some((args) => JSON.stringify(args).includes(env.botToken))).toBe(false);
  });

  it("requires a returned user before session insertion", async () => {
    const normalReply = fixture.reply;
    fixture.reply = (query) => query.kind === "insert" && query.table === users ? [] : normalReply(query);
    const response = await verifyPost(request("/api/auth/verify", await locallySignedBody()));
    expect(response.status).toBe(503);
    expect(fixture.queries("insert", walletSessions).length).toBe(0);
    expect(response.headers.has("set-cookie")).toBe(false);
  });

  it("exposes only normalized authenticated session state with no-store", async () => {
    const response = await sessionGet(request("/api/auth/session", undefined, { cookie: `${SESSION_COOKIE}=${env.sessionToken}` }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ authenticated: true, walletAddress: WALLET, expiresAt: new Date(NOW.getTime() + 86400_000).toISOString() });
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("does not accept a wallet query as a replacement for a session", async () => {
    expect((await sessionGet(request(`/api/auth/session?wallet=${WALLET}`))).status).toBe(400);
    expect((await sessionGet(request("/api/auth/session"))).status).toBe(401);
    expect(boundary.db.select.mock.calls.length).toBe(0);
  });

  it("returns a safe service error when session lookup fails", async () => {
    fixture.reply = () => { throw new Error(`Illustration lookup failure ${env.rateSecret}`); };
    const response = await sessionGet(request("/api/auth/session", undefined, { cookie: `${SESSION_COOKIE}=${env.sessionToken}` }));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(JSON.stringify(body).includes(env.rateSecret)).toBe(false);
    expect(body).toEqual({ error: "Service temporarily unavailable", code: "SERVICE_UNAVAILABLE" });
  });

  it("revokes only the hashed session and expires the protected cookie on logout", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = await logoutPost(request("/api/auth/logout", {}, { cookie: `${SESSION_COOKIE}=${env.sessionToken}` }));
    expect(response.status).toBe(200);
    const where = renderSql(fixture.queries("delete", walletSessions)[0].where);
    expect(where.sql).toContain('"wallet_sessions"."token_hash" = $1');
    expect(where.params[0] === hashToken(env.sessionToken)).toBe(true);
    const cookie = response.headers.get("set-cookie") || "";
    expect(cookie.includes("Max-Age=0") && cookie.includes("HttpOnly") && cookie.includes("Secure") && cookie.includes("SameSite=lax")).toBe(true);
    expect(response.cookies.get(SESSION_COOKIE)?.value === "").toBe(true);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("keeps logout idempotent without a token but rejects foreign origins before deleting", async () => {
    expect((await logoutPost(request("/api/auth/logout", {}))).status).toBe(200);
    const foreign = await logoutPost(request("/api/auth/logout", {}, { cookie: `${SESSION_COOKIE}=${env.sessionToken}`, origin: "https://other.test" }));
    expect(foreign.status).toBe(403);
    expect(boundary.db.delete.mock.calls.length).toBe(0);
    expect(foreign.headers.has("set-cookie")).toBe(false);
  });
});
