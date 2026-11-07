import "server-only";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

export class ApiError extends Error {
  constructor(public status: number, message: string, public code = "REQUEST_FAILED", public retryAfter?: number) {
    super(message);
  }
}

export function apiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message, code: error.code }, {
      status: error.status,
      headers: { "Cache-Control": "no-store", ...(error.retryAfter ? { "Retry-After": String(error.retryAfter) } : {}) },
    });
  }
  if (error instanceof z.ZodError) {
    return NextResponse.json({ error: "Invalid request", code: "VALIDATION_FAILED", details: error.flatten().fieldErrors }, { status: 400 });
  }
  console.error("Pactora request failed", { code: "SERVICE_UNAVAILABLE" });
  return NextResponse.json({ error: "Service temporarily unavailable", code: "SERVICE_UNAVAILABLE" }, { status: 503 });
}

export function getAppUrl(): string {
  const configured = process.env.APP_URL;
  if (!configured) throw new ApiError(503, "Application URL is not configured", "CONFIGURATION_REQUIRED");
  let url: URL;
  try { url = new URL(configured); } catch { throw new ApiError(503, "Application URL is invalid", "CONFIGURATION_REQUIRED"); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new ApiError(503, "Application URL is invalid", "CONFIGURATION_REQUIRED");
  }
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") {
    throw new ApiError(503, "Production application URL must use HTTPS", "CONFIGURATION_REQUIRED");
  }
  return url.origin;
}

export function requireSameOrigin(req: NextRequest): string {
  const origin = req.headers.get("origin");
  const expected = getAppUrl();
  const allowed = origin === expected || (process.env.NODE_ENV !== "production" && origin === req.nextUrl.origin);
  if (!allowed) throw new ApiError(403, "Request origin is not allowed", "ORIGIN_NOT_ALLOWED");
  return origin!;
}

export async function readJson<T extends z.ZodTypeAny>(req: NextRequest, schema: T): Promise<z.infer<T>> {
  const limit = 65_536;
  if (!req.headers.get("content-type")?.toLowerCase().startsWith("application/json")) {
    throw new ApiError(415, "Use application/json", "UNSUPPORTED_MEDIA_TYPE");
  }
  if (Number(req.headers.get("content-length")) > limit) throw new ApiError(413, "Request body is too large", "BODY_TOO_LARGE");
  const reader = req.body?.getReader();
  if (!reader) throw new ApiError(400, "JSON body is required", "INVALID_JSON");
  const decoder = new TextDecoder();
  let size = 0;
  let text = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel();
        throw new ApiError(413, "Request body is too large", "BODY_TOO_LARGE");
      }
      text += decoder.decode(value, { stream: true });
    }
    text += decoder.decode();
  } finally { reader.releaseLock(); }
  let body: unknown;
  try { body = JSON.parse(text); } catch { throw new ApiError(400, "Invalid JSON body", "INVALID_JSON"); }
  return schema.parse(body);
}
