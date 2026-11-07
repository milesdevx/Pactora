CREATE TABLE "milestone_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"escrow_address" varchar(42) NOT NULL,
	"agreement_id" integer NOT NULL,
	"milestone_index" integer NOT NULL,
	"kind" text NOT NULL,
	"text" text NOT NULL,
	"content_hash" varchar(66) NOT NULL,
	"tx_hash" varchar(66) NOT NULL,
	"log_index" integer NOT NULL,
	"block_number" text NOT NULL,
	"confirmed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallet_sessions" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "agreement_metadata" DROP CONSTRAINT "agreement_metadata_on_chain_id_unique";--> statement-breakpoint
ALTER TABLE "agreement_metadata" ADD COLUMN "escrow_address" varchar(42);--> statement-breakpoint
ALTER TABLE "agreement_metadata" ADD COLUMN "chain_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "agreement_metadata" ADD COLUMN "creation_tx_hash" varchar(66);--> statement-breakpoint
ALTER TABLE "auth_nonces" ADD COLUMN "message" text;--> statement-breakpoint
ALTER TABLE "telegram_link_tokens" ADD COLUMN "issued_with_session" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "telegram_links" ADD COLUMN "wallet_verified" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "wallet_sessions" ADD CONSTRAINT "wallet_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "milestone_evidence_event_unique" ON "milestone_evidence" USING btree ("escrow_address","tx_hash","log_index");--> statement-breakpoint
CREATE UNIQUE INDEX "agreement_metadata_verified_escrow_id_unique" ON "agreement_metadata" USING btree ("escrow_address","on_chain_id") WHERE "agreement_metadata"."chain_verified" = true;--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_links_user_unique" ON "telegram_links" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "telegram_links" ADD CONSTRAINT "telegram_links_telegram_chat_id_unique" UNIQUE("telegram_chat_id");
--> statement-breakpoint
-- Legacy webhook payloads may contain old bearer tokens; retain IDs/statuses, not raw messages.
UPDATE "webhook_events" SET "payload" = '{}'::jsonb WHERE "event_type" <> 'command';
