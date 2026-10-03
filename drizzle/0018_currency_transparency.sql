ALTER TABLE "claims" ADD COLUMN "receipt_cents" integer;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "receipt_currency" text;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "charged_cents" integer;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "charged_currency" text;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "fx_rate" real;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "fx_source" text;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "fx_at" timestamp with time zone;--> statement-breakpoint
UPDATE "claims" SET "receipt_cents" = "amount_cents", "receipt_currency" = "currency" WHERE "receipt_cents" IS NULL;
