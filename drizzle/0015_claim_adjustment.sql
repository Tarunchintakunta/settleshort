ALTER TABLE "claims" ADD COLUMN "adjustment_cents" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "claims" ADD COLUMN "adjustment_reason" text;