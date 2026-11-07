import "server-only";
import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";
import { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { rateLimits } from "@/lib/db/schema";
import { ApiError } from "./api";

export async function enforceRateLimit(req: NextRequest, route: string, limit: number, seconds = 60, wallet?: string) {
  const secret = process.env.RATE_LIMIT_SECRET;
  if (!secret || secret.length < 32) throw new ApiError(503, "Rate limiting is not configured", "CONFIGURATION_REQUIRED");
  // Only Vercel's sanitized forwarding header is trusted; other hosts share a route bucket.
  const ip = process.env.VERCEL === "1" ? req.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim() : undefined;
  const key = createHmac("sha256", secret).update(`${route}:${wallet?.toLowerCase() || ip || "shared"}`).digest("hex");
  const [bucket] = await db.insert(rateLimits).values({ key, count: 1, expiresAt: new Date(Date.now() + seconds * 1000) })
    .onConflictDoUpdate({ target: rateLimits.key, set: {
      count: sql`case when ${rateLimits.expiresAt} <= now() then 1 else least(${rateLimits.count} + 1, ${limit + 1}) end`,
      expiresAt: sql`case when ${rateLimits.expiresAt} <= now() then now() + ${seconds} * interval '1 second' else ${rateLimits.expiresAt} end`,
    } }).returning();
  if (!bucket) throw new ApiError(503, "Rate limiting is unavailable", "SERVICE_UNAVAILABLE");
  if (bucket.count > limit) throw new ApiError(429, "Too many requests; try again shortly", "RATE_LIMITED", Math.max(1, Math.ceil((bucket.expiresAt.getTime() - Date.now()) / 1000)));
}
