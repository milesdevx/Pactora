import { describe, it, expect } from "vitest";
import {
  NonceRequestSchema,
  VerifySignatureSchema,
  CreateAgreementSchema,
  TelegramWebhookUpdateSchema,
} from "@/lib/validation/schemas";

describe("API Validation Schemas", () => {
  it("validates valid and invalid wallet addresses for nonces", () => {
    const valid = NonceRequestSchema.safeParse({
      walletAddress: "0x1111111111111111111111111111111111111111",
    });
    expect(valid.success).toBe(true);

    const invalid = NonceRequestSchema.safeParse({
      walletAddress: "not-an-address",
    });
    expect(invalid.success).toBe(false);
  });

  it("validates signature verification body", () => {
    const valid = VerifySignatureSchema.safeParse({
      walletAddress: "0x2222222222222222222222222222222222222222",
      signature: "0xabcdef1234567890abcdef1234567890",
      nonce: "1234567890123456",
    });
    expect(valid.success).toBe(true);

    const invalidSig = VerifySignatureSchema.safeParse({
      walletAddress: "0x2222222222222222222222222222222222222222",
      signature: "invalid-sig",
      nonce: "1234567890123456",
    });
    expect(invalidSig.success).toBe(false);
  });

  it("validates complete agreement creation metadata", () => {
    const valid = CreateAgreementSchema.safeParse({
      onChainId: 1,
      title: "Smart Contract Escrow Build",
      description: "Build milestone escrow contract on Mezo",
      clientAddress: "0x1111111111111111111111111111111111111111",
      providerAddress: "0x2222222222222222222222222222222222222222",
      tokenAddress: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503",
      totalAmount: "3000",
      milestoneDetails: [
        { title: "Milestone 1", amount: "1000", description: "Design" },
        { title: "Milestone 2", amount: "2000", description: "Code" },
      ],
    });
    expect(valid.success).toBe(true);

    const invalidNoMilestones = CreateAgreementSchema.safeParse({
      onChainId: 1,
      title: "Title",
      clientAddress: "0x1111111111111111111111111111111111111111",
      providerAddress: "0x2222222222222222222222222222222222222222",
      tokenAddress: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503",
      totalAmount: "0",
      milestoneDetails: [],
    });
    expect(invalidNoMilestones.success).toBe(false);
  });

  it("validates Telegram webhook payloads", () => {
    const valid = TelegramWebhookUpdateSchema.safeParse({
      update_id: 1001,
      message: {
        message_id: 50,
        date: 1700000000,
        chat: { id: 123456, type: "private" },
        text: "/start",
      },
    });
    expect(valid.success).toBe(true);
  });
});

