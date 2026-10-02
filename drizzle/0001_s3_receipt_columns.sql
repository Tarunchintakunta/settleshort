ALTER TABLE "claims" DROP CONSTRAINT "claims_receipt_id_receipts_id_fk";
--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "receipt_key" text;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "receipt_mime" text;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "receipt_name" text;