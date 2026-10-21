import { NextRequest, NextResponse } from "next/server";
import { CreateAgreementSchema } from "@/lib/validation/schemas";
import { db } from "@/lib/db";
import { agreementMetadata, users, telegramLinks } from "@/lib/db/schema";
import { eq, or, desc } from "drizzle-orm";
import { sendTelegramMessage, TelegramNotifications } from "@/lib/telegram/bot";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const wallet = searchParams.get("wallet")?.toLowerCase();

    let query = db.select().from(agreementMetadata).orderBy(desc(agreementMetadata.createdAt));

    let results;
    if (wallet) {
      results = await query.where(
        or(
          eq(agreementMetadata.clientAddress, wallet),
          eq(agreementMetadata.providerAddress, wallet)
        )
      );
    } else {
      results = await query.limit(50);
    }

    return NextResponse.json({ agreements: results });
  } catch (err: any) {
    console.warn("Database unavailable or connection refused:", err?.code || err?.message);
    return NextResponse.json(
      {
        agreements: [],
        warning: "Database offline or connection refused. Configure a valid DATABASE_URL in .env.local to persist agreements.",
      },
      { status: 200 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const result = CreateAgreementSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json(
        { error: "Validation failed", details: result.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = result.data;
    let insertedRecord: any = data;

    // Insert metadata if database is available
    try {
      const inserted = await db
        .insert(agreementMetadata)
        .values({
          onChainId: data.onChainId,
          title: data.title,
          description: data.description,
          termsHash: data.termsHash,
          clientAddress: data.clientAddress.toLowerCase(),
          providerAddress: data.providerAddress.toLowerCase(),
          tokenAddress: data.tokenAddress.toLowerCase(),
          totalAmount: data.totalAmount,
          milestoneDetails: data.milestoneDetails,
        })
        .onConflictDoUpdate({
          target: agreementMetadata.onChainId,
          set: {
            title: data.title,
            description: data.description,
            totalAmount: data.totalAmount,
            milestoneDetails: data.milestoneDetails,
            updatedAt: new Date(),
          },
        })
        .returning();

      if (inserted && inserted[0]) {
        insertedRecord = inserted[0];
      }
    } catch (dbErr: any) {
      console.warn("Database offline. Skipping SQL insert:", dbErr?.code || dbErr?.message);
    }

    // Check if provider has linked Telegram and notify them
    try {
      const providerUser = (
        await db
          .select()
          .from(users)
          .where(eq(users.walletAddress, data.providerAddress.toLowerCase()))
          .limit(1)
      )[0];

      if (providerUser) {
        const link = (
          await db
            .select()
            .from(telegramLinks)
            .where(eq(telegramLinks.userId, providerUser.id))
            .limit(1)
        )[0];

        if (link && link.notificationsEnabled) {
          const notificationText = TelegramNotifications.agreementCreated(
            data.onChainId,
            data.title,
            data.totalAmount,
            `${data.clientAddress.slice(0, 6)}...${data.clientAddress.slice(-4)}`
          );
          await sendTelegramMessage(link.telegramChatId, notificationText);
        }
      }
    } catch (notifErr) {
      console.warn("Could not dispatch Telegram invite notification:", notifErr);
    }

    return NextResponse.json({ success: true, agreement: insertedRecord });
  } catch (err) {
    console.error("Error creating agreement metadata:", err);
    return NextResponse.json({ error: "Failed to store agreement metadata" }, { status: 500 });
  }
}

