import { NextRequest, NextResponse } from "next/server";
import { ConfirmedNotificationSchema } from "@/lib/validation/schemas";
import { apiError, readJson, requireSameOrigin } from "@/lib/security/api";
import { requireSession } from "@/lib/security/session";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import { queueConfirmedNotifications } from "@/lib/telegram/notifications";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  try {
    requireSameOrigin(req);
    const session = await requireSession(req);
    const { txHash } = await readJson(req, ConfirmedNotificationSchema);
    await enforceRateLimit(req, "notifications:confirmed", 30, 60, session.walletAddress);
    const queued = await queueConfirmedNotifications(txHash, session.walletAddress);
    return NextResponse.json({ verified: true, queued, txHash }, { status: 202, headers: { "Cache-Control": "no-store" } });
  } catch (error) { return apiError(error); }
}
