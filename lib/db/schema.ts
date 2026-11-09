import {
  pgTable,
  text,
  timestamp,
  boolean,
  integer,
  uuid,
  varchar,
  jsonb,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const AGREEMENT_VERIFICATION_STATUS = {
  verified: "verified",
  unverified: "unverified",
  legacyUnverified: "legacy_unverified",
} as const;

/**
 * Users table: tracks registered wallet addresses
 */
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  walletAddress: varchar("wallet_address", { length: 42 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Telegram Links table: binds wallet user to Telegram chat ID
 */
export const telegramLinks = pgTable("telegram_links", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  telegramChatId: text("telegram_chat_id").notNull().unique(),
  telegramUsername: text("telegram_username"),
  walletVerified: boolean("wallet_verified").default(false).notNull(),
  notificationsEnabled: boolean("notifications_enabled").default(true).notNull(),
  linkedAt: timestamp("linked_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [uniqueIndex("telegram_links_user_unique").on(table.userId)]);

/**
 * Telegram Link Tokens table: short-lived, single-use linking tokens
 */
export const telegramLinkTokens = pgTable("telegram_link_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),
  tokenHash: text("token_hash").notNull().unique(),
  issuedWithSession: boolean("issued_with_session").default(false).notNull(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumedAt: timestamp("consumed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

/**
 * Auth Nonces: protects wallet authentication against replay attacks
 */
export const authNonces = pgTable("auth_nonces", {
  id: uuid("id").defaultRandom().primaryKey(),
  nonce: text("nonce").notNull().unique(),
  walletAddress: varchar("wallet_address", { length: 42 }).notNull(),
  message: text("message"),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  consumed: boolean("consumed").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const walletSessions = pgTable("wallet_sessions", {
  tokenHash: text("token_hash").primaryKey(),
  userId: uuid("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  count: integer("count").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
});

/**
 * Notification Jobs: idempotent background notification queue
 */
export const notificationJobs = pgTable("notification_jobs", {
  id: uuid("id").defaultRandom().primaryKey(),
  eventKey: text("event_key").notNull().unique(),
  recipientChatId: text("recipient_chat_id").notNull(),
  message: text("message").notNull(),
  status: text("status").default("pending").notNull(), // pending | sent | failed
  attempts: integer("attempts").default(0).notNull(),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  sentAt: timestamp("sent_at", { withTimezone: true }),
});

/**
 * Agreement Metadata: stores human-readable metadata off-chain
 */
export const agreementMetadata = pgTable("agreement_metadata", {
  id: uuid("id").defaultRandom().primaryKey(),
  onChainId: integer("on_chain_id").notNull(),
  chainId: integer("chain_id").default(31611).notNull(),
  escrowAddress: varchar("escrow_address", { length: 42 }).notNull(),
  chainVerified: boolean("chain_verified").default(false).notNull(),
  verificationStatus: text("verification_status").default(AGREEMENT_VERIFICATION_STATUS.unverified).notNull(),
  creationTxHash: varchar("creation_tx_hash", { length: 66 }),
  title: text("title").notNull(),
  description: text("description"),
  termsHash: text("terms_hash"),
  clientAddress: varchar("client_address", { length: 42 }).notNull(),
  providerAddress: varchar("provider_address", { length: 42 }).notNull(),
  tokenAddress: varchar("token_address", { length: 42 }).notNull(),
  totalAmount: text("total_amount").notNull(),
  milestoneDetails: jsonb("milestone_details"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [
  uniqueIndex("agreement_metadata_verified_chain_escrow_id_unique")
    .on(table.chainId, table.escrowAddress, table.onChainId)
    .where(sql`${table.verificationStatus} = 'verified'`),
]);

/**
 * Webhook Events: deduplication and audit trail for Telegram webhooks
 */
export const webhookEvents = pgTable("webhook_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  updateId: text("update_id").notNull().unique(),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload"),
  processedAt: timestamp("processed_at", { withTimezone: true }).defaultNow().notNull(),
  status: text("status").default("processed").notNull(),
});

export const milestoneEvidence = pgTable("milestone_evidence", {
  id: uuid("id").defaultRandom().primaryKey(),
  escrowAddress: varchar("escrow_address", { length: 42 }).notNull(),
  agreementId: integer("agreement_id").notNull(),
  milestoneIndex: integer("milestone_index").notNull(),
  kind: text("kind").notNull(),
  text: text("text").notNull(),
  contentHash: varchar("content_hash", { length: 66 }).notNull(),
  txHash: varchar("tx_hash", { length: 66 }).notNull(),
  logIndex: integer("log_index").notNull(),
  blockNumber: text("block_number").notNull(),
  confirmedAt: timestamp("confirmed_at", { withTimezone: true }).notNull(),
}, (table) => [uniqueIndex("milestone_evidence_event_unique").on(table.escrowAddress, table.txHash, table.logIndex)]);
