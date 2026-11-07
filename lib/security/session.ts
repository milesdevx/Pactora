import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { and, eq, gt, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { users, walletSessions } from "@/lib/db/schema";
import { hashToken } from "./crypto";
import { ApiError } from "./api";

export const SESSION_COOKIE = "pactora_session";
export const SESSION_SECONDS = 24 * 60 * 60;

export function sessionToken(req: NextRequest): string | undefined {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  return token && /^[0-9a-f]{64}$/.test(token) ? token : undefined;
}

export async function requireSession(req: NextRequest) {
  const token = sessionToken(req);
  if (!token) throw new ApiError(401, "Sign in with your wallet", "AUTHENTICATION_REQUIRED");
  const [session] = await db.select({ userId: users.id, walletAddress: users.walletAddress, expiresAt: walletSessions.expiresAt })
    .from(walletSessions).innerJoin(users, eq(walletSessions.userId, users.id))
    .where(and(eq(walletSessions.tokenHash, hashToken(token)), gt(walletSessions.expiresAt, sql`now()`))).limit(1);
  if (!session) throw new ApiError(401, "Wallet session expired; sign in again", "AUTHENTICATION_REQUIRED");
  return { ...session, walletAddress: session.walletAddress.toLowerCase() as `0x${string}` };
}

export function setSessionCookie(response: NextResponse, token: string, maxAge = SESSION_SECONDS) {
  response.cookies.set(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge });
  response.headers.set("Cache-Control", "no-store");
  return response;
}
