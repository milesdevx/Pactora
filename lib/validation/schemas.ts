import { z } from "zod";

export const addressRegex = /^0x[a-fA-F0-9]{40}$/;
export const WalletAddressSchema = z.string().regex(addressRegex, "Invalid wallet address")
  .refine((value) => !/^0x0{40}$/i.test(value), "Zero address is not allowed")
  .transform((value) => value.toLowerCase() as `0x${string}`);
export const HashSchema = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "Invalid transaction or terms hash")
  .transform((value) => value.toLowerCase() as `0x${string}`);
export const AmountSchema = z.string().max(96).regex(/^(0|[1-9]\d*)(\.\d{1,18})?$/, "Use a non-negative amount with at most 18 decimals");
export const AgreementIdSchema = z.string().regex(/^[1-9]\d*$/, "Invalid agreement ID")
  .transform(Number).pipe(z.number().int().positive().max(2_147_483_647));
export const EmptyInputSchema = z.object({}).strict();

export const NonceRequestSchema = z.object({
  walletAddress: WalletAddressSchema,
}).strict();

export const VerifySignatureSchema = z.object({
  walletAddress: WalletAddressSchema,
  signature: z.string().regex(/^0x[0-9a-fA-F]{130}$/, "Invalid signature format"),
  nonce: z.string().regex(/^[0-9a-f]{64}$/, "Invalid nonce"),
  message: z.string().min(10).max(2000),
}).strict();

export const CreateAgreementSchema = z.object({
  onChainId: z.number().int().positive().max(2_147_483_647),
  title: z.string().min(3).max(120),
  description: z.string().max(2000).optional(),
  termsHash: HashSchema,
  creationTxHash: HashSchema,
  clientAddress: WalletAddressSchema,
  providerAddress: WalletAddressSchema,
  tokenAddress: WalletAddressSchema,
  totalAmount: AmountSchema,
  milestoneDetails: z
    .array(
      z.object({
        title: z.string().min(1).max(100),
        amount: AmountSchema,
        description: z.string().max(500).optional(),
        deliveryDeadline: z.number().int().positive().safe(),
      }).strict()
    )
    .min(1)
    .max(50),
}).strict();

export const TelegramLinkRequestSchema = z.object({
  walletAddress: WalletAddressSchema,
}).strict();

export const AgreementListQuerySchema = z.object({ wallet: WalletAddressSchema.optional() }).strict();
export const ConfirmedNotificationSchema = z.object({ txHash: HashSchema }).strict();
export const TestNotificationSchema = z.object({ message: z.string().min(1).max(500).optional() }).strict();
export const MilestoneEvidenceSchema = z.object({ milestoneIndex: z.number().int().min(0).max(49), kind: z.enum(["submission", "rejection"]), text: z.string().min(1).max(2000), txHash: HashSchema }).strict();

export const TelegramWebhookUpdateSchema = z.object({
  update_id: z.number().int().nonnegative().safe(),
  message: z
    .object({
       message_id: z.number().int().positive().safe(),
      from: z
        .object({
           id: z.number().int().positive().safe(),
          is_bot: z.boolean(),
           first_name: z.string().max(256),
           username: z.string().max(64).optional(),
        })
        .optional(),
      chat: z.object({
         id: z.number().int().safe(),
        type: z.string(),
        username: z.string().optional(),
        first_name: z.string().optional(),
      }),
       date: z.number().int().nonnegative(),
       text: z.string().max(4096).optional(),
    })
    .optional(),
});
