// @vitest-environment node
import { createHmac } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiError, getAppUrl, readJson, requireSameOrigin } from "@/lib/security/api";
import { requireSession, SESSION_COOKIE, setSessionCookie } from "@/lib/security/session";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { hashToken } from "@/lib/security/crypto";
import { NonceRequestSchema } from "@/lib/validation/schemas";
import { rateLimits, users, walletSessions } from "@/lib/db/schema";
import { illustrateDatabase, installIllustrationEnvironment, mixedCase, NOW, ORIGIN, renderSql, request, restoreIllustrationEnvironment, WALLET } from "./fixtures";

const boundary = vi.hoisted(() => ({ db: { select: vi.fn(), insert: vi.fn(), update: vi.fn(), delete: vi.fn(), transaction: vi.fn() } }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", () => ({ db: boundary.db }));

// Illustration fixtures only. SQL rendering and supplied result rows are not DB concurrency tests.
describe("Defensive security boundaries (Illustration fixtures)", () => {
  let env: ReturnType<typeof installIllustrationEnvironment>;
  let fixture: ReturnType<typeof illustrateDatabase>;
  beforeEach(() => {
    env = installIllustrationEnvironment();
    fixture = illustrateDatabase(boundary.db);
  });
  afterEach(restoreIllustrationEnvironment);

  it("requires the exact configured production origin, not missing or lookalike origins", () => {
    vi.stubEnv("NODE_ENV", "production");
    expect(requireSameOrigin(request("/api/auth/nonce", {}))).toBe(ORIGIN);
    for (const origin of ["", "https://pactora.test.attacker.test", "https://other.test"]) {
      const req = request("/api/auth/nonce", {}, { origin });
      if (!origin) req.headers.delete("origin");
      expect(() => requireSameOrigin(req)).toThrow(expect.objectContaining({ status: 403, code: "ORIGIN_NOT_ALLOWED" }));
    }
  });

  it("allows a local request origin only outside production", () => {
    const req = new NextRequest("http://localhost:3000/api/auth/nonce", { headers: { origin: "http://localhost:3000" } });
    expect(requireSameOrigin(req)).toBe("http://localhost:3000");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => requireSameOrigin(req)).toThrow(expect.objectContaining({ code: "ORIGIN_NOT_ALLOWED" }));
  });

  it("fails closed for missing configuration and non-HTTPS production URLs", () => {
    vi.stubEnv("APP_URL", undefined);
    expect(() => getAppUrl()).toThrow(expect.objectContaining({ status: 503, code: "CONFIGURATION_REQUIRED" }));
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("APP_URL", "http://pactora.test");
    expect(() => getAppUrl()).toThrow(expect.objectContaining({ status: 503, code: "CONFIGURATION_REQUIRED" }));
  });

  it("parses JSON with real schema normalization and rejects client-added fields", async () => {
    const body = await readJson(request("/api/auth/nonce", { walletAddress: mixedCase(WALLET) }), NonceRequestSchema);
    expect(body.walletAddress).toBe(WALLET);
    const response = apiError(await readJson(request("/api/auth/nonce", { walletAddress: WALLET, authenticated: true }), NonceRequestSchema).catch((error) => error));
    expect(response.status).toBe(400);
    expect((await response.json()).code).toBe("VALIDATION_FAILED");
  });

  it.each([
    { type: "text/plain", text: "{}", status: 415, code: "UNSUPPORTED_MEDIA_TYPE" },
    { type: "application/json", text: "{", status: 400, code: "INVALID_JSON" },
  ])("rejects $code before schema handling", async ({ type, text, status, code }) => {
    const req = new NextRequest(`${ORIGIN}/api/auth/nonce`, { method: "POST", headers: { "content-type": type }, body: text });
    await expect(readJson(req, NonceRequestSchema)).rejects.toMatchObject({ status, code });
  });

  it("limits actual streamed bytes even without a content-length header", async () => {
    const req = new NextRequest(`${ORIGIN}/api/auth/nonce`, { method: "POST", headers: { "content-type": "application/json" }, body: "x".repeat(65_537) });
    await expect(readJson(req, NonceRequestSchema)).rejects.toMatchObject({ status: 413, code: "BODY_TOO_LARGE" });
  });

  it("rejects an oversized declared body before reading it", async () => {
    await expect(readJson(request("/api/auth/nonce", {}, { "content-length": "65537" }), NonceRequestSchema)).rejects.toMatchObject({ status: 413, code: "BODY_TOO_LARGE" });
  });

  it("returns structured retry errors and never exposes unexpected errors in bodies or logs", async () => {
    const limited = apiError(new ApiError(429, "Try later", "RATE_LIMITED", 7));
    expect(limited.headers.get("retry-after")).toBe("7");
    expect(limited.headers.get("cache-control")).toBe("no-store");
    const response = apiError(new Error(`Illustration sensitive failure ${env.botToken}`));
    expect(response.status).toBe(503);
    const body = await response.json();
    expect(JSON.stringify(body).includes(env.botToken)).toBe(false);
    expect(body).toEqual({ error: "Service temporarily unavailable", code: "SERVICE_UNAVAILABLE" });
    expect(vi.mocked(console.error).mock.calls.some((args) => JSON.stringify(args).includes(env.botToken))).toBe(false);
    expect(vi.mocked(console.error).mock.calls[0]).toEqual(["Pactora request failed", { code: "SERVICE_UNAVAILABLE" }]);
  });

  it("looks up a session by its hash, requires database expiry, and normalizes the wallet", async () => {
    const session = await requireSession(request("/api/auth/session", undefined, { cookie: `${SESSION_COOKIE}=${env.sessionToken}` }));
    expect(session.walletAddress).toBe(WALLET);
    const query = fixture.queries("select", walletSessions)[0];
    const where = renderSql(query.where);
    expect(where.sql).toContain('"wallet_sessions"."token_hash" = $1');
    expect(where.sql).toContain('"wallet_sessions"."expires_at" > now()');
    expect(where.params[0] === hashToken(env.sessionToken)).toBe(true);
    expect(query.joins[0].table === users).toBe(true);
  });

  it("rejects missing or malformed session cookies without a database lookup", async () => {
    for (const cookie of ["", `${SESSION_COOKIE}=invalid`, `${SESSION_COOKIE}=${env.sessionToken.toUpperCase()}`]) {
      await expect(requireSession(request("/api/auth/session", undefined, { cookie }))).rejects.toMatchObject({ status: 401, code: "AUTHENTICATION_REQUIRED" });
    }
    expect(boundary.db.select.mock.calls.length).toBe(0);
  });

  it("rejects missing or expired stored sessions when the conditional lookup returns no row", async () => {
    fixture.reply = () => [];
    await expect(requireSession(request("/api/auth/session", undefined, { cookie: `${SESSION_COOKIE}=${env.sessionToken}` }))).rejects.toMatchObject({ status: 401, code: "AUTHENTICATION_REQUIRED" });
  });

  it.each(["production", "test"])("sets HttpOnly, SameSite, path, lifetime and no-store cookies in %s", (mode) => {
    vi.stubEnv("NODE_ENV", mode);
    const response = setSessionCookie(NextResponse.json({ authenticated: true }), env.sessionToken);
    const cookie = response.headers.get("set-cookie") || "";
    expect(cookie.includes("HttpOnly")).toBe(true);
    expect(cookie.includes("SameSite=lax")).toBe(true);
    expect(cookie.includes("Path=/")).toBe(true);
    expect(cookie.includes("Max-Age=86400")).toBe(true);
    expect(cookie.includes("Secure")).toBe(mode === "production");
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  it("HMACs a normalized wallet bucket and renders capped, expiring UPSERT expressions", async () => {
    await enforceRateLimit(request("/api/telegram/link"), "telegram:link", 5, 90, mixedCase(WALLET));
    const query = fixture.queries("insert", rateLimits)[0];
    const expectedKey = createHmac("sha256", env.rateSecret).update(`telegram:link:${WALLET}`).digest("hex");
    expect(query.values?.key === expectedKey).toBe(true);
    expect(query.values?.count).toBe(1);
    expect((query.values?.expiresAt as Date).getTime()).toBe(NOW.getTime() + 90_000);
    expect(query.conflict?.target === rateLimits.key).toBe(true);
    const count = renderSql(query.conflict?.set?.count);
    const expiry = renderSql(query.conflict?.set?.expiresAt);
    expect(count.sql).toContain('case when "rate_limits"."expires_at" <= now() then 1 else least("rate_limits"."count" + 1, $1) end');
    expect(count.params).toEqual([6]);
    expect(expiry.sql).toContain("now() + $1 * interval '1 second'");
    expect(expiry.sql).toContain('else "rate_limits"."expires_at" end');
    expect(expiry.params).toEqual([90]);
  });

  it("ignores untrusted forwarding headers and uses only the sanitized Vercel header on Vercel", async () => {
    const req = request("/api/auth/nonce", undefined, { "x-forwarded-for": "192.0.2.10", "x-real-ip": "192.0.2.11", "x-vercel-forwarded-for": "192.0.2.12, 192.0.2.13" });
    await enforceRateLimit(req, "auth:nonce", 10);
    vi.stubEnv("VERCEL", "1");
    await enforceRateLimit(req, "auth:nonce", 10);
    const queries = fixture.queries("insert", rateLimits);
    const key = (identity: string) => createHmac("sha256", env.rateSecret).update(`auth:nonce:${identity}`).digest("hex");
    expect(queries[0].values?.key === key("shared")).toBe(true);
    expect(queries[1].values?.key === key("192.0.2.12")).toBe(true);
  });

  it("permits the limit and returns the stored bucket's retry delay only above the limit", async () => {
    fixture.reply = () => [{ count: 5, expiresAt: new Date(NOW.getTime() + 2_100) }];
    await expect(enforceRateLimit(request("/api/test"), "fixture", 5)).resolves.toBeUndefined();
    fixture.reply = () => [{ count: 6, expiresAt: new Date(NOW.getTime() + 2_100) }];
    await expect(enforceRateLimit(request("/api/test"), "fixture", 5)).rejects.toMatchObject({ status: 429, code: "RATE_LIMITED", retryAfter: 3 });
  });

  it("does not bypass rate limiting on missing configuration, missing rows or DB errors", async () => {
    vi.stubEnv("RATE_LIMIT_SECRET", undefined);
    await expect(enforceRateLimit(request("/api/test"), "fixture", 5)).rejects.toMatchObject({ status: 503, code: "CONFIGURATION_REQUIRED" });
    expect(boundary.db.insert.mock.calls.length).toBe(0);
    vi.stubEnv("RATE_LIMIT_SECRET", env.rateSecret);
    fixture.reply = () => [];
    await expect(enforceRateLimit(request("/api/test"), "fixture", 5)).rejects.toMatchObject({ status: 503, code: "SERVICE_UNAVAILABLE" });
    fixture.reply = () => { throw new Error("Illustration DB unavailable"); };
    await expect(enforceRateLimit(request("/api/test"), "fixture", 5)).rejects.toThrow("Illustration DB unavailable");
  });
});
