ALTER TABLE "agreement_metadata" ADD COLUMN "chain_id" integer DEFAULT 31611 NOT NULL;--> statement-breakpoint
ALTER TABLE "agreement_metadata" ADD COLUMN "verification_status" text DEFAULT 'unverified' NOT NULL;--> statement-breakpoint
-- Rows created before escrow scoping all belong to the only deployment that existed then.
UPDATE "agreement_metadata" SET "escrow_address" = '0x1da50726e11bf828358f6b840900c0a731b2b40f' WHERE "escrow_address" IS NULL;--> statement-breakpoint
UPDATE "agreement_metadata" SET "verification_status" = 'verified' WHERE "chain_verified" = true;--> statement-breakpoint
ALTER TABLE "agreement_metadata" ALTER COLUMN "escrow_address" SET NOT NULL;--> statement-breakpoint
DROP INDEX "agreement_metadata_verified_escrow_id_unique";--> statement-breakpoint
CREATE UNIQUE INDEX "agreement_metadata_verified_chain_escrow_id_unique" ON "agreement_metadata" USING btree ("chain_id","escrow_address","on_chain_id") WHERE "agreement_metadata"."verification_status" = 'verified';
