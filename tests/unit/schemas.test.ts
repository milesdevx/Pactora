import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import {
  NonceRequestSchema,
  VerifySignatureSchema,
  CreateAgreementSchema,
  TelegramWebhookUpdateSchema,
} from "@/lib/validation/schemas";

// Illustration fixtures only, not live wallet, receipt, or Telegram verification.
describe("API Validation Schemas (Illustration fixtures)", () => {
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

  it("validates a locally signed body with the required message and exact signature/nonce lengths", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const message = "Illustration fixture: local signature validation only";
    const body = {
      walletAddress: account.address,
      signature: await account.signMessage({ message }),
      nonce: randomBytes(32).toString("hex"),
      message,
    };
    const valid = VerifySignatureSchema.safeParse({
      ...body,
    });
    expect(valid.success).toBe(true);

    expect(VerifySignatureSchema.safeParse({ ...body, signature: "invalid-sig" }).success).toBe(false);
    expect(VerifySignatureSchema.safeParse({ ...body, signature: body.signature.slice(0, -2) }).success).toBe(false);
    expect(VerifySignatureSchema.safeParse({ ...body, nonce: "1234567890123456" }).success).toBe(false);
    const { message: _message, ...withoutMessage } = body;
    expect(VerifySignatureSchema.safeParse(withoutMessage).success).toBe(false);
  });

  it("validates complete agreement creation metadata", () => {
    const valid = CreateAgreementSchema.safeParse({
      onChainId: 1,
      title: "Smart Contract Escrow Build",
      description: "Build milestone escrow contract on Mezo",
      termsHash: `0x${"ab".repeat(32)}`,
      creationTxHash: `0x${"cd".repeat(32)}`,
      clientAddress: "0x1111111111111111111111111111111111111111",
      providerAddress: "0x2222222222222222222222222222222222222222",
      tokenAddress: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503",
      totalAmount: "3000",
      milestoneDetails: [
        { title: "Milestone 1", amount: "1000", description: "Design", deliveryDeadline: 2000000000 },
        { title: "Milestone 2", amount: "2000", description: "Code", deliveryDeadline: 2000100000 },
      ],
    });
    expect(valid.success).toBe(true);

    const invalidNoMilestones = CreateAgreementSchema.safeParse({
      onChainId: 1,
      title: "Title",
      termsHash: `0x${"ab".repeat(32)}`,
      creationTxHash: `0x${"cd".repeat(32)}`,
      clientAddress: "0x1111111111111111111111111111111111111111",
      providerAddress: "0x2222222222222222222222222222222222222222",
      tokenAddress: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503",
      totalAmount: "0",
      milestoneDetails: [],
    });
    expect(invalidNoMilestones.success).toBe(false);
  });

  it("rejects missing receipt hashes and missing or non-integer delivery deadlines", () => {
    const body = {
      onChainId: 1,
      title: "Illustration agreement",
      termsHash: `0x${"ab".repeat(32)}`,
      creationTxHash: `0x${"cd".repeat(32)}`,
      clientAddress: "0x1111111111111111111111111111111111111111",
      providerAddress: "0x2222222222222222222222222222222222222222",
      tokenAddress: "0x3333333333333333333333333333333333333333",
      totalAmount: "1",
      milestoneDetails: [{ title: "Delivery", amount: "1", deliveryDeadline: 2000000000 }],
    };
    const { creationTxHash: _receipt, ...withoutReceipt } = body;
    const { termsHash: _terms, ...withoutTerms } = body;
    expect(CreateAgreementSchema.safeParse(withoutReceipt).success).toBe(false);
    expect(CreateAgreementSchema.safeParse(withoutTerms).success).toBe(false);
    expect(CreateAgreementSchema.safeParse({ ...body, milestoneDetails: [{ title: "Delivery", amount: "1" }] }).success).toBe(false);
    expect(CreateAgreementSchema.safeParse({ ...body, milestoneDetails: [{ ...body.milestoneDetails[0], deliveryDeadline: 1.5 }] }).success).toBe(false);
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
