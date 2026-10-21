import { z } from "zod";

export const addressRegex = /^0x[a-fA-F0-9]{40}$/;

export const NonceRequestSchema = z.object({
  walletAddress: z.string().regex(addressRegex, "Invalid Ethereum address format"),
});

export const VerifySignatureSchema = z.object({
  walletAddress: z.string().regex(addressRegex, "Invalid Ethereum address format"),
  signature: z.string().startsWith("0x", "Invalid signature format"),
  nonce: z.string().min(16, "Invalid nonce"),
});

export const CreateAgreementSchema = z.object({
  onChainId: z.number().int().positive(),
  title: z.string().min(3).max(120),
  description: z.string().max(2000).optional(),
  termsHash: z.string().optional(),
  clientAddress: z.string().regex(addressRegex),
  providerAddress: z.string().regex(addressRegex),
  tokenAddress: z.string().regex(addressRegex),
  totalAmount: z.string().min(1),
  milestoneDetails: z
    .array(
      z.object({
        title: z.string().min(1).max(100),
        amount: z.string().min(1),
        description: z.string().max(500).optional(),
      })
    )
    .min(1)
    .max(50),
});

export const TelegramLinkRequestSchema = z.object({
  walletAddress: z.string().regex(addressRegex),
});

export const TelegramWebhookUpdateSchema = z.object({
  update_id: z.number(),
  message: z
    .object({
      message_id: z.number(),
      from: z
        .object({
          id: z.number(),
          is_bot: z.boolean(),
          first_name: z.string(),
          username: z.string().optional(),
        })
        .optional(),
      chat: z.object({
        id: z.number(),
        type: z.string(),
        username: z.string().optional(),
        first_name: z.string().optional(),
      }),
      date: z.number(),
      text: z.string().optional(),
    })
    .optional(),
});

