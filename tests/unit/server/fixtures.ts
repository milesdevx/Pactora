import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { vi } from "vitest";
import { rateLimits, walletSessions } from "@/lib/db/schema";

// Illustration fixtures, never live verification. Supplied DB rows do not evaluate
// SQL predicates or emulate rollback, locking, or concurrent PostgreSQL transactions.
export const ORIGIN = "https://pactora.test";
export const NOW = new Date("2035-01-01T12:00:00.000Z");
export const WALLET = "0xabababababababababababababababababababab";
export const PROVIDER = "0xcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcdcd";
export const ESCROW = "0x2222222222222222222222222222222222222222";
export const MUSD = "0x3333333333333333333333333333333333333333";
export const TX_HASH = `0x${"71".repeat(32)}` as `0x${string}`;
export const USER_ID = "11111111-1111-4111-8111-111111111111";
export const mixedCase = (value: string): `0x${string}` => `0x${value.slice(2).toUpperCase()}`;

export function installIllustrationEnvironment() {
  const rateSecret = randomBytes(32).toString("hex");
  const webhookSecret = randomBytes(32).toString("hex");
  const botToken = randomBytes(32).toString("hex");
  const sessionToken = randomBytes(32).toString("hex");
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  vi.stubEnv("NODE_ENV", "test");
  vi.stubEnv("APP_URL", ORIGIN);
  vi.stubEnv("RATE_LIMIT_SECRET", rateSecret);
  vi.stubEnv("TELEGRAM_WEBHOOK_SECRET", webhookSecret);
  vi.stubEnv("TELEGRAM_BOT_TOKEN", botToken);
  vi.stubEnv("TELEGRAM_BOT_USERNAME", "PactoraIllustrationBot");
  vi.stubEnv("ALLOW_TEST_NOTIFICATIONS", undefined);
  vi.stubEnv("VERCEL", "0");
  const fetchBoundary = vi.fn<typeof fetch>().mockRejectedValue(new Error("Network disabled for Illustration fixtures"));
  vi.stubGlobal("fetch", fetchBoundary);
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "warn").mockImplementation(() => {});
  return { rateSecret, webhookSecret, botToken, sessionToken, fetchBoundary };
}

export function restoreIllustrationEnvironment() {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.useRealTimers();
}

export function request(path: string, body?: unknown, headers: Record<string, string> = {}) {
  return new NextRequest(`${ORIGIN}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { origin: ORIGIN, "content-type": "application/json", ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

export function sessionRow() {
  return { userId: USER_ID, walletAddress: mixedCase(WALLET), expiresAt: new Date(NOW.getTime() + 86400_000) };
}

type QueryKind = "select" | "insert" | "update" | "delete";
type Boundary = Record<QueryKind | "transaction", ReturnType<typeof vi.fn>>;
export type IllustrationQuery = {
  kind: QueryKind;
  table?: unknown;
  fields?: unknown;
  values?: Record<string, unknown>;
  set?: Record<string, unknown>;
  where?: SQL;
  conflict?: { target?: unknown; set?: Record<string, SQL>; where?: SQL };
  conflictAction?: "nothing" | "update";
  joins: { table: unknown; on: SQL }[];
};

export function defaultDbReply(query: IllustrationQuery): unknown {
  if (query.kind === "insert" && query.table === rateLimits) return [{ count: 1, expiresAt: new Date(NOW.getTime() + 60_000) }];
  if (query.kind === "select" && query.table === walletSessions) return [sessionRow()];
  throw new Error("Unexpected Illustration database boundary operation");
}

export function illustrateDatabase(db: Boundary) {
  const records: IllustrationQuery[] = [];
  const fixture = {
    records,
    reply: defaultDbReply as (query: IllustrationQuery) => unknown,
    queries: (kind: QueryKind, table: unknown) => records.filter((query) => query.kind === kind && query.table === table),
  };
  for (const kind of ["select", "insert", "update", "delete"] as const) {
    db[kind].mockReset().mockImplementation((tableOrFields?: unknown) => {
      const query: IllustrationQuery = { kind, joins: [], ...(kind === "select" ? { fields: tableOrFields } : { table: tableOrFields }) };
      records.push(query);
      const chain: Record<string, unknown> = {};
      for (const method of ["values", "set", "where"] as const) {
        chain[method] = (value: unknown) => { Object.assign(query, { [method]: value }); return chain; };
      }
      chain.from = (table: unknown) => { query.table = table; return chain; };
      chain.innerJoin = (table: unknown, on: SQL) => { query.joins.push({ table, on }); return chain; };
      for (const method of ["limit", "orderBy", "returning"]) chain[method] = () => chain;
      for (const [method, action] of [["onConflictDoNothing", "nothing"], ["onConflictDoUpdate", "update"]] as const) {
        chain[method] = (conflict: IllustrationQuery["conflict"]) => { query.conflict = conflict; query.conflictAction = action; return chain; };
      }
      chain.then = (resolve: (value: unknown) => unknown, reject: (error: unknown) => unknown) => Promise.resolve().then(() => fixture.reply(query)).then(resolve, reject);
      return chain;
    });
  }
  db.transaction.mockReset().mockImplementation((callback: (tx: Boundary) => unknown) => callback(db));
  return fixture;
}

export function renderSql(expression: SQL | undefined) {
  if (!expression) throw new Error("Missing Illustration SQL expression");
  return new PgDialect().sqlToQuery(expression);
}
